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
const REQUIRED_ADMIN_PASSWORD_HASH = "f6ee94ecb014f74f887b9dcc52daecf73ab3e3333320cadd98bcb59d895c52f5";
const LEGACY_ADMIN_PASSWORD_HASH = "893cbcc2f9197dce1feea7c1e80486f27ae0be699408157d744928b600a7e82b";
const SECURITY_CODEWORD_HASH = "8fd706e21340a5033ccd4270f22c051de24cabb6b1c4c3ad8f61dc7fb8ad22d6";

function nowIso() {
  return new Date().toISOString();
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

    const fallback = createBaseState();

    const sourceUsers = Array.isArray(parsed.users) && parsed.users.length ? parsed.users : fallback.users;
    const normalizedUsers = normalizeLoadedUsers(sourceUsers);

    const merged = {
      ...fallback,
      ...parsed,
      users: normalizedUsers,
      draft: parsed.draft && typeof parsed.draft === "object" ? parsed.draft : fallback.draft,
      published:
        parsed.published && typeof parsed.published === "object"
          ? parsed.published
          : parsed.draft && typeof parsed.draft === "object"
            ? cloneDeep(parsed.draft)
            : fallback.published
    };

    if (!merged.version || merged.version !== CMS_VERSION) {
      merged.version = CMS_VERSION;
    }

    if (JSON.stringify(sourceUsers) !== JSON.stringify(normalizedUsers)) {
      saveCmsState(merged);
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
}

export function getCmsContent() {
  return loadCmsState();
}

export function getPublishedContent() {
  const state = loadCmsState();
  return cloneDeep(state.published);
}

export function publishDraft(userId) {
  const state = loadCmsState();
  state.published = cloneDeep(state.draft);
  state.publishedAt = nowIso();
  state.updatedAt = nowIso();
  state.lastPublishedBy = userId || null;
  saveCmsState(state);
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
  state.updatedAt = nowIso();
  saveCmsState(state);
  return state;
}

export function setUsers(nextUsers) {
  const state = loadCmsState();
  state.users = normalizeLoadedUsers((nextUsers || []).map((user) => {
    const normalized = {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt || nowIso(),
      passwordHash: user.passwordHash || ""
    };
    return normalized;
  }));
  saveCmsState(state);
  return state;
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
  const check = await verifyCredentials(login, password, { touchGuard: true });
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

  if (hasWindowStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { session, error: null };
}

export async function verifySensitiveAuth(login, password) {
  return verifyCredentials(login, password, { touchGuard: true });
}

export function getSession() {
  if (!hasWindowStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
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
  } catch {
    return null;
  }
}

export function clearSession() {
  if (!hasWindowStorage()) {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}

export async function setUserPassword(userId, password, gate = null) {
  const normalizedPassword = String(password || "").trim();
  if (normalizedPassword.length < 8) {
    throw new Error("password_too_short");
  }

  if (!gate || typeof gate !== "object") {
    throw new Error("missing_gate");
  }

  const authLogin = String(gate.authLogin || "").trim();
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
