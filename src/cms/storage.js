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
  state.users = nextUsers;
  saveCmsState(state);
  return state;
}

export function authenticate(login, password) {
  const state = loadCmsState();
  const user = state.users.find((item) => item.login === login && item.password === password);
  if (!user) {
    return null;
  }

  const session = {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    loggedAt: nowIso()
  };

  if (hasWindowStorage()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
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
