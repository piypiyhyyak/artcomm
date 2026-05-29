import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  CMS_VERSION,
  DEFAULT_CONTENT,
  DEFAULT_USERS,
  ROLE_ADMIN,
  ROLE_EDITOR,
  ROLE_VIEWER,
  cloneDeep
} from "./src/cms/defaultContent.js";

const SESSION_COOKIE = "artcomm_cms_sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_ATTEMPT_LIMIT = 6;
const LOGIN_COOLDOWN_MS = 1000 * 60 * 5;
const MAX_BODY_BYTES = 380 * 1024 * 1024;
const MAX_AUTH_PAYLOAD_BYTES = 8 * 1024;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const ADMIN_ID = "admin-1";
const DEFAULT_ADMIN_LOGIN = "admin";
const DEFAULT_ADMIN_PASSWORD_HASH_LEGACY = "f6ee94ecb014f74f887b9dcc52daecf73ab3e3333320cadd98bcb59d895c52f5";
const LEGACY_ADMIN_PASSWORD_HASH = "893cbcc2f9197dce1feea7c1e80486f27ae0be699408157d744928b600a7e82b";
const DEFAULT_SECURITY_CODEWORD_HASH = "8fd706e21340a5033ccd4270f22c051de24cabb6b1c4c3ad8f61dc7fb8ad22d6";
const CHARTER_FALLBACK_URL = "/assets/ustav-artkommunikacii.pdf";
const RUNTIME_STATE_KEY = "__ARTCOMM_CMS_RUNTIME__";

const PENDING_SUFFIX_RE = /\s*\(файл добавляется\)\s*$/i;
const PENDING_WITH_OPTIONAL_RE = /\s*\(при наличии,\s*файл добавляется\)\s*$/i;
const FALLBACK_ABOUT_LIST_PATHS = [
  ["about", "documentsBasic"],
  ["about", "documentsMain"],
  ["about", "education", "links"],
  ["about", "extra", "pedagogy"],
  ["about", "extra", "paidServices"],
  ["about", "extra", "standards"],
  ["about", "extra", "programs"]
];

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
  ".ogg"
]);
const ALLOWED_MIME_PREFIXES = new Set(["application/", "image/", "video/"]);
const MIME_BY_EXTENSION = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".mp4": ["video/mp4", "application/octet-stream"],
  ".webm": ["video/webm", "application/octet-stream"],
  ".ogg": ["video/ogg", "application/ogg", "application/octet-stream"]
};
const MAX_FILE_BYTES_BY_EXTENSION = {
  ".pdf": 40 * 1024 * 1024,
  ".doc": 25 * 1024 * 1024,
  ".docx": 25 * 1024 * 1024,
  ".xls": 25 * 1024 * 1024,
  ".xlsx": 25 * 1024 * 1024,
  ".jpg": 25 * 1024 * 1024,
  ".jpeg": 25 * 1024 * 1024,
  ".png": 25 * 1024 * 1024,
  ".webp": 25 * 1024 * 1024,
  ".mp4": 260 * 1024 * 1024,
  ".webm": 260 * 1024 * 1024,
  ".ogg": 260 * 1024 * 1024
};

function normalizeLogin(login) {
  return String(login || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function hashPasswordScrypt(password, salt = crypto.randomBytes(SCRYPT_SALT_BYTES)) {
  const plain = String(password || "");
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    derived.toString("base64")
  ].join("$");
}

function verifyScryptHash(password, encoded) {
  if (typeof encoded !== "string" || !encoded.startsWith("scrypt$")) {
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 6) {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || n <= 1 || r <= 0 || p <= 0) {
    return false;
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltRaw, "base64");
    expected = Buffer.from(hashRaw, "base64");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) {
    return false;
  }

  let actual;
  try {
    actual = crypto.scryptSync(String(password || ""), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAXMEM
    });
  } catch {
    return false;
  }

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function verifyPasswordHash(password, storedHash) {
  const hash = String(storedHash || "").trim();
  if (!hash) {
    return false;
  }
  if (hash.startsWith("scrypt$")) {
    return verifyScryptHash(password, hash);
  }
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const actualHex = sha256(password);
    const expected = Buffer.from(hash.toLowerCase(), "hex");
    const actual = Buffer.from(actualHex, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return false;
}

function isSupportedPasswordHashFormat(hashValue) {
  const hash = String(hashValue || "").trim();
  return hash.startsWith("scrypt$") || /^[a-f0-9]{64}$/i.test(hash);
}

function hashPasswordForStorage(password) {
  return hashPasswordScrypt(password);
}

function sanitizeUserForClient(user) {
  if (!user || typeof user !== "object") {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    createdAt: user.createdAt || null
  };
}

function sanitizeStateForClient(state) {
  if (!state || typeof state !== "object") {
    return state;
  }
  const users = Array.isArray(state.users) ? state.users.map(sanitizeUserForClient).filter(Boolean) : [];
  return {
    ...state,
    users
  };
}

function resolveSecurityConfig() {
  const adminLogin = normalizeLogin(process.env.ARTCOMM_CMS_ADMIN_LOGIN || DEFAULT_ADMIN_LOGIN) || DEFAULT_ADMIN_LOGIN;
  const adminPassword = String(process.env.ARTCOMM_CMS_ADMIN_PASSWORD || "");
  const adminPasswordHashRaw = String(process.env.ARTCOMM_CMS_ADMIN_PASSWORD_HASH || "").trim();
  const securityCodeword = String(process.env.ARTCOMM_CMS_SECURITY_CODEWORD || "");
  const securityCodewordHashRaw = String(process.env.ARTCOMM_CMS_SECURITY_CODEWORD_HASH || "").trim();

  let adminPasswordHash = DEFAULT_ADMIN_PASSWORD_HASH_LEGACY;
  if (adminPassword) {
    adminPasswordHash = hashPasswordForStorage(adminPassword);
  } else if (adminPasswordHashRaw && isSupportedPasswordHashFormat(adminPasswordHashRaw)) {
    adminPasswordHash = adminPasswordHashRaw;
  }

  const securityCodewordHash = securityCodeword
    ? sha256(securityCodeword)
    : /^[a-f0-9]{64}$/i.test(securityCodewordHashRaw)
      ? securityCodewordHashRaw.toLowerCase()
      : DEFAULT_SECURITY_CODEWORD_HASH;

  return {
    adminLogin,
    adminPasswordHash,
    securityCodewordHash
  };
}

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeWithDefaults(defaultValue, sourceValue) {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(sourceValue)) {
      return cloneDeep(defaultValue);
    }
    return sourceValue.map((item) => cloneDeep(item));
  }

  if (isPlainObject(defaultValue)) {
    const next = isPlainObject(sourceValue) ? { ...sourceValue } : {};
    Object.keys(defaultValue).forEach((key) => {
      next[key] = mergeWithDefaults(defaultValue[key], isPlainObject(sourceValue) ? sourceValue[key] : undefined);
    });
    return next;
  }

  if (sourceValue === undefined || sourceValue === null) {
    return cloneDeep(defaultValue);
  }

  return sourceValue;
}

function createBaseState() {
  const content = cloneDeep(DEFAULT_CONTENT);
  return {
    version: CMS_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    publishedAt: null,
    users: cloneDeep(DEFAULT_USERS),
    draft: content,
    published: cloneDeep(content)
  };
}

function normalizeDocumentTitle(title) {
  if (typeof title !== "string") {
    return title;
  }
  if (PENDING_WITH_OPTIONAL_RE.test(title)) {
    return title.replace(PENDING_WITH_OPTIONAL_RE, " (при наличии)").trim();
  }
  return title.replace(PENDING_SUFFIX_RE, "").trim();
}

function normalizeAboutDocuments(content) {
  if (!content || typeof content !== "object") {
    return false;
  }

  let changed = false;

  FALLBACK_ABOUT_LIST_PATHS.forEach((pathKeys) => {
    let cursor = content;
    for (let index = 0; index < pathKeys.length - 1; index += 1) {
      cursor = cursor && typeof cursor === "object" ? cursor[pathKeys[index]] : null;
    }

    if (!cursor || typeof cursor !== "object") {
      return;
    }

    const lastKey = pathKeys[pathKeys.length - 1];
    const list = cursor[lastKey];
    if (!Array.isArray(list)) {
      return;
    }

    cursor[lastKey] = list.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }

      let nextItem = item;
      const normalizedTitle = normalizeDocumentTitle(item.title);
      if (normalizedTitle !== item.title) {
        nextItem = { ...nextItem, title: normalizedTitle };
        changed = true;
      }

      const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
      if (!hasUrl) {
        nextItem = {
          ...nextItem,
          url: CHARTER_FALLBACK_URL,
          isPublished: true
        };
        changed = true;
      }

      return nextItem;
    });
  });

  return changed;
}

function normalizeHomeMediaSources(content) {
  if (!content || typeof content !== "object") {
    return false;
  }

  const media = content.home && content.home.mediaStation;
  if (!media || typeof media !== "object") {
    return false;
  }

  const desktop = typeof media.videoDesktop === "string" ? media.videoDesktop.trim() : "";
  const mobile = typeof media.videoMobile === "string" ? media.videoMobile.trim() : "";
  const fallback = typeof media.videoFallback === "string" ? media.videoFallback.trim() : "";
  const unified = desktop || fallback || mobile || "/assets/gimn-ed-zy9mar.mp4";

  const changed = media.videoDesktop !== unified || media.videoMobile !== unified || media.videoFallback !== unified;
  if (changed) {
    media.videoDesktop = unified;
    media.videoMobile = unified;
    media.videoFallback = unified;
  }

  return changed;
}

function normalizeModals(content) {
  if (!content || typeof content !== "object") {
    return false;
  }

  const currentList = Array.isArray(content.modals) ? content.modals : [];
  const defaultsList = Array.isArray(DEFAULT_CONTENT.modals) ? cloneDeep(DEFAULT_CONTENT.modals) : [];
  if (!defaultsList.length) {
    return false;
  }

  const byId = new Map();
  currentList.forEach((entry) => {
    if (!entry || typeof entry !== "object" || !entry.id) {
      return;
    }
    byId.set(entry.id, { ...entry });
  });

  let changed = !Array.isArray(content.modals);
  const normalized = defaultsList.map((defaultEntry) => {
    const existing = byId.get(defaultEntry.id);
    if (!existing) {
      changed = true;
      return cloneDeep(defaultEntry);
    }
    const merged = { ...defaultEntry, ...existing };
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      changed = true;
    }
    return merged;
  });

  if (currentList.length !== normalized.length) {
    changed = true;
  }

  if (changed) {
    content.modals = normalized;
  }

  return changed;
}

function normalizeActionLimits(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const limits = [
    ["hero", "actions", 3],
    ["mediaStation", "actions", 3],
    ["iks", "actions", 3],
    ["expert", "actions", 3]
  ];

  let changed = false;
  limits.forEach(([sectionKey, listKey, max]) => {
    const section = content.home[sectionKey];
    if (!section || typeof section !== "object" || !Array.isArray(section[listKey])) {
      return;
    }
    if (section[listKey].length > max) {
      section[listKey] = section[listKey].slice(0, max);
      changed = true;
    }
  });

  return changed;
}

function normalizeLoadedUsers(rawUsers, securityConfig) {
  const users = Array.isArray(rawUsers) && rawUsers.length ? cloneDeep(rawUsers) : cloneDeep(DEFAULT_USERS);
  const adminLogin = normalizeLogin(securityConfig?.adminLogin || DEFAULT_ADMIN_LOGIN) || DEFAULT_ADMIN_LOGIN;
  const requiredAdminPasswordHash = String(securityConfig?.adminPasswordHash || DEFAULT_ADMIN_PASSWORD_HASH_LEGACY).trim();

  const adminIndex = users.findIndex((user) => user && user.id === ADMIN_ID);
  if (adminIndex >= 0) {
    const currentAdmin = users[adminIndex];
    const nextAdmin = {
      ...currentAdmin,
      id: ADMIN_ID,
      login: adminLogin,
      role: ROLE_ADMIN
    };

    const currentHash = String(nextAdmin.passwordHash || "").trim();
    const shouldSetRequiredPassword =
      !currentHash ||
      currentHash === LEGACY_ADMIN_PASSWORD_HASH ||
      currentHash === DEFAULT_ADMIN_PASSWORD_HASH_LEGACY ||
      nextAdmin.password === "artcomm-admin-2026";

    if (shouldSetRequiredPassword) {
      nextAdmin.passwordHash = requiredAdminPasswordHash;
      delete nextAdmin.password;
    }

    users[adminIndex] = nextAdmin;
    return users;
  }

  users.unshift({
    ...cloneDeep(DEFAULT_USERS[0]),
    id: ADMIN_ID,
    login: adminLogin,
    role: ROLE_ADMIN,
    passwordHash: requiredAdminPasswordHash
  });
  return users;
}

function normalizeUsersForState(nextUsers, securityConfig, existingUsersMap = new Map()) {
  const usedLogins = new Set();
  const roles = new Set([ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER]);
  return normalizeLoadedUsers((nextUsers || []).map((user, index) => {
    const isAdmin = user && user.id === ADMIN_ID;
    const baseLogin = normalizeLogin(isAdmin ? securityConfig?.adminLogin || DEFAULT_ADMIN_LOGIN : user?.login || "");
    const fallbackLogin = `user${index + 1}`;
    let loginCandidate = baseLogin || fallbackLogin;
    const existingUser = user?.id ? existingUsersMap.get(user.id) : null;

    if (!isAdmin && loginCandidate === normalizeLogin(securityConfig?.adminLogin || DEFAULT_ADMIN_LOGIN)) {
      loginCandidate = fallbackLogin;
    }

    let safeLogin = loginCandidate;
    let suffix = 1;
    while (usedLogins.has(safeLogin)) {
      safeLogin = `${loginCandidate}-${suffix}`;
      suffix += 1;
    }
    usedLogins.add(safeLogin);

    const normalized = {
      id: user.id,
      name: String(user?.name || "").trim() || "Пользователь",
      login: safeLogin,
      role: roles.has(user?.role) ? user.role : ROLE_VIEWER,
      createdAt: user.createdAt || nowIso(),
      passwordHash:
        String(existingUser?.passwordHash || "").trim() ||
        String(user?.passwordHash || "").trim()
    };
    if (isAdmin) {
      normalized.role = ROLE_ADMIN;
      normalized.login = normalizeLogin(securityConfig?.adminLogin || DEFAULT_ADMIN_LOGIN) || DEFAULT_ADMIN_LOGIN;
      const currentHash = String(normalized.passwordHash || "").trim();
      if (!currentHash || currentHash === LEGACY_ADMIN_PASSWORD_HASH || currentHash === DEFAULT_ADMIN_PASSWORD_HASH_LEGACY) {
        normalized.passwordHash = String(securityConfig?.adminPasswordHash || DEFAULT_ADMIN_PASSWORD_HASH_LEGACY).trim();
      }
    }
    return normalized;
  }), securityConfig);
}

function normalizeState(parsed, securityConfig) {
  const fallback = createBaseState();
  const sourceUsers = Array.isArray(parsed?.users) && parsed.users.length ? parsed.users : fallback.users;
  const normalizedUsers = normalizeLoadedUsers(sourceUsers, securityConfig);

  const parsedDraft = parsed?.draft && typeof parsed.draft === "object" ? parsed.draft : null;
  const parsedPublished = parsed?.published && typeof parsed.published === "object" ? parsed.published : null;

  const merged = {
    ...fallback,
    ...parsed,
    users: normalizedUsers,
    draft: mergeWithDefaults(fallback.draft, parsedDraft || fallback.draft),
    published: mergeWithDefaults(fallback.published, parsedPublished || parsedDraft || fallback.published)
  };

  normalizeAboutDocuments(merged.draft);
  normalizeAboutDocuments(merged.published);
  normalizeHomeMediaSources(merged.draft);
  normalizeHomeMediaSources(merged.published);
  normalizeModals(merged.draft);
  normalizeModals(merged.published);
  normalizeActionLimits(merged.draft);
  normalizeActionLimits(merged.published);

  merged.version = CMS_VERSION;
  return merged;
}

function parseCookies(cookieHeader) {
  const source = String(cookieHeader || "");
  const map = new Map();
  source.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx <= 0) {
      return;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) {
      return;
    }
    map.set(key, decodeURIComponent(value));
  });
  return map;
}

function isSameOriginRequest(req) {
  const host = String(req.headers.host || "").toLowerCase();
  if (!host) {
    return false;
  }
  const allowedOrigins = new Set([`http://${host}`, `https://${host}`]);

  const origin = String(req.headers.origin || "").toLowerCase().trim();
  if (origin && !allowedOrigins.has(origin)) {
    return false;
  }

  const referer = String(req.headers.referer || "").trim();
  if (referer) {
    try {
      const parsed = new URL(referer);
      const originValue = `${parsed.protocol}//${parsed.host}`.toLowerCase();
      if (!allowedOrigins.has(originValue)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const siteHeader = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (siteHeader && !["same-origin", "same-site", "none"].includes(siteHeader)) {
    return false;
  }

  return true;
}

function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      res.setHeader(key, value);
    }
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, options = {}) {
  const limitBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : MAX_BODY_BYTES;
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw new Error("payload_too_large");
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
}

function sanitizeFolderPath(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!raw) {
    return "";
  }

  const segments = raw
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-z0-9_-]/g, ""));

  return segments.filter(Boolean).slice(0, 6).join("/");
}

function sanitizeFileName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё._-]/giu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";
}

function getExtension(fileName) {
  return String(path.extname(fileName || "") || "").toLowerCase();
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([\w/+.-]+);base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error("invalid_data_url");
  }

  const mime = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new Error("empty_file");
  }

  return { mime, buffer };
}

function assertMimeAllowed(mime, extension) {
  const normalizedMime = String(mime || "").toLowerCase();
  if (!normalizedMime || !ALLOWED_MIME_PREFIXES.has(normalizedMime.split("/")[0] + "/")) {
    throw new Error("unsupported_mime");
  }
  const allowed = MIME_BY_EXTENSION[extension] || [];
  if (!allowed.includes(normalizedMime)) {
    throw new Error("mime_mismatch");
  }
}

function assertFileSizeAllowed(extension, size) {
  const maxBytes = MAX_FILE_BYTES_BY_EXTENSION[extension];
  if (!maxBytes || !Number.isFinite(size) || size <= 0) {
    throw new Error("invalid_file_size");
  }
  if (size > maxBytes) {
    throw new Error("file_too_large");
  }
}

function ensureAssetsPath(filePath) {
  const value = String(filePath || "").trim().replace(/\\/g, "/");
  if (!value.startsWith("/assets/")) {
    throw new Error("invalid_path");
  }

  if (value.includes("..")) {
    throw new Error("invalid_path");
  }

  return value;
}

async function resolveUniqueAssetName(assetsDir, fileName) {
  const ext = path.extname(fileName);
  const baseRaw = ext ? fileName.slice(0, -ext.length) : fileName;
  const base = sanitizeFileName(baseRaw);
  const extension = (ext || "").toLowerCase();

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("unsupported_extension");
  }

  let candidate = `${base}${extension}`;
  let index = 1;

  while (fs.existsSync(path.join(assetsDir, candidate))) {
    candidate = `${base}-${index}${extension}`;
    index += 1;
  }

  return candidate;
}

function canEdit(role) {
  return role === ROLE_ADMIN || role === ROLE_EDITOR;
}

function canPublish(role) {
  return role === ROLE_ADMIN || role === ROLE_EDITOR;
}

function canManageUsers(role) {
  return role === ROLE_ADMIN;
}

function makeSessionCookie(sid, req) {
  const secure = String(req.headers["x-forwarded-proto"] || "").toLowerCase().includes("https") || req.socket.encrypted;
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (secure) {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

function makeExpiredSessionCookie(req) {
  const secure = String(req.headers["x-forwarded-proto"] || "").toLowerCase().includes("https") || req.socket.encrypted;
  const attrs = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (secure) {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

function getRuntimeState() {
  const root = globalThis;
  if (!root[RUNTIME_STATE_KEY]) {
    root[RUNTIME_STATE_KEY] = {
      sessions: new Map(),
      loginGuards: new Map()
    };
  }
  return root[RUNTIME_STATE_KEY];
}

function extractClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.socket?.remoteAddress || "unknown");
}

export function createCmsApiHandler(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dataDir = path.resolve(process.env.ARTCOMM_CMS_DATA_DIR || path.join(rootDir, "cms-data"));
  const stateFile = path.join(dataDir, "state.json");
  const publicDir = path.resolve(process.env.ARTCOMM_CMS_PUBLIC_DIR || path.join(rootDir, "public"));
  const assetsDir = path.resolve(process.env.ARTCOMM_CMS_ASSETS_DIR || path.join(publicDir, "assets"));
  const securityConfig = resolveSecurityConfig();

  const runtimeState = getRuntimeState();
  const sessions = runtimeState.sessions;
  const loginGuards = runtimeState.loginGuards;

  let writeChain = Promise.resolve();

  async function ensureStateFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    if (!fs.existsSync(stateFile)) {
      const initial = normalizeState(createBaseState(), securityConfig);
      await fsp.writeFile(stateFile, JSON.stringify(initial, null, 2));
    }
  }

  async function readState() {
    await ensureStateFile();
    try {
      const raw = await fsp.readFile(stateFile, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeState(parsed, securityConfig);
    } catch {
      return normalizeState(createBaseState(), securityConfig);
    }
  }

  function queueWrite(state) {
    const next = normalizeState(state, securityConfig);
    writeChain = writeChain
      .then(async () => {
        await ensureStateFile();
        const tempFile = `${stateFile}.tmp`;
        await fsp.writeFile(tempFile, JSON.stringify(next, null, 2));
        await fsp.rename(tempFile, stateFile);
      })
      .catch(() => {});
    return writeChain.then(() => next);
  }

  function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
      if (!session || session.expiresAt <= now) {
        sessions.delete(sid);
      }
    }
  }

  function getSessionFromRequest(req) {
    cleanupExpiredSessions();
    const cookies = parseCookies(req.headers.cookie || "");
    const sid = cookies.get(SESSION_COOKIE);
    if (!sid) {
      return null;
    }
    const stored = sessions.get(sid);
    if (!stored) {
      return null;
    }
    if (stored.expiresAt <= Date.now()) {
      sessions.delete(sid);
      return null;
    }
    stored.expiresAt = Date.now() + SESSION_TTL_MS;
    return stored;
  }

  function getGuardKey(req, login) {
    return `${extractClientIp(req)}::${String(login || "").toLowerCase()}`;
  }

  function getGuard(req, login) {
    const key = getGuardKey(req, login);
    const current = loginGuards.get(key);
    if (!current) {
      return { failedAttempts: 0, lockUntil: 0, key };
    }
    return { ...current, key };
  }

  function setGuard(guard) {
    if (!guard || !guard.key) {
      return;
    }
    loginGuards.set(guard.key, {
      failedAttempts: Number(guard.failedAttempts) || 0,
      lockUntil: Number(guard.lockUntil) || 0
    });
  }

  function clearGuard(req, login) {
    const key = getGuardKey(req, login);
    loginGuards.delete(key);
  }

  function readSecurityGate(gateRaw) {
    const gate = gateRaw && typeof gateRaw === "object" ? gateRaw : null;
    if (!gate) {
      return null;
    }

    const authLogin = normalizeLogin(gate.authLogin || "");
    const authPassword = String(gate.authPassword || "");
    const codeword = String(gate.codeword || "").trim();
    const sessionUserId = String(gate.sessionUserId || "").trim();

    if (!authLogin || !authPassword || !codeword || !sessionUserId) {
      return null;
    }

    return {
      authLogin,
      authPassword,
      codeword,
      sessionUserId
    };
  }

  async function validateSecurityGate(state, session, gateRaw) {
    const gate = readSecurityGate(gateRaw);
    if (!gate) {
      return { ok: false, status: 400, error: "invalid_gate" };
    }

    if (sha256(gate.codeword) !== securityConfig.securityCodewordHash) {
      return { ok: false, status: 403, error: "invalid_codeword" };
    }

    const verifiedUser = await verifyCredentials(state, gate.authLogin, gate.authPassword);
    if (!verifiedUser) {
      return { ok: false, status: 403, error: "invalid_auth" };
    }

    if (verifiedUser.id !== gate.sessionUserId || verifiedUser.role !== ROLE_ADMIN || session.id !== gate.sessionUserId) {
      return { ok: false, status: 403, error: "forbidden" };
    }

    return { ok: true, gate };
  }

  async function verifyCredentials(state, login, password) {
    const normalizedLogin = normalizeLogin(login);
    const user = state.users.find((item) => {
      if (!item || item.login !== normalizedLogin) {
        return false;
      }
      if (item.passwordHash) {
        return verifyPasswordHash(password, item.passwordHash);
      }
      return item.password === password;
    });
    if (!user) {
      return null;
    }

    if (!user.passwordHash || !String(user.passwordHash).startsWith("scrypt$")) {
      const passwordHash = hashPasswordForStorage(password);
      state.users = state.users.map((item) =>
        item.id === user.id
          ? {
              ...item,
              passwordHash
            }
          : item
      );
      state.users.forEach((item) => {
        delete item.password;
      });
      await queueWrite(state);
    }

    return user;
  }

  async function requireSession(req, res, options = {}) {
    const session = getSessionFromRequest(req);
    if (!session) {
      if (!options.silent) {
        sendJson(res, 401, { ok: false, error: "unauthorized" }, { "Set-Cookie": makeExpiredSessionCookie(req) });
      }
      return null;
    }

    if (!isSameOriginRequest(req)) {
      sendJson(res, 403, { ok: false, error: "forbidden" });
      return null;
    }

    return session;
  }

  return async function cmsApiHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    const isApiPath = pathname.startsWith("/api/cms/") || pathname.startsWith("/api/admin/");
    if (!isApiPath) {
      return false;
    }

    try {
      if (pathname === "/api/cms/health") {
        sendJson(res, 200, { ok: true, mode: "server" });
        return true;
      }

      if (pathname === "/api/admin/health") {
        sendJson(res, 200, { ok: true, mode: "server", token: "session-auth" });
        return true;
      }

      if (pathname === "/api/cms/published" && method === "GET") {
        const state = await readState();
        sendJson(res, 200, {
          ok: true,
          content: state.published,
          publishedAt: state.publishedAt || null,
          updatedAt: state.updatedAt || null
        });
        return true;
      }

      if (pathname === "/api/cms/login" && method === "POST") {
        if (!isSameOriginRequest(req)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const login = normalizeLogin(body.login || "");
        const password = String(body.password || "");

        if (!login || !password) {
          sendJson(res, 400, { ok: false, error: "missing_credentials" });
          return true;
        }

        const guard = getGuard(req, login);
        const now = Date.now();
        if (guard.lockUntil > now) {
          sendJson(res, 429, { ok: false, error: "locked", retryAt: guard.lockUntil });
          return true;
        }

        const state = await readState();
        const user = await verifyCredentials(state, login, password);

        if (!user) {
          const failedAttempts = (guard.failedAttempts || 0) + 1;
          const lockUntil = failedAttempts >= LOGIN_ATTEMPT_LIMIT ? now + LOGIN_COOLDOWN_MS : 0;
          setGuard({ ...guard, failedAttempts, lockUntil });
          sendJson(res, 401, { ok: false, error: "invalid" });
          return true;
        }

        clearGuard(req, login);

        const sid = crypto.randomBytes(24).toString("hex");
        const session = {
          id: user.id,
          name: user.name,
          login: user.login,
          role: user.role,
          loggedAt: nowIso(),
          expiresAt: Date.now() + SESSION_TTL_MS
        };
        sessions.set(sid, session);

        sendJson(
          res,
          200,
          {
            ok: true,
            session: {
              id: session.id,
              name: session.name,
              login: session.login,
              role: session.role,
              loggedAt: session.loggedAt
            },
            state: sanitizeStateForClient(state)
          },
          { "Set-Cookie": makeSessionCookie(sid, req) }
        );
        return true;
      }

      if (pathname === "/api/cms/logout" && method === "POST") {
        if (isSameOriginRequest(req)) {
          const cookies = parseCookies(req.headers.cookie || "");
          const sid = cookies.get(SESSION_COOKIE);
          if (sid) {
            sessions.delete(sid);
          }
        }
        sendJson(res, 200, { ok: true }, { "Set-Cookie": makeExpiredSessionCookie(req) });
        return true;
      }

      if (pathname === "/api/cms/session" && method === "GET") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        const state = await readState();
        sendJson(res, 200, {
          ok: true,
          session: {
            id: session.id,
            name: session.name,
            login: session.login,
            role: session.role,
            loggedAt: session.loggedAt
          },
          state: sanitizeStateForClient(state)
        });
        return true;
      }

      if (pathname === "/api/cms/state" && method === "GET") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        const state = await readState();
        sendJson(res, 200, {
          ok: true,
          state: sanitizeStateForClient(state),
          session: {
            id: session.id,
            role: session.role,
            login: session.login,
            name: session.name,
            loggedAt: session.loggedAt
          }
        });
        return true;
      }

      if (pathname === "/api/cms/draft" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canEdit(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req);
        if (!body || typeof body.draft !== "object") {
          sendJson(res, 400, { ok: false, error: "invalid_draft" });
          return true;
        }

        const state = await readState();
        state.draft = mergeWithDefaults(DEFAULT_CONTENT, body.draft);
        normalizeAboutDocuments(state.draft);
        normalizeHomeMediaSources(state.draft);
        normalizeModals(state.draft);
        normalizeActionLimits(state.draft);
        state.updatedAt = nowIso();

        const saved = await queueWrite(state);
        sendJson(res, 200, { ok: true, state: sanitizeStateForClient(saved) });
        return true;
      }

      if (pathname === "/api/cms/publish" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canPublish(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const state = await readState();
        state.published = cloneDeep(state.draft);
        normalizeAboutDocuments(state.published);
        normalizeHomeMediaSources(state.published);
        normalizeModals(state.published);
        normalizeActionLimits(state.published);
        state.publishedAt = nowIso();
        state.updatedAt = nowIso();
        state.lastPublishedBy = session.id;

        const saved = await queueWrite(state);
        sendJson(res, 200, { ok: true, state: sanitizeStateForClient(saved) });
        return true;
      }

      if (pathname === "/api/cms/users" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.users)) {
          sendJson(res, 400, { ok: false, error: "invalid_users" });
          return true;
        }

        const state = await readState();
        const existingUsersMap = new Map(
          (Array.isArray(state.users) ? state.users : []).map((user) => [user.id, user])
        );
        state.users = normalizeUsersForState(body.users, securityConfig, existingUsersMap);
        state.updatedAt = nowIso();
        const saved = await queueWrite(state);

        sendJson(res, 200, { ok: true, state: sanitizeStateForClient(saved) });
        return true;
      }

      if (pathname === "/api/cms/verify-gate" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const state = await readState();
        const validation = await validateSecurityGate(state, session, body.gate);
        if (!validation.ok) {
          sendJson(res, validation.status, { ok: false, error: validation.error });
          return true;
        }

        sendJson(res, 200, { ok: true });
        return true;
      }

      if (pathname === "/api/cms/user-password" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const userId = String(body.userId || "").trim();
        const password = String(body.password || "").trim();
        const gate = body.gate;

        if (!userId || password.length < 8 || !gate) {
          sendJson(res, 400, { ok: false, error: "invalid_payload" });
          return true;
        }

        const state = await readState();
        const validation = await validateSecurityGate(state, session, gate);
        if (!validation.ok) {
          sendJson(res, validation.status, { ok: false, error: validation.error });
          return true;
        }

        const targetExists = state.users.some((user) => user.id === userId);
        if (!targetExists) {
          sendJson(res, 404, { ok: false, error: "user_not_found" });
          return true;
        }

        const hashed = hashPasswordForStorage(password);
        state.users = state.users.map((user) =>
          user.id === userId
            ? {
                ...user,
                passwordHash: hashed
              }
            : user
        );
        state.users.forEach((user) => {
          delete user.password;
        });
        state.updatedAt = nowIso();

        const saved = await queueWrite(state);
        sendJson(res, 200, { ok: true, state: sanitizeStateForClient(saved) });
        return true;
      }

      if ((pathname === "/api/cms/upload" || pathname === "/api/admin/upload") && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canEdit(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req);
        const fileName = String(body.fileName || "").trim();
        const dataUrl = String(body.dataUrl || "");
        const folder = sanitizeFolderPath(body.folder);

        if (!fileName || !dataUrl) {
          sendJson(res, 400, { ok: false, error: "missing_file_data" });
          return true;
        }

        const extension = getExtension(fileName);
        if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
          sendJson(res, 400, { ok: false, error: "unsupported_extension" });
          return true;
        }

        const { mime, buffer } = parseDataUrl(dataUrl);
        assertMimeAllowed(mime, extension);
        assertFileSizeAllowed(extension, buffer.length);

        const targetDir = folder ? path.join(assetsDir, folder) : assetsDir;
        await fsp.mkdir(targetDir, { recursive: true });
        const finalName = await resolveUniqueAssetName(targetDir, fileName);
        const absoluteFile = path.join(targetDir, finalName);
        const relativeAssetPath = folder ? `/assets/${folder}/${finalName}` : `/assets/${finalName}`;
        await fsp.writeFile(absoluteFile, buffer);

        sendJson(res, 200, { ok: true, path: relativeAssetPath });
        return true;
      }

      if ((pathname === "/api/cms/delete" || pathname === "/api/admin/delete") && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canEdit(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req);
        const assetPath = ensureAssetsPath(body.path);
        const relativePath = assetPath.slice("/assets/".length);
        const absoluteFile = path.resolve(assetsDir, relativePath);

        if (!absoluteFile.startsWith(path.resolve(assetsDir) + path.sep) && absoluteFile !== path.resolve(assetsDir)) {
          sendJson(res, 400, { ok: false, error: "invalid_path" });
          return true;
        }

        try {
          await fsp.unlink(absoluteFile);
        } catch (error) {
          if (!error || error.code !== "ENOENT") {
            throw error;
          }
        }

        sendJson(res, 200, { ok: true });
        return true;
      }

      sendJson(res, 404, { ok: false, error: "not_found" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "internal_error";
      const status =
        message === "payload_too_large" || message === "file_too_large"
          ? 413
          : [
              "invalid_json",
              "missing_file_data",
              "invalid_data_url",
              "empty_file",
              "unsupported_extension",
              "unsupported_mime",
              "mime_mismatch",
              "invalid_file_size",
              "invalid_path",
              "invalid_draft",
              "invalid_users",
              "invalid_payload",
              "invalid_gate"
            ].includes(message)
            ? 400
            : 500;
      sendJson(res, status, { ok: false, error: message });
      return true;
    }
  };
}
