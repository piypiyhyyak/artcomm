import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
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
const MAX_CONTACT_PAYLOAD_BYTES = 24 * 1024;
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
const PRIVACY_POLICY_URL = "/privacy";
const MARKETING_CONSENT_URL = "/privacy#marketing-consent";
const CONTACT_ATTEMPT_LIMIT = 6;
const CONTACT_WINDOW_MS = 1000 * 60 * 10;
const CONTACT_COOLDOWN_MS = 1000 * 60 * 15;
const CONTACT_NAME_MAX = 120;
const CONTACT_EMAIL_MAX = 190;
const CONTACT_MESSAGE_MAX = 3000;
const MIN_PASSWORD_LENGTH = 10;
const SENSITIVE_ATTEMPT_LIMIT = 5;
const SENSITIVE_COOLDOWN_MS = 1000 * 60 * 10;
const DEFAULT_VERSION_LIMIT = 30;
const MIN_VERSION_LIMIT = 20;
const MAX_VERSION_LIMIT = 1000;

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

function hashEqualsHex(left, right) {
  const normalizedLeft = String(left || "").trim().toLowerCase();
  const normalizedRight = String(right || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(normalizedLeft) || !/^[a-f0-9]{64}$/i.test(normalizedRight)) {
    return false;
  }
  const leftBuffer = Buffer.from(normalizedLeft, "hex");
  const rightBuffer = Buffer.from(normalizedRight, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function parseBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return Boolean(fallback);
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "n"].includes(normalized)) {
    return false;
  }
  return Boolean(fallback);
}

function toInt(value, fallback) {
  const next = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(next) ? next : fallback;
}

function clampVersionLimit(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_VERSION_LIMIT;
  }
  return Math.max(MIN_VERSION_LIMIT, Math.min(MAX_VERSION_LIMIT, Math.trunc(value)));
}

function makeVersionId() {
  return `ver-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function cleanSingleLine(value, maxLength) {
  const normalized = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!maxLength || maxLength <= 0) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  const normalized = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!maxLength || maxLength <= 0) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > CONTACT_EMAIL_MAX) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHeaderValue(value, fallback = "") {
  const cleaned = String(value || "").replace(/[\r\n]/g, "").trim();
  return cleaned || fallback;
}

function parseEmailList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(isValidEmail);
}

function resolveContactConfig() {
  const modeEnv = String(process.env.ARTCOMM_CONTACT_MODE || "").trim().toLowerCase();
  const smtpHost = String(process.env.ARTCOMM_CONTACT_SMTP_HOST || "").trim();
  const smtpSecure = parseBooleanFlag(process.env.ARTCOMM_CONTACT_SMTP_SECURE, false);
  const smtpPortDefault = smtpSecure ? 465 : 587;
  const smtpPort = toInt(process.env.ARTCOMM_CONTACT_SMTP_PORT, smtpPortDefault);
  const smtpUser = String(process.env.ARTCOMM_CONTACT_SMTP_USER || "").trim();
  const smtpPass = String(process.env.ARTCOMM_CONTACT_SMTP_PASS || "").trim();
  const mailFrom = stripHeaderValue(
    process.env.ARTCOMM_CONTACT_FROM || "АртКомм <no-reply@artcomminstitute.ru>",
    "АртКомм <no-reply@artcomminstitute.ru>"
  );
  const mailTo = parseEmailList(process.env.ARTCOMM_CONTACT_TO || "info@artcommrf.ru");
  const mailCc = parseEmailList(process.env.ARTCOMM_CONTACT_CC || "");
  const mode = modeEnv || (smtpHost && smtpUser && smtpPass && mailTo.length ? "smtp" : "log");

  return {
    mode,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    mailFrom,
    mailTo,
    mailCc
  };
}

function hashPasswordScrypt(password, salt = crypto.randomBytes(SCRYPT_SALT_BYTES), pepper = "") {
  const plain = String(password || "");
  const safePepper = String(pepper || "");
  const material = safePepper ? `${plain}${safePepper}` : plain;
  const derived = crypto.scryptSync(material, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  });
  return [
    safePepper ? "scryptp" : "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    derived.toString("base64")
  ].join("$");
}

function verifyScryptHash(password, encoded, pepper = "") {
  if (typeof encoded !== "string" || (!encoded.startsWith("scrypt$") && !encoded.startsWith("scryptp$"))) {
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 6) {
    return false;
  }

  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
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
    const safePepper = String(pepper || "");
    const material = scheme === "scryptp" ? `${String(password || "")}${safePepper}` : String(password || "");
    actual = crypto.scryptSync(material, salt, expected.length, {
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

function verifyPasswordHash(password, storedHash, pepper = "") {
  const hash = String(storedHash || "").trim();
  if (!hash) {
    return false;
  }
  if (hash.startsWith("scryptp$")) {
    return verifyScryptHash(password, hash, pepper);
  }
  if (hash.startsWith("scrypt$")) {
    return verifyScryptHash(password, hash, "");
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
  return hash.startsWith("scrypt$") || hash.startsWith("scryptp$") || /^[a-f0-9]{64}$/i.test(hash);
}

function hashPasswordForStorage(password, pepper = "") {
  return hashPasswordScrypt(password, crypto.randomBytes(SCRYPT_SALT_BYTES), pepper);
}

function isScryptPepperedHash(hashValue) {
  return String(hashValue || "").trim().startsWith("scryptp$");
}

function validatePasswordStrength(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: "password_too_short" };
  }
  if (!/[a-zа-яё]/i.test(value)) {
    return { ok: false, code: "password_missing_letter" };
  }
  if (!/\d/.test(value)) {
    return { ok: false, code: "password_missing_digit" };
  }
  return { ok: true, code: "" };
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
  const { security, ...safeState } = state;
  return {
    ...safeState,
    users
  };
}

function sanitizeVersionForClient(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    id: entry.id,
    createdAt: entry.createdAt || null,
    trigger: entry.trigger || "draft",
    actorId: entry.actorId || null,
    actorName: entry.actorName || null,
    actorLogin: entry.actorLogin || null,
    actorRole: entry.actorRole || null,
    sourceUpdatedAt: entry.sourceUpdatedAt || null,
    sourcePublishedAt: entry.sourcePublishedAt || null,
    sourceLastPublishedBy: entry.sourceLastPublishedBy || null,
    sizeBytes: entry.sizeBytes ?? null
  };
}

function resolveSecurityConfig() {
  const adminLogin = normalizeLogin(process.env.ARTCOMM_CMS_ADMIN_LOGIN || DEFAULT_ADMIN_LOGIN) || DEFAULT_ADMIN_LOGIN;
  const adminPassword = String(process.env.ARTCOMM_CMS_ADMIN_PASSWORD || "");
  const adminPasswordHashRaw = String(process.env.ARTCOMM_CMS_ADMIN_PASSWORD_HASH || "").trim();
  const securityCodeword = String(process.env.ARTCOMM_CMS_SECURITY_CODEWORD || "");
  const securityCodewordHashRaw = String(process.env.ARTCOMM_CMS_SECURITY_CODEWORD_HASH || "").trim();
  const passwordPepper = String(process.env.ARTCOMM_CMS_PASSWORD_PEPPER || "");
  const hasAdminSecret = Boolean(adminPassword || adminPasswordHashRaw);
  const hasCodewordSecret = Boolean(securityCodeword || securityCodewordHashRaw);

  let adminPasswordHash = DEFAULT_ADMIN_PASSWORD_HASH_LEGACY;
  let isAdminSecretValid = false;
  if (adminPassword) {
    const strength = validatePasswordStrength(adminPassword);
    if (!strength.ok) {
      throw new Error(strength.code);
    }
    adminPasswordHash = hashPasswordForStorage(adminPassword, passwordPepper);
    isAdminSecretValid = true;
  } else if (adminPasswordHashRaw && isSupportedPasswordHashFormat(adminPasswordHashRaw)) {
    adminPasswordHash = adminPasswordHashRaw;
    isAdminSecretValid = true;
  }

  const isSecurityCodewordHashRawValid = /^[a-f0-9]{64}$/i.test(securityCodewordHashRaw);
  const securityCodewordHash = securityCodeword
    ? sha256(securityCodeword)
    : isSecurityCodewordHashRawValid
      ? securityCodewordHashRaw.toLowerCase()
      : DEFAULT_SECURITY_CODEWORD_HASH;
  const isCodewordSecretValid = Boolean(securityCodeword || isSecurityCodewordHashRawValid);

  return {
    adminLogin,
    adminPasswordHash,
    securityCodewordHash,
    passwordPepper,
    hasAdminSecret,
    hasCodewordSecret,
    isAdminSecretValid,
    isCodewordSecretValid
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

function createBaseState(securityConfig = null) {
  const content = cloneDeep(DEFAULT_CONTENT);
  return {
    version: CMS_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    publishedAt: null,
    users: cloneDeep(DEFAULT_USERS),
    security: {
      codewordHash: String(securityConfig?.securityCodewordHash || "").trim().toLowerCase()
    },
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

function normalizeTrustedPartners(content) {
  if (!content || typeof content !== "object") {
    return false;
  }

  const partners = content.home && content.home.trustedPartners;
  if (!Array.isArray(partners)) {
    return false;
  }

  let changed = false;
  content.home.trustedPartners = partners.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    if (String(item.logo || "").trim() === "/assets/logos/rosatom.png") {
      changed = true;
      return {
        ...item,
        logo: "/assets/logos/rosatom-white.png"
      };
    }

    return item;
  });

  return changed;
}

function normalizeFormatsModal(content) {
  if (!content || typeof content !== "object" || !Array.isArray(content.modals)) {
    return false;
  }

  const defaultFormatsEntry = Array.isArray(DEFAULT_CONTENT.modals)
    ? DEFAULT_CONTENT.modals.find((entry) => entry && entry.id === "formats")
    : null;

  if (!defaultFormatsEntry) {
    return false;
  }

  let changed = false;
  content.modals = content.modals.map((entry) => {
    if (!entry || entry.id !== "formats") {
      return entry;
    }

    const rawBodyHtml = String(entry.bodyHtml || "");
    const cleanedBodyHtml = rawBodyHtml
      .replace(/<p class=["']formats-modal-kicker["'][^>]*>[\s\S]*?<\/p>\s*/i, "")
      .replace(/<p class=["']section-kicker["'][^>]*>\s*Форматы работы\s*<\/p>\s*/i, "");
    const isLegacyBody = rawBodyHtml.includes("format-cards") && !rawBodyHtml.includes("format-showcase");
    const isLegacyTitle = String(entry.title || "").trim() === "Форматы работы";
    const needsKickerCleanup = cleanedBodyHtml !== rawBodyHtml;

    if (!isLegacyBody && !isLegacyTitle && !needsKickerCleanup) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      title: isLegacyTitle ? defaultFormatsEntry.title : entry.title,
      bodyHtml: isLegacyBody ? defaultFormatsEntry.bodyHtml : cleanedBodyHtml
    };
  });

  return changed;
}

function normalizeMediaStationReviewsModal(content) {
  if (!content || typeof content !== "object" || !Array.isArray(content.modals)) {
    return false;
  }

  const defaultReviewsEntry = Array.isArray(DEFAULT_CONTENT.modals)
    ? DEFAULT_CONTENT.modals.find((entry) => entry && entry.id === "ms-participants")
    : null;

  if (!defaultReviewsEntry) {
    return false;
  }

  let changed = false;
  content.modals = content.modals.map((entry) => {
    if (!entry || entry.id !== "ms-participants") {
      return entry;
    }

    const rawBodyHtml = String(entry.bodyHtml || "");
    const cleanedBodyHtml = rawBodyHtml
      .replace(/<div class=["']modal-review-media["'][^>]*>\s*<img[^>]*src=["']\/assets\/reviews\/[^"']+\.svg["'][^>]*>\s*<\/div>\s*/gi, "")
      .replace(/<div class=["']modal-review-media["'][^>]*>\s*<div class=["']modal-review-avatar-empty["'][\s\S]*?<\/div>\s*<\/div>\s*/gi, "");
    const rawTitle = String(entry.title || "").trim();
    const needsBodyUpgrade = !rawBodyHtml.includes("modal-review-card");
    const needsPlaceholderCleanup = cleanedBodyHtml !== rawBodyHtml;
    const needsTitleUpgrade = rawTitle === "Участники о проекте" || rawTitle === "Отзывы участников";

    if (!needsBodyUpgrade && !needsTitleUpgrade && !needsPlaceholderCleanup) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      title: needsTitleUpgrade ? defaultReviewsEntry.title : entry.title,
      bodyHtml: needsBodyUpgrade ? defaultReviewsEntry.bodyHtml : cleanedBodyHtml
    };
  });

  return changed;
}

function normalizeHomeIksPillars(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const iks = content.home.iks;
  if (!iks || typeof iks !== "object" || !Array.isArray(iks.pillars)) {
    return false;
  }

  const titleMap = new Map([
    ["организация", "Организация и процессы"],
    ["организация и процессы", "Организация и процессы"],
    ["компетенции", "Компетенции и роли"],
    ["компетенции и роли", "Компетенции и роли"],
    ["контент", "Контент и производство"],
    ["контент и производство", "Контент и производство"],
    ["охват", "Охват и каналы"],
    ["охват и каналы", "Охват и каналы"]
  ]);

  let changed = false;
  iks.pillars = iks.pillars.map((item, index) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const fallback = DEFAULT_CONTENT.home.iks.pillars[index];
    const sourceTitle = String(item.title || item.key || "").trim().toLowerCase();
    const normalizedTitle = titleMap.get(sourceTitle) || fallback?.title || item.title || item.key;
    const normalizedKey = titleMap.get(sourceTitle) || fallback?.key || item.key || normalizedTitle;

    if (item.title === normalizedTitle && item.key === normalizedKey) {
      return item;
    }

    changed = true;
    return {
      ...item,
      title: normalizedTitle,
      key: normalizedKey
    };
  });

  return changed;
}

function normalizeHomeExpertHeading(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const expert = content.home.expert;
  if (!expert || typeof expert !== "object") {
    return false;
  }

  if (String(expert.kicker || "").trim() === "Наши эксперты") {
    return false;
  }

  expert.kicker = "Наши эксперты";
  return true;
}

function normalizeContactsLegalLinks(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const section = content.home.contactsSection;
  if (!section || typeof section !== "object") {
    return false;
  }

  let changed = false;
  const policyLink = String(section.policyLink || "").trim();
  const newsLink = String(section.newsLink || "").trim();

  if (!policyLink || policyLink === CHARTER_FALLBACK_URL) {
    section.policyLink = PRIVACY_POLICY_URL;
    changed = true;
  }

  if (!newsLink || newsLink === CHARTER_FALLBACK_URL) {
    section.newsLink = MARKETING_CONSENT_URL;
    changed = true;
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
    ["mediaStation", "actions", 1],
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

function normalizeMediaStationActions(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const media = content.home.mediaStation;
  if (!media || typeof media !== "object") {
    return false;
  }

  const currentList = Array.isArray(media.actions) ? media.actions : [];
  const nextAction = {
    id: currentList[0]?.id || "ms-action-1",
    label: "Отзывы о МедиаСтанции",
    type: "modal",
    target: "ms-participants",
    variant: "primary",
    isPublished: true
  };

  const changed =
    currentList.length !== 1 ||
    JSON.stringify(currentList[0] || null) !== JSON.stringify(nextAction);

  if (changed) {
    media.actions = [nextAction];
  }

  return changed;
}

function normalizeProjectRoutingAndStats(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  let changed = false;

  const commonCta = content.home.common && content.home.common.cta;
  if (commonCta && typeof commonCta === "object" && String(commonCta.primaryTarget || "").trim() === "/projects") {
    commonCta.primaryTarget = "#ms";
    changed = true;
  }

  const mediaStats =
    content.home.mediaStation && Array.isArray(content.home.mediaStation.stats)
      ? content.home.mediaStation.stats
      : null;
  if (mediaStats && mediaStats[0] && mediaStats[0].label === "участников" && String(mediaStats[0].value || "").trim() === "996") {
    mediaStats[0].value = "969";
    changed = true;
  }
  if (mediaStats && mediaStats[4] && mediaStats[4].label === "медиапродуктов" && String(mediaStats[4].value || "").trim() === "5200") {
    mediaStats[4].value = "5 200";
    changed = true;
  }

  return changed;
}

function normalizeSecurityState(rawSecurity, securityConfig) {
  const fallbackHash = String(securityConfig?.securityCodewordHash || "").trim().toLowerCase();
  const currentHash = String(rawSecurity?.codewordHash || "").trim().toLowerCase();
  const codewordHash = isSha256Hex(currentHash) ? currentHash : fallbackHash;
  return {
    codewordHash
  };
}

function getEffectiveSecurityCodewordHash(state, securityConfig) {
  const stateHash = String(state?.security?.codewordHash || "").trim().toLowerCase();
  if (isSha256Hex(stateHash)) {
    return stateHash;
  }
  const configHash = String(securityConfig?.securityCodewordHash || "").trim().toLowerCase();
  if (isSha256Hex(configHash)) {
    return configHash;
  }
  return "";
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
  const fallback = createBaseState(securityConfig);
  const sourceUsers = Array.isArray(parsed?.users) && parsed.users.length ? parsed.users : fallback.users;
  const normalizedUsers = normalizeLoadedUsers(sourceUsers, securityConfig);
  const parsedSecurity = parsed?.security && typeof parsed.security === "object" ? parsed.security : null;

  const parsedDraft = parsed?.draft && typeof parsed.draft === "object" ? parsed.draft : null;
  const parsedPublished = parsed?.published && typeof parsed.published === "object" ? parsed.published : null;

  const merged = {
    ...fallback,
    ...parsed,
    security: normalizeSecurityState(parsedSecurity || fallback.security, securityConfig),
    users: normalizedUsers,
    draft: mergeWithDefaults(fallback.draft, parsedDraft || fallback.draft),
    published: mergeWithDefaults(fallback.published, parsedPublished || parsedDraft || fallback.published)
  };

  normalizeAboutDocuments(merged.draft);
  normalizeAboutDocuments(merged.published);
  normalizeHomeMediaSources(merged.draft);
  normalizeHomeMediaSources(merged.published);
  normalizeTrustedPartners(merged.draft);
  normalizeTrustedPartners(merged.published);
  normalizeContactsLegalLinks(merged.draft);
  normalizeContactsLegalLinks(merged.published);
  normalizeModals(merged.draft);
  normalizeModals(merged.published);
  normalizeFormatsModal(merged.draft);
  normalizeFormatsModal(merged.published);
  normalizeMediaStationReviewsModal(merged.draft);
  normalizeMediaStationReviewsModal(merged.published);
  normalizeMediaStationActions(merged.draft);
  normalizeMediaStationActions(merged.published);
  normalizeProjectRoutingAndStats(merged.draft);
  normalizeProjectRoutingAndStats(merged.published);
  normalizeHomeIksPillars(merged.draft);
  normalizeHomeIksPillars(merged.published);
  normalizeHomeExpertHeading(merged.draft);
  normalizeHomeExpertHeading(merged.published);
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
  const state = root[RUNTIME_STATE_KEY] || {};
  if (!(state.sessions instanceof Map)) {
    state.sessions = new Map();
  }
  if (!(state.loginGuards instanceof Map)) {
    state.loginGuards = new Map();
  }
  if (!(state.contactGuards instanceof Map)) {
    state.contactGuards = new Map();
  }
  if (!(state.sensitiveGuards instanceof Map)) {
    state.sensitiveGuards = new Map();
  }
  if (!("contactMailer" in state)) {
    state.contactMailer = null;
  }
  root[RUNTIME_STATE_KEY] = state;
  return state;
}

function extractClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.socket?.remoteAddress || "unknown");
}

export function createCmsApiHandler(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dataDir = path.resolve(process.env.ARTCOMM_CMS_DATA_DIR || path.join(rootDir, "cms-data"));
  const stateFile = path.join(dataDir, "state.json");
  const versionsDir = path.join(dataDir, "versions");
  const versionsIndexFile = path.join(versionsDir, "index.json");
  const versionLimit = clampVersionLimit(toInt(process.env.ARTCOMM_CMS_VERSION_LIMIT, DEFAULT_VERSION_LIMIT));
  const publicDir = path.resolve(process.env.ARTCOMM_CMS_PUBLIC_DIR || path.join(rootDir, "public"));
  const assetsDir = path.resolve(process.env.ARTCOMM_CMS_ASSETS_DIR || path.join(publicDir, "assets"));
  const securityConfig = resolveSecurityConfig();
  const contactConfig = resolveContactConfig();
  const contactLogFile = path.join(dataDir, "contact-submissions.jsonl");
  const requireEnvSecrets = parseBooleanFlag(process.env.ARTCOMM_CMS_REQUIRE_ENV_SECRETS, false);

  if (
    requireEnvSecrets &&
    (!securityConfig.hasAdminSecret || !securityConfig.hasCodewordSecret || !securityConfig.isAdminSecretValid || !securityConfig.isCodewordSecretValid)
  ) {
    throw new Error("missing_required_security_env");
  }

  const runtimeState = getRuntimeState();
  const sessions = runtimeState.sessions;
  const loginGuards = runtimeState.loginGuards;
  const contactGuards = runtimeState.contactGuards;
  const sensitiveGuards = runtimeState.sensitiveGuards;

  let writeChain = Promise.resolve();

  async function ensureStateFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    if (!fs.existsSync(stateFile)) {
      const initial = normalizeState(createBaseState(securityConfig), securityConfig);
      await fsp.writeFile(stateFile, JSON.stringify(initial, null, 2));
    }
  }

  async function readState() {
    await ensureStateFile();
    try {
      const raw = await fsp.readFile(stateFile, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeState(parsed, securityConfig);
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        await fsp.writeFile(stateFile, JSON.stringify(normalized, null, 2));
      }
      return normalized;
    } catch {
      return normalizeState(createBaseState(securityConfig), securityConfig);
    }
  }

  async function ensureVersionsStorage() {
    await fsp.mkdir(versionsDir, { recursive: true });
    if (!fs.existsSync(versionsIndexFile)) {
      // Индекс версий храним отдельно от state.json, чтобы откаты не конфликтовали с основным состоянием.
      await fsp.writeFile(versionsIndexFile, JSON.stringify([], null, 2));
    }
  }

  function normalizeVersionId(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value || !/^[a-z0-9][a-z0-9-]{5,80}$/i.test(value)) {
      throw new Error("invalid_version_id");
    }
    return value;
  }

  function sanitizeVersionEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const id = String(entry.id || "").trim();
    const fileName = path.basename(String(entry.fileName || "").trim());
    if (!id || !fileName || path.extname(fileName).toLowerCase() !== ".json") {
      return null;
    }

    const createdAt = String(entry.createdAt || "").trim() || nowIso();
    const trigger = String(entry.trigger || "").trim() || "draft";
    const actorId = String(entry.actorId || "").trim() || null;
    const actorName = String(entry.actorName || "").trim() || null;
    const actorLogin = String(entry.actorLogin || "").trim() || null;
    const actorRole = String(entry.actorRole || "").trim() || null;
    const checksum = String(entry.checksum || "").trim() || null;
    const sizeBytes = Number(entry.sizeBytes);

    return {
      id,
      createdAt,
      trigger,
      actorId,
      actorName,
      actorLogin,
      actorRole,
      sourceUpdatedAt: entry.sourceUpdatedAt || null,
      sourcePublishedAt: entry.sourcePublishedAt || null,
      sourceLastPublishedBy: entry.sourceLastPublishedBy || null,
      checksum,
      sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? Math.floor(sizeBytes) : null,
      fileName
    };
  }

  function isPublishVersionEntry(entry) {
    return entry && entry.trigger === "publish";
  }

  function sortVersions(list) {
    return [...list].sort((left, right) => {
      const leftTs = Date.parse(left.createdAt || "") || 0;
      const rightTs = Date.parse(right.createdAt || "") || 0;
      return rightTs - leftTs;
    });
  }

  async function readVersionsIndex() {
    await ensureVersionsStorage();
    try {
      const raw = await fsp.readFile(versionsIndexFile, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const safe = parsed.map(sanitizeVersionEntry).filter(Boolean);
      const publishedOnly = safe.filter(isPublishVersionEntry);
      if (publishedOnly.length !== safe.length) {
        await writeVersionsIndex(publishedOnly);
      }
      return sortVersions(publishedOnly).slice(0, versionLimit);
    } catch {
      return [];
    }
  }

  async function writeVersionsIndex(entries) {
    await ensureVersionsStorage();
    const prepared = sortVersions(entries.map(sanitizeVersionEntry).filter(isPublishVersionEntry)).slice(0, versionLimit);
    const tempFile = `${versionsIndexFile}.tmp`;
    await fsp.writeFile(tempFile, JSON.stringify(prepared, null, 2));
    await fsp.rename(tempFile, versionsIndexFile);
    return prepared;
  }

  function getVersionSnapshotPath(fileName) {
    const safeName = path.basename(String(fileName || "").trim());
    if (!safeName || path.extname(safeName).toLowerCase() !== ".json") {
      throw new Error("invalid_version_file");
    }
    const absoluteFile = path.resolve(versionsDir, safeName);
    const base = path.resolve(versionsDir);
    if (!absoluteFile.startsWith(base + path.sep) && absoluteFile !== base) {
      throw new Error("invalid_version_file");
    }
    return absoluteFile;
  }

  function prepareSnapshotPayload(nextState) {
    return {
      draft: cloneDeep(nextState.draft),
      published: cloneDeep(nextState.published),
      updatedAt: nextState.updatedAt || null,
      publishedAt: nextState.publishedAt || null,
      lastPublishedBy: nextState.lastPublishedBy || null
    };
  }

  async function createVersionSnapshot(nextState, snapshotMeta = {}) {
    await ensureVersionsStorage();
    // В снапшот складываем только данные CMS, без пользовательских паролей/служебных runtime-структур.
    const snapshotState = prepareSnapshotPayload(nextState);
    const checksum = sha256(JSON.stringify(snapshotState));
    const id = makeVersionId();
    const fileName = `${id}.json`;
    const createdAt = nowIso();
    const entry = sanitizeVersionEntry({
      id,
      createdAt,
      trigger: snapshotMeta.trigger || "publish",
      actorId: snapshotMeta.actorId || null,
      actorName: snapshotMeta.actorName || null,
      actorLogin: snapshotMeta.actorLogin || null,
      actorRole: snapshotMeta.actorRole || null,
      sourceUpdatedAt: nextState.updatedAt || null,
      sourcePublishedAt: nextState.publishedAt || null,
      sourceLastPublishedBy: nextState.lastPublishedBy || null,
      checksum,
      fileName
    });

    const payload = {
      meta: entry,
      state: snapshotState
    };
    const payloadText = JSON.stringify(payload, null, 2);
    entry.sizeBytes = Buffer.byteLength(payloadText, "utf8");

    const snapshotFile = getVersionSnapshotPath(fileName);
    const tempSnapshotFile = `${snapshotFile}.tmp`;
    await fsp.writeFile(tempSnapshotFile, payloadText);
    await fsp.rename(tempSnapshotFile, snapshotFile);

    const current = await readVersionsIndex();
    const unique = [entry, ...current.filter((item) => item.id !== entry.id)];
    const kept = unique.slice(0, versionLimit);
    const dropped = unique.slice(versionLimit);
    await writeVersionsIndex(kept);

    // Старые архивы удаляем физически, чтобы не раздувать дисковое хранилище.
    await Promise.all(
      dropped.map(async (item) => {
        try {
          await fsp.unlink(getVersionSnapshotPath(item.fileName));
        } catch {
          // Ignore cleanup failures.
        }
      })
    );

    return entry;
  }

  async function loadVersionSnapshot(versionId) {
    const id = normalizeVersionId(versionId);
    const versions = await readVersionsIndex();
    const entry = versions.find((item) => item.id === id);
    if (!entry) {
      throw new Error("version_not_found");
    }

    const snapshotFile = getVersionSnapshotPath(entry.fileName);
    let parsed;
    try {
      const raw = await fsp.readFile(snapshotFile, "utf8");
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("version_corrupted");
    }

    const snapshotState = parsed && typeof parsed === "object" ? parsed.state : null;
    if (!snapshotState || typeof snapshotState !== "object") {
      throw new Error("version_corrupted");
    }
    if (!snapshotState.draft || typeof snapshotState.draft !== "object") {
      throw new Error("version_corrupted");
    }
    if (!snapshotState.published || typeof snapshotState.published !== "object") {
      throw new Error("version_corrupted");
    }

    return {
      entry,
      snapshotState
    };
  }

  async function deleteVersion(versionId) {
    const id = normalizeVersionId(versionId);
    const versions = await readVersionsIndex();
    const target = versions.find((item) => item.id === id);
    if (!target) {
      throw new Error("version_not_found");
    }
    const nextVersions = versions.filter((item) => item.id !== id);
    await writeVersionsIndex(nextVersions);
    try {
      await fsp.unlink(getVersionSnapshotPath(target.fileName));
    } catch {
      // Ignore missing file during cleanup.
    }
    return sortVersions(nextVersions);
  }

  function queueWrite(state, options = {}) {
    const next = normalizeState(state, securityConfig);
    const snapshot = options && options.snapshot && typeof options.snapshot === "object" ? options.snapshot : null;
    let snapshotEntry = null;

    writeChain = writeChain
      .then(async () => {
        await ensureStateFile();
        const tempFile = `${stateFile}.tmp`;
        await fsp.writeFile(tempFile, JSON.stringify(next, null, 2));
        await fsp.rename(tempFile, stateFile);
        if (snapshot) {
          // Снапшот создаётся строго после успешной записи state — в архив не попадает "битая" версия.
          snapshotEntry = await createVersionSnapshot(next, snapshot);
        }
      })
      .catch(() => {});

    if (options.withMeta) {
      return writeChain.then(() => ({ state: next, snapshot: snapshotEntry }));
    }
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

  function cleanupContactGuards() {
    const now = Date.now();
    for (const [key, entry] of contactGuards.entries()) {
      if (!entry) {
        contactGuards.delete(key);
        continue;
      }

      const recent = Array.isArray(entry.attempts)
        ? entry.attempts.filter((stamp) => Number.isFinite(stamp) && now - stamp <= CONTACT_WINDOW_MS)
        : [];
      const lockUntil = Number(entry.lockUntil) || 0;

      if (!recent.length && lockUntil <= now) {
        contactGuards.delete(key);
      } else {
        contactGuards.set(key, { attempts: recent, lockUntil });
      }
    }
  }

  function getContactGuard(req) {
    cleanupContactGuards();
    const key = extractClientIp(req);
    const entry = contactGuards.get(key);
    if (!entry) {
      return { key, attempts: [], lockUntil: 0 };
    }
    return {
      key,
      attempts: Array.isArray(entry.attempts) ? entry.attempts.slice() : [],
      lockUntil: Number(entry.lockUntil) || 0
    };
  }

  function setContactGuard(next) {
    if (!next || !next.key) {
      return;
    }
    contactGuards.set(next.key, {
      attempts: Array.isArray(next.attempts) ? next.attempts.slice() : [],
      lockUntil: Number(next.lockUntil) || 0
    });
  }

  function cleanupSensitiveGuards() {
    const now = Date.now();
    for (const [key, entry] of sensitiveGuards.entries()) {
      if (!entry) {
        sensitiveGuards.delete(key);
        continue;
      }
      const lockUntil = Number(entry.lockUntil) || 0;
      const lastFailedAt = Number(entry.lastFailedAt) || 0;
      const isStale = !lockUntil && lastFailedAt > 0 && now - lastFailedAt > SENSITIVE_COOLDOWN_MS;
      if (lockUntil <= now && !Number(entry.failedAttempts) && !lastFailedAt) {
        sensitiveGuards.delete(key);
      } else if (isStale) {
        sensitiveGuards.delete(key);
      }
    }
  }

  function getSensitiveGuard(req, sessionUserId) {
    cleanupSensitiveGuards();
    const key = `${extractClientIp(req)}::${String(sessionUserId || "unknown")}`;
    const entry = sensitiveGuards.get(key);
    if (!entry) {
      return { key, failedAttempts: 0, lockUntil: 0, lastFailedAt: 0 };
    }
    return {
      key,
      failedAttempts: Number(entry.failedAttempts) || 0,
      lockUntil: Number(entry.lockUntil) || 0,
      lastFailedAt: Number(entry.lastFailedAt) || 0
    };
  }

  function setSensitiveGuard(next) {
    if (!next || !next.key) {
      return;
    }
    sensitiveGuards.set(next.key, {
      failedAttempts: Number(next.failedAttempts) || 0,
      lockUntil: Number(next.lockUntil) || 0,
      lastFailedAt: Number(next.lastFailedAt) || 0
    });
  }

  function clearSensitiveGuard(req, sessionUserId) {
    const key = `${extractClientIp(req)}::${String(sessionUserId || "unknown")}`;
    sensitiveGuards.delete(key);
  }

  function toBool(value) {
    return value === true || value === "true" || value === "1" || value === 1 || value === "on";
  }

  function normalizeContactRequest(rawBody) {
    const body = rawBody && typeof rawBody === "object" ? rawBody : {};
    const name = cleanSingleLine(body.name, CONTACT_NAME_MAX);
    const email = cleanSingleLine(body.contact, CONTACT_EMAIL_MAX).toLowerCase();
    const message = cleanMultiline(body.message, CONTACT_MESSAGE_MAX);
    const policyAccepted = toBool(body.policyAccepted);
    const newsletterAccepted = toBool(body.newsletterAccepted);
    const honeypot = cleanSingleLine(body.website, 180);

    if (!name || !email || !message) {
      throw new Error("invalid_payload");
    }
    if (!isValidEmail(email)) {
      throw new Error("invalid_email");
    }
    if (!policyAccepted) {
      throw new Error("invalid_policy");
    }

    return {
      name,
      email,
      message,
      policyAccepted,
      newsletterAccepted,
      honeypot
    };
  }

  async function appendContactLog(entry) {
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.appendFile(contactLogFile, `${JSON.stringify(entry)}\n`, "utf8");
  }

  function buildContactEmailHtml(payload, metadata) {
    const escapeLineBreaks = (value) => escapeHtml(value).replace(/\n/g, "<br>");
    const rows = [
      ["Имя", escapeHtml(payload.name)],
      ["Email", escapeHtml(payload.email)],
      ["Сообщение", escapeLineBreaks(payload.message)],
      ["Согласие на ПДн", payload.policyAccepted ? "Да" : "Нет"],
      ["Согласие на рассылку", payload.newsletterAccepted ? "Да" : "Нет"],
      ["IP", escapeHtml(metadata.ip)],
      ["Дата", escapeHtml(metadata.createdAt)],
      ["User-Agent", escapeHtml(metadata.userAgent || "")]
    ];

    const rowsHtml = rows
      .map(([key, value]) => {
        return `<tr><td style="padding:8px;border:1px solid #c9d4e2;background:#f6f8fc;font-weight:600;">${key}</td><td style="padding:8px;border:1px solid #c9d4e2;">${value}</td></tr>`;
      })
      .join("");

    return `<div style="font-family:Arial,sans-serif;color:#1a2d45;"><h2 style="margin:0 0 12px;">Новая заявка с формы «Написать нам»</h2><table style="border-collapse:collapse;width:100%;max-width:820px;">${rowsHtml}</table></div>`;
  }

  function getContactTransport() {
    if (runtimeState.contactMailer) {
      return runtimeState.contactMailer;
    }

    runtimeState.contactMailer = nodemailer.createTransport({
      host: contactConfig.smtpHost,
      port: contactConfig.smtpPort,
      secure: contactConfig.smtpSecure,
      auth:
        contactConfig.smtpUser && contactConfig.smtpPass
          ? {
              user: contactConfig.smtpUser,
              pass: contactConfig.smtpPass
            }
          : undefined
    });
    return runtimeState.contactMailer;
  }

  function isSmtpConfigured() {
    return Boolean(
      contactConfig.smtpHost &&
        Number.isFinite(contactConfig.smtpPort) &&
        contactConfig.mailTo.length &&
        contactConfig.mailFrom &&
        contactConfig.smtpUser &&
        contactConfig.smtpPass
    );
  }

  async function deliverContactMessage(payload, metadata) {
    const subject = `Заявка с сайта АртКомм: ${payload.name}`;

    if (contactConfig.mode === "smtp") {
      if (!isSmtpConfigured()) {
        throw new Error("service_unavailable");
      }
      const transporter = getContactTransport();
      const text = [
        "Новая заявка с формы «Написать нам»",
        "",
        `Имя: ${payload.name}`,
        `Email: ${payload.email}`,
        `Сообщение: ${payload.message}`,
        `Согласие на ПДн: ${payload.policyAccepted ? "Да" : "Нет"}`,
        `Согласие на рассылку: ${payload.newsletterAccepted ? "Да" : "Нет"}`,
        `IP: ${metadata.ip}`,
        `Дата: ${metadata.createdAt}`,
        `User-Agent: ${metadata.userAgent || ""}`
      ].join("\n");

      await transporter.sendMail({
        from: contactConfig.mailFrom,
        to: contactConfig.mailTo.join(", "),
        cc: contactConfig.mailCc.length ? contactConfig.mailCc.join(", ") : undefined,
        replyTo: payload.email,
        subject,
        text,
        html: buildContactEmailHtml(payload, metadata)
      });
      return;
    }

    await appendContactLog({
      id: metadata.id,
      createdAt: metadata.createdAt,
      ip: metadata.ip,
      userAgent: metadata.userAgent || "",
      payload
    });
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

  function registerSensitiveFailure(req, sessionUserId) {
    const now = Date.now();
    const guard = getSensitiveGuard(req, sessionUserId);
    const isWithinWindow = guard.lastFailedAt > 0 && now - guard.lastFailedAt <= SENSITIVE_COOLDOWN_MS;
    const baseAttempts = isWithinWindow ? guard.failedAttempts || 0 : 0;
    const failedAttempts = baseAttempts + 1;
    const lockUntil = failedAttempts >= SENSITIVE_ATTEMPT_LIMIT ? now + SENSITIVE_COOLDOWN_MS : 0;
    setSensitiveGuard({
      ...guard,
      failedAttempts,
      lockUntil,
      lastFailedAt: now
    });
    return {
      locked: lockUntil > now,
      retryAt: lockUntil || null
    };
  }

  async function validateSecurityGate(req, state, session, gateRaw) {
    const gate = readSecurityGate(gateRaw);
    if (!gate) {
      return { ok: false, status: 400, error: "invalid_gate" };
    }

    const now = Date.now();
    const guard = getSensitiveGuard(req, session.id);
    if (guard.lockUntil > now) {
      return { ok: false, status: 429, error: "locked", retryAt: guard.lockUntil };
    }

    if (!hashEqualsHex(sha256(gate.codeword), getEffectiveSecurityCodewordHash(state, securityConfig))) {
      const failed = registerSensitiveFailure(req, session.id);
      return { ok: false, status: failed.locked ? 429 : 403, error: failed.locked ? "locked" : "invalid_codeword", retryAt: failed.retryAt };
    }

    const verifiedUser = await verifyCredentials(state, gate.authLogin, gate.authPassword);
    if (!verifiedUser) {
      const failed = registerSensitiveFailure(req, session.id);
      return { ok: false, status: failed.locked ? 429 : 403, error: failed.locked ? "locked" : "invalid_auth", retryAt: failed.retryAt };
    }

    if (verifiedUser.id !== gate.sessionUserId || verifiedUser.role !== ROLE_ADMIN || session.id !== gate.sessionUserId) {
      const failed = registerSensitiveFailure(req, session.id);
      return { ok: false, status: failed.locked ? 429 : 403, error: failed.locked ? "locked" : "forbidden", retryAt: failed.retryAt };
    }

    clearSensitiveGuard(req, session.id);
    return { ok: true, gate };
  }

  async function verifyCredentials(state, login, password) {
    const normalizedLogin = normalizeLogin(login);
    const user = state.users.find((item) => {
      if (!item || item.login !== normalizedLogin) {
        return false;
      }
      if (item.passwordHash) {
        return verifyPasswordHash(password, item.passwordHash, securityConfig.passwordPepper);
      }
      return item.password === password;
    });
    if (!user) {
      return null;
    }

    const currentHash = String(user.passwordHash || "");
    const shouldRehash =
      !currentHash ||
      !currentHash.startsWith("scrypt") ||
      (Boolean(securityConfig.passwordPepper) && !isScryptPepperedHash(currentHash)) ||
      user.password;

    if (shouldRehash) {
      const passwordHash = hashPasswordForStorage(password, securityConfig.passwordPepper);
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

      if (pathname === "/api/cms/contact" && method === "POST") {
        if (!isSameOriginRequest(req)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const guard = getContactGuard(req);
        const now = Date.now();
        if (guard.lockUntil > now) {
          sendJson(res, 429, { ok: false, error: "locked", retryAt: guard.lockUntil });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_CONTACT_PAYLOAD_BYTES });
        const payload = normalizeContactRequest(body);

        const recentAttempts = guard.attempts.filter((stamp) => now - stamp <= CONTACT_WINDOW_MS);
        if (recentAttempts.length >= CONTACT_ATTEMPT_LIMIT) {
          const lockUntil = now + CONTACT_COOLDOWN_MS;
          setContactGuard({
            key: guard.key,
            attempts: recentAttempts,
            lockUntil
          });
          sendJson(res, 429, { ok: false, error: "locked", retryAt: lockUntil });
          return true;
        }

        if (payload.honeypot) {
          setContactGuard({
            key: guard.key,
            attempts: [...recentAttempts, now],
            lockUntil: 0
          });
          sendJson(res, 200, { ok: true, ignored: true });
          return true;
        }

        const metadata = {
          id: crypto.randomBytes(12).toString("hex"),
          ip: extractClientIp(req),
          userAgent: cleanSingleLine(req.headers["user-agent"] || "", 260),
          createdAt: nowIso()
        };

        try {
          await deliverContactMessage(payload, metadata);
        } catch (error) {
          await appendContactLog({
            id: metadata.id,
            createdAt: metadata.createdAt,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
            deliveryError: error instanceof Error ? error.message : "delivery_failed",
            payload
          });

          if (contactConfig.mode === "smtp") {
            sendJson(res, 503, { ok: false, error: "service_unavailable" });
            return true;
          }
        }

        setContactGuard({
          key: guard.key,
          attempts: [...recentAttempts, now],
          lockUntil: 0
        });
        sendJson(res, 200, { ok: true });
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

      if (pathname === "/api/cms/versions" && method === "GET") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        const versions = await readVersionsIndex();
        sendJson(res, 200, {
          ok: true,
          versions: versions.map(sanitizeVersionForClient).filter(Boolean),
          limit: versionLimit
        });
        return true;
      }

      if (pathname === "/api/cms/versions/rollback" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const versionId = body && typeof body === "object" ? body.versionId : null;
        if (!versionId) {
          sendJson(res, 400, { ok: false, error: "invalid_version_id" });
          return true;
        }

        const loaded = await loadVersionSnapshot(versionId);
        const state = await readState();
        // Откат восстанавливает обе ветки: и черновик, и опубликованную версию,
        // чтобы интерфейс админки и публичный сайт не расходились по данным.
        state.draft = mergeWithDefaults(DEFAULT_CONTENT, loaded.snapshotState.draft);
        state.published = mergeWithDefaults(DEFAULT_CONTENT, loaded.snapshotState.published);
        normalizeAboutDocuments(state.draft);
        normalizeAboutDocuments(state.published);
        normalizeHomeMediaSources(state.draft);
        normalizeHomeMediaSources(state.published);
        normalizeTrustedPartners(state.draft);
        normalizeTrustedPartners(state.published);
        normalizeContactsLegalLinks(state.draft);
        normalizeContactsLegalLinks(state.published);
        normalizeModals(state.draft);
        normalizeModals(state.published);
        normalizeFormatsModal(state.draft);
        normalizeFormatsModal(state.published);
        normalizeMediaStationReviewsModal(state.draft);
        normalizeMediaStationReviewsModal(state.published);
        normalizeMediaStationActions(state.draft);
        normalizeMediaStationActions(state.published);
        normalizeProjectRoutingAndStats(state.draft);
        normalizeProjectRoutingAndStats(state.published);
        normalizeHomeIksPillars(state.draft);
        normalizeHomeIksPillars(state.published);
        normalizeHomeExpertHeading(state.draft);
        normalizeHomeExpertHeading(state.published);
        normalizeActionLimits(state.draft);
        normalizeActionLimits(state.published);
        state.publishedAt = nowIso();
        state.updatedAt = nowIso();
        state.lastPublishedBy = session.id;

        const saved = await queueWrite(state);
        const versions = await readVersionsIndex();
        sendJson(res, 200, {
          ok: true,
          state: sanitizeStateForClient(saved),
          versions: versions.map(sanitizeVersionForClient).filter(Boolean)
        });
        return true;
      }

      if (pathname === "/api/cms/versions/delete" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const versionId = body && typeof body === "object" ? body.versionId : null;
        if (!versionId) {
          sendJson(res, 400, { ok: false, error: "invalid_version_id" });
          return true;
        }

        const versions = await deleteVersion(versionId);
        sendJson(res, 200, {
          ok: true,
          versions: versions.map(sanitizeVersionForClient).filter(Boolean)
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
        normalizeTrustedPartners(state.draft);
        normalizeModals(state.draft);
        normalizeFormatsModal(state.draft);
        normalizeMediaStationReviewsModal(state.draft);
        normalizeMediaStationActions(state.draft);
        normalizeProjectRoutingAndStats(state.draft);
        normalizeHomeIksPillars(state.draft);
        normalizeHomeExpertHeading(state.draft);
        normalizeActionLimits(state.draft);
        state.updatedAt = nowIso();

        // Черновик сохраняем без записи в историю версий.
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
        normalizeTrustedPartners(state.published);
        normalizeModals(state.published);
        normalizeFormatsModal(state.published);
        normalizeMediaStationReviewsModal(state.published);
        normalizeMediaStationActions(state.published);
        normalizeProjectRoutingAndStats(state.published);
        normalizeHomeIksPillars(state.published);
        normalizeHomeExpertHeading(state.published);
        normalizeActionLimits(state.published);
        state.publishedAt = nowIso();
        state.updatedAt = nowIso();
        state.lastPublishedBy = session.id;

        // Публикация тоже уходит в историю версий отдельной записью.
        const saved = await queueWrite(state, {
          snapshot: {
            trigger: "publish",
            actorId: session.id,
            actorName: session.name,
            actorLogin: session.login,
            actorRole: session.role
          }
        });
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
        const validation = await validateSecurityGate(req, state, session, body.gate);
        if (!validation.ok) {
          sendJson(res, validation.status, { ok: false, error: validation.error, retryAt: validation.retryAt || null });
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

        if (!userId || !password || !gate) {
          sendJson(res, 400, { ok: false, error: "invalid_payload" });
          return true;
        }
        const passwordStrength = validatePasswordStrength(password);
        if (!passwordStrength.ok) {
          sendJson(res, 400, { ok: false, error: passwordStrength.code });
          return true;
        }

        const state = await readState();
        const validation = await validateSecurityGate(req, state, session, gate);
        if (!validation.ok) {
          sendJson(res, validation.status, { ok: false, error: validation.error, retryAt: validation.retryAt || null });
          return true;
        }

        const targetExists = state.users.some((user) => user.id === userId);
        if (!targetExists) {
          sendJson(res, 404, { ok: false, error: "user_not_found" });
          return true;
        }

        const hashed = hashPasswordForStorage(password, securityConfig.passwordPepper);
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

      if (pathname === "/api/cms/security-codeword" && method === "POST") {
        const session = await requireSession(req, res);
        if (!session) {
          return true;
        }
        if (!canManageUsers(session.role)) {
          sendJson(res, 403, { ok: false, error: "forbidden" });
          return true;
        }

        const body = await readJsonBody(req, { maxBytes: MAX_AUTH_PAYLOAD_BYTES });
        const codeword = String(body.codeword || "").trim();
        const gate = body.gate;

        if (!codeword || !gate) {
          sendJson(res, 400, { ok: false, error: "invalid_payload" });
          return true;
        }

        const state = await readState();
        const validation = await validateSecurityGate(req, state, session, gate);
        if (!validation.ok) {
          sendJson(res, validation.status, { ok: false, error: validation.error, retryAt: validation.retryAt || null });
          return true;
        }

        state.security = {
          ...state.security,
          codewordHash: sha256(codeword)
        };
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
          : message === "missing_required_security_env"
            ? 503
          : message === "version_not_found"
            ? 404
            : message === "version_corrupted"
              ? 409
          : message === "service_unavailable"
            ? 503
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
              "invalid_gate",
              "invalid_email",
              "invalid_policy",
              "invalid_version_id",
              "invalid_version_file",
              "password_too_short",
              "password_missing_letter",
              "password_missing_digit"
            ].includes(message)
            ? 400
            : 500;
      sendJson(res, status, { ok: false, error: message });
      return true;
    }
  };
}
