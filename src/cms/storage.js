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
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_ID = "admin-1";
const DEFAULT_ADMIN_LOGIN = "admin";
const CHARTER_FALLBACK_URL = "/assets/ustav-artkommunikacii.pdf";
const PENDING_SUFFIX_RE = /\s*\(файл добавляется\)\s*$/i;
const PENDING_WITH_OPTIONAL_RE = /\s*\(при наличии,\s*файл добавляется\)\s*$/i;
const LIST_REFINING_SUFFIX_RE = /\s*\(список уточняется\)\s*$/i;
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
  return title
    .replace(PENDING_SUFFIX_RE, "")
    .replace(LIST_REFINING_SUFFIX_RE, "")
    .trim();
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

function normalizeMethodologyModal(content) {
  if (!content || typeof content !== "object" || !Array.isArray(content.modals)) {
    return false;
  }

  const defaultMethodologyEntry = Array.isArray(DEFAULT_CONTENT.modals)
    ? DEFAULT_CONTENT.modals.find((entry) => entry && entry.id === "methodology")
    : null;

  if (!defaultMethodologyEntry) {
    return false;
  }

  let changed = false;
  content.modals = content.modals.map((entry) => {
    if (!entry || entry.id !== "methodology") {
      return entry;
    }

    const rawBodyHtml = String(entry.bodyHtml || "");
    const needsBodyUpgrade =
      !rawBodyHtml.includes("Диагностика системы") ||
      rawBodyHtml.includes("Пересборка контуров взаимодействия") ||
      rawBodyHtml.includes("Единый язык команды") ||
      rawBodyHtml.includes("Фиксация результата");

    if (!needsBodyUpgrade) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      bodyHtml: defaultMethodologyEntry.bodyHtml
    };
  });

  return changed;
}

function normalizeHomeIksActions(content) {
  if (!content || typeof content !== "object" || !content.home || typeof content.home !== "object") {
    return false;
  }

  const iks = content.home.iks;
  if (!iks || typeof iks !== "object") {
    return false;
  }

  const currentList = Array.isArray(iks.actions) ? iks.actions : [];
  const nextList = cloneDeep(DEFAULT_CONTENT.home.iks.actions || []);
  const titles = currentList.map((item) => String(item?.label || "").trim());
  const targets = currentList.map((item) => String(item?.target || "").trim());
  const isLegacyList =
    currentList.length === 3 &&
    ((titles[0] === "Что такое алмаз" && titles[1] === "Суверенитет РФ" && titles[2] === "Форматы работы") ||
      (targets[0] === "diamond" && targets[1] === "sovereignty" && targets[2] === "formats"));

  if (!currentList.length || isLegacyList) {
    iks.actions = nextList;
    return true;
  }

  return false;
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
    const cleanedBodyHtml = rawBodyHtml.replace(
      /<div class=["']modal-review-media["'][^>]*>\s*<img[^>]*src=["']\/assets\/reviews\/[^"']+\.svg["'][^>]*>\s*<\/div>\s*/gi,
      ""
    );
    const mediaUpgradedBodyHtml = cleanedBodyHtml.replace(
      /<article class=["']modal-review-card["']>([\s\S]*?)<\/article>/gi,
      (match, innerHtml) => {
        if (/modal-review-media/i.test(match)) {
          return match;
        }
        const rawName = String(innerHtml.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1] || "")
          .replace(/<[^>]+>/g, " ")
          .trim();
        const initials = rawName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("") || "Фото";
        return `<article class="modal-review-card"><div class="modal-review-media"><div class="modal-review-avatar-empty" aria-hidden="true">${initials}</div></div>${innerHtml}</article>`;
      }
    );
    const rawTitle = String(entry.title || "").trim();
    const needsBodyUpgrade = !rawBodyHtml.includes("modal-review-card");
    const needsPlaceholderCleanup = cleanedBodyHtml !== rawBodyHtml;
    const needsMediaUpgrade = mediaUpgradedBodyHtml !== cleanedBodyHtml;
    const needsTitleUpgrade = rawTitle === "Участники о проекте" || rawTitle === "Отзывы участников";

    if (!needsBodyUpgrade && !needsTitleUpgrade && !needsPlaceholderCleanup && !needsMediaUpgrade) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      title: needsTitleUpgrade ? defaultReviewsEntry.title : entry.title,
      bodyHtml: needsBodyUpgrade ? defaultReviewsEntry.bodyHtml : mediaUpgradedBodyHtml
    };
  });

  return changed;
}

function normalizeTeamModal(content) {
  if (!content || typeof content !== "object" || !Array.isArray(content.modals)) {
    return false;
  }

  const defaultTeamEntry = Array.isArray(DEFAULT_CONTENT.modals)
    ? DEFAULT_CONTENT.modals.find((entry) => entry && entry.id === "team")
    : null;

  if (!defaultTeamEntry) {
    return false;
  }

  let changed = false;
  content.modals = content.modals.map((entry) => {
    if (!entry || entry.id !== "team") {
      return entry;
    }

    const rawBodyHtml = String(entry.bodyHtml || "");
    if (rawBodyHtml.includes("team-card-media")) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      title: defaultTeamEntry.title,
      bodyHtml: defaultTeamEntry.bodyHtml
    };
  });

  return changed;
}

function normalizeAwardsModal(content) {
  if (!content || typeof content !== "object" || !Array.isArray(content.modals)) {
    return false;
  }

  const defaultAwardsEntry = Array.isArray(DEFAULT_CONTENT.modals)
    ? DEFAULT_CONTENT.modals.find((entry) => entry && entry.id === "awards")
    : null;

  if (!defaultAwardsEntry) {
    return false;
  }

  let changed = false;
  content.modals = content.modals.map((entry) => {
    if (!entry || entry.id !== "awards") {
      return entry;
    }

    const rawBodyHtml = String(entry.bodyHtml || "");
    if (rawBodyHtml.includes("awards-sheet")) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      title: defaultAwardsEntry.title,
      bodyHtml: defaultAwardsEntry.bodyHtml
    };
  });

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
    ["iks", "actions", 2],
    ["expert", "actions", 2]
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
      login: DEFAULT_ADMIN_LOGIN,
      role: ROLE_ADMIN
    };

    users[adminIndex] = nextAdmin;
    return users;
  }

  users.unshift({
    ...cloneDeep(DEFAULT_USERS[0]),
    id: ADMIN_ID,
    login: DEFAULT_ADMIN_LOGIN,
    role: ROLE_ADMIN
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
  normalizeFormatsModal(merged.draft);
  normalizeFormatsModal(merged.published);
  normalizeMethodologyModal(merged.draft);
  normalizeMethodologyModal(merged.published);
  normalizeMediaStationReviewsModal(merged.draft);
  normalizeMediaStationReviewsModal(merged.published);
  normalizeTeamModal(merged.draft);
  normalizeTeamModal(merged.published);
  normalizeAwardsModal(merged.draft);
  normalizeAwardsModal(merged.published);
  normalizeMediaStationActions(merged.draft);
  normalizeMediaStationActions(merged.published);
  normalizeProjectRoutingAndStats(merged.draft);
  normalizeProjectRoutingAndStats(merged.published);
  normalizeHomeIksActions(merged.draft);
  normalizeHomeIksActions(merged.published);
  normalizeHomeIksPillars(merged.draft);
  normalizeHomeIksPillars(merged.published);
  normalizeHomeExpertHeading(merged.draft);
  normalizeHomeExpertHeading(merged.published);
  normalizeActionLimits(merged.draft);
  normalizeActionLimits(merged.published);

  merged.version = CMS_VERSION;
  return merged;
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

  // Небольшой debounce: при активном наборе текста не шлём десятки запросов в API.
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
        // Форсируем последнюю несохранённую правку перед публикацией/выходом.
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
      const current = readSessionRaw();
      const loggedAt =
        typeof result.payload.session.loggedAt === "string" && result.payload.session.loggedAt
          ? result.payload.session.loggedAt
          : typeof current?.loggedAt === "string" && current.loggedAt
            ? current.loggedAt
            : nowIso();
      cacheSessionRaw({
        ...result.payload.session,
        loggedAt
      });
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
    const merged = mergeWithDefaults(DEFAULT_CONTENT, content);
    normalizeAboutDocuments(merged);
    normalizeHomeMediaSources(merged);
    normalizeModals(merged);
    normalizeFormatsModal(merged);
    normalizeMethodologyModal(merged);
    normalizeMediaStationReviewsModal(merged);
    normalizeTeamModal(merged);
    normalizeAwardsModal(merged);
    normalizeMediaStationActions(merged);
    normalizeProjectRoutingAndStats(merged);
    normalizeHomeIksActions(merged);
    normalizeHomeIksPillars(merged);
    normalizeHomeExpertHeading(merged);
    normalizeActionLimits(merged);
    return merged;
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
  normalizeFormatsModal(state.published);
  normalizeMediaStationReviewsModal(state.published);
  normalizeTeamModal(state.published);
  normalizeAwardsModal(state.published);
  normalizeMediaStationActions(state.published);
  normalizeProjectRoutingAndStats(state.published);
  normalizeHomeIksPillars(state.published);
  normalizeHomeExpertHeading(state.published);
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

function normalizeVersionEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    id: String(entry.id || ""),
    createdAt: entry.createdAt || null,
    trigger: entry.trigger || "draft",
    actorId: entry.actorId || null,
    actorName: entry.actorName || null,
    actorLogin: entry.actorLogin || null,
    actorRole: entry.actorRole || null,
    sourceUpdatedAt: entry.sourceUpdatedAt || null,
    sourcePublishedAt: entry.sourcePublishedAt || null,
    sourceLastPublishedBy: entry.sourceLastPublishedBy || null,
    sizeBytes: Number.isFinite(Number(entry.sizeBytes)) ? Number(entry.sizeBytes) : null
  };
}

function normalizeVersionsList(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }
  return rawList
    .map(normalizeVersionEntry)
    .filter((item) => item && item.id && String(item.trigger || "").trim().toLowerCase() === "publish");
}

export async function fetchVersions() {
  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }
  try {
    const result = await requestCms("/versions", { method: "GET", allowUnauthorized: true });
    if (!result.ok || result.unauthorized) {
      throw new Error("unauthorized");
    }
    return {
      versions: normalizeVersionsList(result.payload?.versions),
      limit: Number(result.payload?.limit) || null
    };
  } catch (error) {
    if (error instanceof CmsApiError) {
      throw new Error(error.code);
    }
    throw error;
  }
}

export async function rollbackToVersion(versionId) {
  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }
  const safeId = String(versionId || "").trim();
  if (!safeId) {
    throw new Error("invalid_version_id");
  }
  try {
    const result = await requestCms("/versions/rollback", {
      method: "POST",
      body: { versionId: safeId },
      allowUnauthorized: true
    });
    if (!result.ok || result.unauthorized) {
      throw new Error("unauthorized");
    }
    const normalizedState = result.payload?.state ? normalizeState(result.payload.state) : null;
    if (normalizedState) {
      cacheStateRaw(normalizedState);
    }
    return {
      state: normalizedState,
      versions: normalizeVersionsList(result.payload?.versions)
    };
  } catch (error) {
    if (error instanceof CmsApiError) {
      throw new Error(error.code);
    }
    throw error;
  }
}

export async function deleteVersionRemote(versionId) {
  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }
  const safeId = String(versionId || "").trim();
  if (!safeId) {
    throw new Error("invalid_version_id");
  }
  try {
    const result = await requestCms("/versions/delete", {
      method: "POST",
      body: { versionId: safeId },
      allowUnauthorized: true
    });
    if (!result.ok || result.unauthorized) {
      throw new Error("unauthorized");
    }
    return {
      versions: normalizeVersionsList(result.payload?.versions)
    };
  } catch (error) {
    if (error instanceof CmsApiError) {
      throw new Error(error.code);
    }
    throw error;
  }
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
  normalizeAboutDocuments(state.draft);
  normalizeHomeMediaSources(state.draft);
  normalizeModals(state.draft);
  normalizeFormatsModal(state.draft);
  normalizeMediaStationReviewsModal(state.draft);
  normalizeTeamModal(state.draft);
  normalizeAwardsModal(state.draft);
  normalizeMediaStationActions(state.draft);
  normalizeProjectRoutingAndStats(state.draft);
  normalizeHomeIksPillars(state.draft);
  normalizeHomeExpertHeading(state.draft);
  normalizeActionLimits(state.draft);
  state.updatedAt = nowIso();
  saveCmsState(state);
  // Локально сохраняем сразу, на сервер отправляем асинхронно с debounce.
  queueRemoteDraftSync(state.draft);
  return state;
}

function normalizeUsersInput(nextUsers) {
  const usedLogins = new Set();
  const roles = new Set([ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER]);

  return normalizeLoadedUsers((nextUsers || []).map((user, index) => {
    const isAdmin = user && user.id === ADMIN_ID;
    const baseLogin = String(isAdmin ? DEFAULT_ADMIN_LOGIN : user?.login || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const fallbackLogin = `user${index + 1}`;
    let loginCandidate = baseLogin || fallbackLogin;

    if (!isAdmin && loginCandidate === DEFAULT_ADMIN_LOGIN) {
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
      createdAt: user.createdAt || nowIso()
    };
    if (isAdmin) {
      normalized.role = ROLE_ADMIN;
      normalized.login = DEFAULT_ADMIN_LOGIN;
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
  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }

  try {
    const prepared = normalizeUsersInput(nextUsers);
    const result = await requestCms("/users", {
      method: "POST",
      body: { users: prepared },
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
  throw new Error("server_unavailable");
}

export async function authenticate(login, password) {
  const normalizedLogin = String(login || "").trim().toLowerCase();

  if (!hasFetchApi()) {
    return { session: null, error: "unavailable" };
  }

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
      return { session: null, error: error.code || "invalid" };
    }
    return { session: null, error: "unavailable" };
  }

  return { session: null, error: "invalid" };
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

export async function verifySensitiveGate(gate = null) {
  if (!gate || typeof gate !== "object") {
    throw new Error("invalid_gate");
  }

  const authLogin = String(gate.authLogin || "").trim().toLowerCase();
  const authPassword = String(gate.authPassword || "");
  const codeword = String(gate.codeword || "").trim();
  const sessionUserId = String(gate.sessionUserId || "").trim();

  if (!authLogin || !authPassword || !codeword || !sessionUserId) {
    throw new Error("invalid_gate");
  }
  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }

  try {
    await requestCms("/verify-gate", {
      method: "POST",
      body: {
        gate: {
          authLogin,
          authPassword,
          codeword,
          sessionUserId
        }
      },
      allowUnauthorized: true
    });
    return true;
  } catch (error) {
    if (error instanceof CmsApiError) {
      throw new Error(error.code);
    }
    throw error;
  }
}

export async function setUserPassword(userId, password, gate = null) {
  const normalizedPassword = String(password || "").trim();
  if (normalizedPassword.length < 10) {
    throw new Error("password_too_short");
  }
  if (!/[a-zа-яё]/i.test(normalizedPassword)) {
    throw new Error("password_missing_letter");
  }
  if (!/\d/.test(normalizedPassword)) {
    throw new Error("password_missing_digit");
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

  if (!hasFetchApi()) {
    throw new Error("server_unavailable");
  }

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
  throw new Error("server_unavailable");
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
