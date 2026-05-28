import {
  CMS_VERSION,
  DEFAULT_CONTENT,
  DEFAULT_USERS,
  ROLE_ADMIN,
  ROLE_EDITOR,
  ROLE_VIEWER,
  cloneDeep
} from "./defaultContent";

export { ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER };

const STORAGE_KEY = "artcomm.cms.state.v1";
const SESSION_KEY = "artcomm.cms.session.v1";
const LOGIN_GUARD_KEY = "artcomm.cms.login-guard.v1";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_ATTEMPT_LIMIT = 6;
const LOGIN_COOLDOWN_MS = 1000 * 60 * 5;
const ADMIN_ID = "admin-1";
const REQUIRED_ADMIN_LOGIN = "admin";
const CHARTER_FALLBACK_URL = "/assets/ustav-artkommunikacii.pdf";
const REQUIRED_ADMIN_PASSWORD_HASH = "f6ee94ecb014f74f887b9dcc52daecf73ab3e3333320cadd98bcb59d895c52f5";
const LEGACY_ADMIN_PASSWORD_HASH = "893cbcc2f9197dce1feea7c1e80486f27ae0be699408157d744928b600a7e82b";
const SECURITY_CODEWORD_HASH = "8fd706e21340a5033ccd4270f22c051de24cabb6b1c4c3ad8f61dc7fb8ad22d6";
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
const CMS_API_BASE = "/api/cms";
const REMOTE_DRAFT_SYNC_DELAY_MS = 450;

let draftSyncTimer = null;
let draftSyncPromise = Promise.resolve(null);
let queuedDraftSnapshot = null;

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

function hasWindowStorage() {
  return typeof window !== "undefined" && window.localStorage;
}

function hasFetchApi() {
  return typeof fetch === "function";
}

function cacheStateRaw(nextState) {
  if (!hasWindowStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function cacheSessionRaw(session) {
  if (!hasWindowStorage()) {
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSessionRaw() {
  if (!hasWindowStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

class CmsApiError extends Error {
  constructor(code, retryAt = null) {
    super(code || "cms_api_error");
    this.name = "CmsApiError";
    this.code = code || "cms_api_error";
    this.retryAt = retryAt;
  }
}

async function requestCms(path, { method = "GET", body, allowUnauthorized = false } = {}) {
  const response = await fetch(`${CMS_API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const errorCode = String(payload.error || response.status || "cms_api_error");
    if (allowUnauthorized && (response.status === 401 || errorCode === "unauthorized")) {
      return { ok: false, unauthorized: true, payload };
    }
    throw new CmsApiError(errorCode, payload.retryAt || null);
  }

  return { ok: true, payload };
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

function normalizeLoadedUsers(rawUsers) {
  const users = Array.isArray(rawUsers) ? cloneDeep(rawUsers) : [];
  if (!users.length) {
    return cloneDeep(DEFAULT_USERS);
  }

  const adminIndex = users.findIndex((user) => user && user.id === ADMIN_ID);
  if (adminIndex >= 0) {
    const currentAdmin = users[adminIndex];
    const nextAdmin = {
      ...currentAdmin,
      id: ADMIN_ID,
      login: REQUIRED_ADMIN_LOGIN,
      role: ROLE_ADMIN
    };

    const shouldSetRequiredPassword =
      !nextAdmin.passwordHash ||
      nextAdmin.passwordHash === LEGACY_ADMIN_PASSWORD_HASH ||
      nextAdmin.password === "artcomm-admin-2026";

    if (shouldSetRequiredPassword) {
      nextAdmin.passwordHash = REQUIRED_ADMIN_PASSWORD_HASH;
      delete nextAdmin.password;
    }

    users[adminIndex] = nextAdmin;
    return users;
  }

  users.unshift({
    ...cloneDeep(DEFAULT_USERS[0]),
    id: ADMIN_ID,
    login: REQUIRED_ADMIN_LOGIN,
    role: ROLE_ADMIN,
    passwordHash: REQUIRED_ADMIN_PASSWORD_HASH
  });
  return users;
}

function normalizeState(parsed) {
  const fallback = createBaseState();
  const sourceUsers = Array.isArray(parsed?.users) && parsed.users.length ? parsed.users : fallback.users;
  const normalizedUsers = normalizeLoadedUsers(sourceUsers);

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

export async function hashPassword(password) {
  const plain = String(password || "");
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    const data = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 2166136261;
  for (let i = 0; i < plain.length; i += 1) {
    hash ^= plain.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function loadLoginGuard() {
  if (!hasWindowStorage()) {
    return { failedAttempts: 0, lockUntil: 0 };
  }

  try {
    const raw = window.localStorage.getItem(LOGIN_GUARD_KEY);
    if (!raw) {
      return { failedAttempts: 0, lockUntil: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      failedAttempts: Number(parsed?.failedAttempts) || 0,
      lockUntil: Number(parsed?.lockUntil) || 0
    };
  } catch {
    return { failedAttempts: 0, lockUntil: 0 };
  }
}

function saveLoginGuard(guard) {
  if (!hasWindowStorage()) {
    return;
  }
  window.localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(guard));
}

function isLockedOut() {
  const guard = loadLoginGuard();
  const now = Date.now();
  return guard.lockUntil > now ? guard : null;
}

function registerFailedAttempt() {
  const guard = loadLoginGuard();
  const failedAttempts = guard.failedAttempts + 1;
  const lockUntil = failedAttempts >= LOGIN_ATTEMPT_LIMIT ? Date.now() + LOGIN_COOLDOWN_MS : 0;
  saveLoginGuard({ failedAttempts, lockUntil });
}

function resetFailedAttempts() {
  saveLoginGuard({ failedAttempts: 0, lockUntil: 0 });
}

function queueRemoteDraftSync(snapshotDraft) {
  if (!hasFetchApi()) {
    return;
  }
  const session = getSession();
  if (!session || !canEdit(session.role)) {
    return;
  }

  queuedDraftSnapshot = cloneDeep(snapshotDraft);
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer);
  }

  draftSyncTimer = setTimeout(() => {
    const nextDraft = queuedDraftSnapshot ? cloneDeep(queuedDraftSnapshot) : null;
    queuedDraftSnapshot = null;
    if (!nextDraft) {
      return;
    }

    draftSyncPromise = requestCms("/draft", {
      method: "POST",
      body: { draft: nextDraft },
      allowUnauthorized: true
    })
      .then((result) => {
        if (result?.ok && result.payload?.state) {
          cacheStateRaw(normalizeState(result.payload.state));
          return result.payload.state;
        }
        return null;
      })
      .catch(() => null);
  }, REMOTE_DRAFT_SYNC_DELAY_MS);
}

export async function flushDraftSync() {
  if (!hasFetchApi()) {
    return loadCmsState();
  }

  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = null;
    const pending = queuedDraftSnapshot ? cloneDeep(queuedDraftSnapshot) : null;
    queuedDraftSnapshot = null;
    if (pending) {
      try {
        const result = await requestCms("/draft", {
          method: "POST",
          body: { draft: pending },
          allowUnauthorized: true
        });
        if (result?.ok && result.payload?.state) {
          const normalized = normalizeState(result.payload.state);
          cacheStateRaw(normalized);
          return normalized;
        }
      } catch {
        // keep local draft cache when remote not reachable
      }
    }
  }

  try {
    await draftSyncPromise;
  } catch {
    // no-op
  }

  return loadCmsState();
}

export async function refreshCmsStateFromServer() {
  if (!hasFetchApi()) {
    return null;
  }

  try {
    const result = await requestCms("/state", { method: "GET", allowUnauthorized: true });
    if (!result.ok || result.unauthorized) {
      return null;
    }

    if (result.payload?.session) {
      cacheSessionRaw(result.payload.session);
    }

    if (result.payload?.state) {
      const normalized = normalizeState(result.payload.state);
      cacheStateRaw(normalized);
      return normalized;
    }
  } catch {
    return null;
  }

  return null;
}

export async function restoreSessionFromServer() {
  if (!hasFetchApi()) {
    return null;
  }

  try {
    const result = await requestCms("/session", { method: "GET", allowUnauthorized: true });
    if (!result.ok || result.unauthorized || !result.payload?.session) {
      return null;
    }

    const session = result.payload.session;
    cacheSessionRaw(session);

    let normalizedState = null;
    if (result.payload?.state) {
      normalizedState = normalizeState(result.payload.state);
      cacheStateRaw(normalizedState);
    }

    resetFailedAttempts();
    return {
      session,
      state: normalizedState
    };
  } catch {
    return null;
  }
}

export async function fetchPublishedContentFromServer() {
  if (!hasFetchApi()) {
    return null;
  }
  try {
    const result = await requestCms("/published", { method: "GET" });
    if (!result.ok) {
      return null;
    }
    const content = result.payload?.content;
    if (!content || typeof content !== "object") {
      return null;
    }
    return mergeWithDefaults(DEFAULT_CONTENT, content);
  } catch {
    return null;
  }
}

export function loadCmsState() {
  if (!hasWindowStorage()) {
    return createBaseState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createBaseState();
      saveCmsState(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      const initial = createBaseState();
      saveCmsState(initial);
      return initial;
    }

    const merged = normalizeState(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(merged)) {
      cacheStateRaw(merged);
    }

    return merged;
  } catch {
    const initial = createBaseState();
    saveCmsState(initial);
    return initial;
  }
}

export function saveCmsState(nextState) {
  if (!hasWindowStorage()) {
    return;
  }
  const prepared = {
    ...nextState,
    updatedAt: nowIso()
  };
  cacheStateRaw(prepared);
}

export function getCmsContent() {
  return loadCmsState();
}

export function getPublishedContent() {
  const state = loadCmsState();
  return cloneDeep(state.published);
}

export async function publishDraft(userId) {
  await flushDraftSync();

  const state = loadCmsState();
  state.published = cloneDeep(state.draft);
  normalizeAboutDocuments(state.published);
  normalizeHomeMediaSources(state.published);
  normalizeModals(state.published);
  normalizeActionLimits(state.published);
  state.publishedAt = nowIso();
  state.updatedAt = nowIso();
  state.lastPublishedBy = userId || null;
  saveCmsState(state);

  if (!hasFetchApi()) {
    return state;
  }

  try {
    const result = await requestCms("/publish", {
      method: "POST",
      body: { userId: userId || null },
      allowUnauthorized: true
    });
    if (result.ok && result.payload?.state) {
      const normalized = normalizeState(result.payload.state);
      cacheStateRaw(normalized);
      return normalized;
    }
  } catch {
    // keep local publish when server unavailable
  }

  return state;
}

export function resetCms() {
  const initial = createBaseState();
  saveCmsState(initial);
  clearSession();
  resetFailedAttempts();
  return initial;
}

export function saveDraft(mutator) {
  const state = loadCmsState();
  const nextDraft = typeof mutator === "function" ? mutator(cloneDeep(state.draft)) : state.draft;
  state.draft = nextDraft;
  normalizeAboutDocuments(state.draft);
  normalizeHomeMediaSources(state.draft);
  normalizeModals(state.draft);
  normalizeActionLimits(state.draft);
  state.updatedAt = nowIso();
  saveCmsState(state);
  queueRemoteDraftSync(state.draft);
  return state;
}

function normalizeUsersInput(nextUsers) {
  const usedLogins = new Set();
  const roles = new Set([ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER]);

  return normalizeLoadedUsers((nextUsers || []).map((user, index) => {
    const isAdmin = user && user.id === ADMIN_ID;
    const baseLogin = String(isAdmin ? REQUIRED_ADMIN_LOGIN : user?.login || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const fallbackLogin = `user${index + 1}`;
    let loginCandidate = baseLogin || fallbackLogin;

    if (!isAdmin && loginCandidate === REQUIRED_ADMIN_LOGIN) {
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
      passwordHash: user.passwordHash || ""
    };
    if (isAdmin) {
      normalized.role = ROLE_ADMIN;
      normalized.login = REQUIRED_ADMIN_LOGIN;
    }
    return normalized;
  }));
}

export function setUsers(nextUsers) {
  const state = loadCmsState();
  state.users = normalizeUsersInput(nextUsers);
  saveCmsState(state);
  return state;
}

export async function setUsersRemote(nextUsers) {
  const localState = setUsers(nextUsers);
  if (!hasFetchApi()) {
    return localState;
  }

  try {
    const result = await requestCms("/users", {
      method: "POST",
      body: { users: localState.users },
      allowUnauthorized: true
    });
    if (result.ok && result.payload?.state) {
      const normalized = normalizeState(result.payload.state);
      cacheStateRaw(normalized);
      return normalized;
    }
  } catch {
    // keep local state if remote sync fails
  }

  return localState;
}

async function verifyCredentials(login, password, options = {}) {
  const { touchGuard = true } = options;

  const lock = isLockedOut();
  if (lock) {
    return {
      user: null,
      error: "locked",
      retryAt: lock.lockUntil
    };
  }

  const state = loadCmsState();
  const passwordHash = await hashPassword(password);
  const user = state.users.find((item) => {
    if (item.login !== login) {
      return false;
    }
    if (item.passwordHash) {
      return item.passwordHash === passwordHash;
    }
    return item.password === password;
  });

  if (!user) {
    if (touchGuard) {
      registerFailedAttempt();
    }
    return {
      user: null,
      error: "invalid"
    };
  }

  if (!user.passwordHash) {
    const upgradedUsers = state.users.map((item) =>
      item.id === user.id
        ? {
            ...item,
            passwordHash
          }
        : item
    );
    upgradedUsers.forEach((item) => {
      delete item.password;
    });
    state.users = upgradedUsers;
    saveCmsState(state);
  }

  if (touchGuard) {
    resetFailedAttempts();
  }

  return {
    user,
    error: null
  };
}

export async function authenticate(login, password) {
  const normalizedLogin = String(login || "").trim().toLowerCase();

  if (hasFetchApi()) {
    try {
      const result = await requestCms("/login", {
        method: "POST",
        body: { login: normalizedLogin, password },
        allowUnauthorized: true
      });

      if (result.ok && result.payload?.session) {
        const session = result.payload.session;
        cacheSessionRaw(session);

        if (result.payload?.state) {
          const normalizedState = normalizeState(result.payload.state);
          cacheStateRaw(normalizedState);
        }

        resetFailedAttempts();
        return { session, error: null };
      }
    } catch (error) {
      if (error instanceof CmsApiError) {
        if (error.code === "locked") {
          return {
            session: null,
            error: "locked",
            retryAt: error.retryAt
          };
        }
        if (error.code === "invalid") {
          return { session: null, error: "invalid" };
        }
      }
      // network errors fallback to local mode
    }
  }

  const check = await verifyCredentials(normalizedLogin, password, { touchGuard: true });
  if (!check.user) {
    return {
      session: null,
      error: check.error,
      retryAt: check.retryAt
    };
  }

  const session = {
    id: check.user.id,
    name: check.user.name,
    login: check.user.login,
    role: check.user.role,
    loggedAt: nowIso()
  };

  cacheSessionRaw(session);
  return { session, error: null };
}

export async function verifySensitiveAuth(login, password) {
  return verifyCredentials(String(login || "").trim().toLowerCase(), password, { touchGuard: true });
}

export function getSession() {
  if (!hasWindowStorage()) {
    return null;
  }

  const parsed = readSessionRaw();
  if (!parsed) {
    return null;
  }

  const state = loadCmsState();
  const exists = state.users.find((user) => user.id === parsed.id);
  if (!exists) {
    return null;
  }

  const loggedAt = Date.parse(parsed.loggedAt || "");
  if (!Number.isFinite(loggedAt) || Date.now() - loggedAt > SESSION_TTL_MS) {
    clearSession();
    return null;
  }

  return {
    ...parsed,
    role: exists.role,
    name: exists.name,
    login: exists.login
  };
}

export function clearSession() {
  if (hasWindowStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
  }

  if (hasFetchApi()) {
    fetch(`${CMS_API_BASE}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({})
    }).catch(() => {});
  }
}

export async function setUserPassword(userId, password, gate = null) {
  const normalizedPassword = String(password || "").trim();
  if (normalizedPassword.length < 8) {
    throw new Error("password_too_short");
  }

  if (!gate || typeof gate !== "object") {
    throw new Error("missing_gate");
  }

  const authLogin = String(gate.authLogin || "").trim().toLowerCase();
  const authPassword = String(gate.authPassword || "");
  const codeword = String(gate.codeword || "").trim();
  const sessionUserId = String(gate.sessionUserId || "").trim();

  if (!authLogin || !authPassword || !codeword || !sessionUserId) {
    throw new Error("invalid_gate");
  }

  const codewordHash = await hashPassword(codeword);
  if (codewordHash !== SECURITY_CODEWORD_HASH) {
    throw new Error("invalid_codeword");
  }

  const verification = await verifyCredentials(authLogin, authPassword, { touchGuard: true });
  if (!verification.user) {
    if (verification.error === "locked") {
      throw new Error("locked");
    }
    throw new Error("invalid_auth");
  }

  if (verification.user.id !== sessionUserId || verification.user.role !== ROLE_ADMIN) {
    throw new Error("forbidden");
  }

  const state = loadCmsState();
  const hashed = await hashPassword(normalizedPassword);
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
  saveCmsState(state);

  if (hasFetchApi()) {
    try {
      const result = await requestCms("/user-password", {
        method: "POST",
        body: {
          userId,
          password: normalizedPassword,
          gate: {
            authLogin,
            authPassword,
            codeword,
            sessionUserId
          }
        },
        allowUnauthorized: true
      });
      if (result.ok && result.payload?.state) {
        const normalized = normalizeState(result.payload.state);
        cacheStateRaw(normalized);
        return normalized;
      }
    } catch (error) {
      if (error instanceof CmsApiError) {
        throw new Error(error.code);
      }
      throw error;
    }
  }

  return state;
}

export function canEdit(role) {
  return role === ROLE_ADMIN || role === ROLE_EDITOR;
}

export function canManageUsers(role) {
  return role === ROLE_ADMIN;
}

export function canPublish(role) {
  return role === ROLE_ADMIN || role === ROLE_EDITOR;
}

export function makeId(prefix) {
  const chunk = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${chunk}`;
}
