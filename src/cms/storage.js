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

    const merged = {
      ...fallback,
      ...parsed,
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : fallback.users,
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
  state.users = (nextUsers || []).map((user) => {
    const normalized = {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt || nowIso(),
      passwordHash: user.passwordHash || ""
    };
    return normalized;
  });
  saveCmsState(state);
  return state;
}

export async function authenticate(login, password) {
  const lock = isLockedOut();
  if (lock) {
    return {
      session: null,
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
    registerFailedAttempt();
    return {
      session: null,
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

  const session = {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    loggedAt: nowIso()
  };

  resetFailedAttempts();

  if (hasWindowStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { session, error: null };
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

export async function setUserPassword(userId, password) {
  const state = loadCmsState();
  const hashed = await hashPassword(password);
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
