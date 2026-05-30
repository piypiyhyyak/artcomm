import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ROLE_ADMIN,
  ROLE_EDITOR,
  ROLE_LABELS,
  ROLE_VIEWER,
  cloneDeep
} from "./cms/defaultContent";
import {
  authenticate,
  canEdit,
  canManageUsers,
  canPublish,
  deleteVersionRemote,
  clearSession,
  fetchVersions,
  flushDraftSync,
  getSession,
  loadCmsState,
  makeId,
  publishDraft,
  refreshCmsStateFromServer,
  rollbackToVersion,
  restoreSessionFromServer,
  saveDraft,
  setUserPassword,
  setUsersRemote,
  verifySensitiveGate
} from "./cms/storage";

const NAV_ITEMS = [
  { key: "dashboard", label: "Главная" },
  { key: "versions", label: "Версионный контроль" },
  { key: "media", label: "Медиа" },
  { key: "docs", label: "Документы" },
  { key: "home", label: "Контент главной" },
  { key: "about", label: "Контент /about" },
  { key: "modals", label: "Модальные окна" },
  { key: "users", label: "Пользователи" }
];

const ACCEPT_IMAGES = "image/*";
const ACCEPT_DOCS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";
const ACCEPT_VIDEO = "video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg";
function listToTableText(rows) {
  if (!Array.isArray(rows)) {
    return "";
  }
  return rows.map((row) => (Array.isArray(row) ? row.join(" | ") : "")).join("\n");
}

function tableTextToList(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  return text
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((cell) => cell.trim()));
}

function listToMultiline(list) {
  if (!Array.isArray(list)) {
    return "";
  }
  return list.map((item) => String(item || "")).join("\n");
}

function multilineToList(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function reorderByIndexes(list, from, to) {
  if (!Array.isArray(list)) {
    return [];
  }
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function sanitizeAssetName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё._-]/giu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";
}

function getFileBaseName(name) {
  return String(name || "").replace(/\.[^/.]+$/, "");
}

function isProjectAssetPath(value) {
  const raw = String(value || "").trim();
  return raw.startsWith("/assets/") && !raw.includes("..");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file_read_error"));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToProject(file, folder = "") {
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch("/api/cms/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      fileName: sanitizeAssetName(file.name || "file"),
      dataUrl,
      folder: String(folder || "")
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !payload.path) {
    throw new Error(payload.error || "upload_failed");
  }
  return payload.path;
}

async function deleteFileFromProject(filePath) {
  if (!isProjectAssetPath(filePath)) {
    return;
  }
  const response = await fetch("/api/cms/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({ path: filePath })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "delete_failed");
  }
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return value;
  }
  return dt.toLocaleString("ru-RU");
}

function formatVersionTrigger(trigger) {
  const key = String(trigger || "").trim().toLowerCase();
  if (key === "publish") {
    return "Публикация";
  }
  if (key === "rollback") {
    return "Откат версии";
  }
  return "Сохранение черновика";
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return "—";
  }
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
}

function isPasswordStrongEnough(value) {
  const password = String(value || "");
  return password.length >= 10 && /[a-zа-яё]/i.test(password) && /\d/.test(password);
}

function countAssetPathOccurrences(node, assetPath) {
  if (!node) {
    return 0;
  }
  if (typeof node === "string") {
    return node === assetPath ? 1 : 0;
  }
  if (Array.isArray(node)) {
    return node.reduce((acc, item) => acc + countAssetPathOccurrences(item, assetPath), 0);
  }
  if (typeof node === "object") {
    return Object.values(node).reduce((acc, value) => acc + countAssetPathOccurrences(value, assetPath), 0);
  }
  return 0;
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`ap-panel ${className}`.trim()}>
      <header className="ap-panel-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="ap-panel-body">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  autoComplete,
  autoFocus = false
}) {
  return (
    <label className="ap-field">
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
    </label>
  );
}

function TextField({ label, value, onChange, rows = 4, placeholder = "", disabled = false }) {
  return (
    <label className="ap-field">
      <span>{label}</span>
      <textarea value={value || ""} onChange={onChange} rows={rows} placeholder={placeholder} disabled={disabled} />
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className="ap-toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function UploadButton({ label, accept, onPick, disabled = false, kind = "default" }) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="ap-hidden-input"
        onChange={(event) => {
          const file = event.target.files && event.target.files[0];
          event.target.value = "";
          if (file && onPick) {
            onPick(file);
          }
        }}
      />
      <button
        type="button"
        className={kind === "plus" ? "ap-btn ap-btn-plus" : "ap-btn ap-btn-ghost"}
        disabled={disabled}
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.click();
          }
        }}
      >
        {kind === "plus" ? "+" : null}
        <span>{label}</span>
      </button>
    </>
  );
}

function DraggableList({ items, onReorder, readonly, renderItem, getKey, layout = "vertical", itemClassName = "" }) {
  const [dragIndex, setDragIndex] = useState(null);
  const listClassName = layout === "horizontal" ? "ap-list ap-list-horizontal" : "ap-list";
  const cardClassName = `ap-item ${itemClassName}`.trim();

  return (
    <div className={listClassName}>
      {items.map((item, index) => (
        <article
          key={getKey(item, index)}
          className={cardClassName}
          draggable={!readonly}
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => {
            if (readonly) {
              return;
            }
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (readonly) {
              return;
            }
            event.preventDefault();
            if (dragIndex === null) {
              return;
            }
            if (dragIndex !== index) {
              onReorder(reorderByIndexes(items, dragIndex, index));
            }
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <div className="ap-item-head">
            <span className="ap-drag">≡</span>
            <span className="ap-item-index">{index + 1}</span>
          </div>
          {renderItem(item, index)}
        </article>
      ))}
    </div>
  );
}

function ImageListEditor({
  title,
  subtitle,
  items,
  readonly,
  onChange,
  imageKey,
  altKey,
  titleKey,
  localPreviewMap,
  onPickPreview,
  idPrefix,
  onUploadFile,
  onDeleteFile,
  uploadFolder,
  thumbPreset = "default"
}) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  async function addImage(file) {
    const path = await onUploadFile(file, uploadFolder);
    if (!path) {
      return;
    }
    const nextItem = {
      id: makeId(idPrefix),
      [imageKey]: path,
      [altKey]: getFileBaseName(file.name),
      isPublished: true
    };
    if (titleKey) {
      nextItem[titleKey] = getFileBaseName(file.name);
    }
    onChange([...safeItems, nextItem]);
    onPickPreview(nextItem.id, file);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="ap-toolbar">
        <UploadButton
          label="Добавить изображение"
          accept={ACCEPT_IMAGES}
          disabled={readonly}
          kind="plus"
          onPick={(file) => {
            void addImage(file);
          }}
        />
      </div>

      <DraggableList
        items={safeItems}
        readonly={readonly}
        layout="horizontal"
        itemClassName={`ap-item-media ap-item-media-${thumbPreset}`}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(item, index) => {
          const preview = localPreviewMap[item.id] || item[imageKey];
          return (
            <div className="ap-item-body">
              <div className={`ap-thumb-wrap ap-thumb-wrap-${thumbPreset}`}>
                {preview ? (
                  <img src={preview} alt="preview" className={`ap-thumb ap-thumb-${thumbPreset}`} />
                ) : (
                  <div className="ap-thumb-empty">Нет превью</div>
                )}
              </div>

              <div className="ap-item-fields">
                {titleKey ? (
                  <Field
                    label="Название"
                    value={item[titleKey] || ""}
                    disabled={readonly}
                    onChange={(event) => updateAt(index, { [titleKey]: event.target.value })}
                  />
                ) : null}

                <Field
                  label="Путь к изображению"
                  value={item[imageKey] || ""}
                  disabled
                />

                <Field
                  label="Описание (alt)"
                  value={item[altKey] || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { [altKey]: event.target.value })}
                />

                <div className="ap-item-actions">
                  <Toggle
                    label="Показывать"
                    checked={item.isPublished !== false}
                    disabled={readonly}
                    onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
                  />

                  <div className="ap-action-buttons">
                    <button
                      type="button"
                      className="ap-btn ap-btn-danger"
                      disabled={readonly}
                      onClick={async () => {
                        await onDeleteFile(item[imageKey]);
                        const next = safeItems.filter((_, idx) => idx !== index);
                        onChange(next);
                      }}
                    >
                      Удалить
                    </button>

                    <UploadButton
                      label="Заменить файл"
                      accept={ACCEPT_IMAGES}
                      disabled={readonly}
                      onPick={async (file) => {
                        const previousPath = item[imageKey];
                        const path = await onUploadFile(file, uploadFolder);
                        if (!path) {
                          return;
                        }
                        updateAt(index, { [imageKey]: path, [altKey]: item[altKey] || getFileBaseName(file.name) });
                        onPickPreview(item.id, file);
                        if (previousPath && previousPath !== path) {
                          await onDeleteFile(previousPath);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
    </Panel>
  );
}

function DocumentListEditor({ title, subtitle, items, readonly, onChange, idPrefix, onUploadFile, onDeleteFile, uploadFolder }) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  async function addDocument(file) {
    const path = await onUploadFile(file, uploadFolder);
    if (!path) {
      return;
    }
    const next = [
      ...safeItems,
      {
        id: makeId(idPrefix),
        title: getFileBaseName(file.name),
        url: path,
        isPublished: true
      }
    ];
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="ap-toolbar">
        <UploadButton
          label="Добавить документ"
          accept={ACCEPT_DOCS}
          disabled={readonly}
          kind="plus"
          onPick={(file) => {
            void addDocument(file);
          }}
        />
      </div>

      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(item, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <Field
                label="Название"
                value={item.title || ""}
                disabled={readonly}
                onChange={(event) => updateAt(index, { title: event.target.value })}
              />

              <Field
                label="Путь или ссылка"
                value={item.url || ""}
                disabled={readonly}
                onChange={(event) => updateAt(index, { url: event.target.value })}
              />

              <div className="ap-item-actions">
                <Toggle
                  label="Показывать"
                  checked={item.isPublished !== false}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
                />

                <div className="ap-action-buttons">
                  <button
                    type="button"
                    className="ap-btn ap-btn-danger"
                    disabled={readonly}
                    onClick={async () => {
                      await onDeleteFile(item.url);
                      const next = safeItems.filter((_, idx) => idx !== index);
                      onChange(next);
                    }}
                  >
                    Удалить
                  </button>

                  <UploadButton
                    label="Заменить файл"
                    accept={ACCEPT_DOCS}
                    disabled={readonly}
                    onPick={async (file) => {
                      const previousPath = item.url;
                      const path = await onUploadFile(file, uploadFolder);
                      if (!path) {
                        return;
                      }
                      updateAt(index, {
                        title: item.title || getFileBaseName(file.name),
                        url: path
                      });
                      if (previousPath && previousPath !== path) {
                        await onDeleteFile(previousPath);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </Panel>
  );
}

function ActionListEditor({
  title,
  subtitle,
  items,
  readonly,
  onChange,
  idPrefix,
  defaultScrollTarget = "#contacts",
  defaultModalTarget = "test",
  maxItems = null
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const hasLimit = Number.isFinite(maxItems) && maxItems > 0;
  const isLimitReached = hasLimit && safeItems.length >= maxItems;

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(action, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <div className="ap-grid ap-grid-2">
                <Field
                  label="Текст кнопки"
                  value={action.label || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { label: event.target.value })}
                />
                <Field
                  label="Цель (#id или modal-id)"
                  value={action.target || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { target: event.target.value })}
                />
              </div>
              <div className="ap-grid ap-grid-3">
                <label className="ap-field">
                  <span>Тип действия</span>
                  <select
                    value={action.type || "scroll"}
                    disabled={readonly}
                    onChange={(event) => updateAt(index, { type: event.target.value })}
                  >
                    <option value="scroll">Прокрутка</option>
                    <option value="modal">Модальное окно</option>
                  </select>
                </label>
                <label className="ap-field">
                  <span>Вид</span>
                  <select
                    value={action.variant || "secondary"}
                    disabled={readonly}
                    onChange={(event) => updateAt(index, { variant: event.target.value })}
                  >
                    <option value="primary">Основная</option>
                    <option value="secondary">Вторичная</option>
                  </select>
                </label>
                <Toggle
                  label="Показывать"
                  checked={action.isPublished !== false}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
                />
              </div>
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => {
                  const next = safeItems.filter((_, idx) => idx !== index);
                  onChange(next);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />

      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly || isLimitReached}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              label: "Новая кнопка",
              type: "scroll",
              target: defaultScrollTarget,
              variant: "secondary",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить кнопку</span>
      </button>
      {hasLimit ? (
        <p className="ap-subtitle">
          Лимит для этого блока: {maxItems}. На сайте больше не отображается.
        </p>
      ) : null}
    </Panel>
  );
}

function TextItemListEditor({ title, subtitle, items, readonly, onChange, idPrefix }) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(entry, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <TextField
                label="Текст"
                value={entry.text || ""}
                rows={3}
                disabled={readonly}
                onChange={(event) => updateAt(index, { text: event.target.value })}
              />
              <Toggle
                label="Показывать"
                checked={entry.isPublished !== false}
                disabled={readonly}
                onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
              />
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => onChange(safeItems.filter((_, idx) => idx !== index))}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              text: "Новый пункт",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить пункт</span>
      </button>
    </Panel>
  );
}

function MetricsListEditor({ title, subtitle, items, readonly, onChange, idPrefix }) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(entry, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <div className="ap-grid ap-grid-3">
                <Field
                  label="Значение"
                  value={String(entry.value ?? "")}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { value: event.target.value })}
                />
                <Field
                  label="Суффикс"
                  value={entry.suffix || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { suffix: event.target.value })}
                />
                <Field
                  label="Подпись"
                  value={entry.label || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { label: event.target.value })}
                />
              </div>
              <Toggle
                label="Показывать"
                checked={entry.isPublished !== false}
                disabled={readonly}
                onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
              />
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => onChange(safeItems.filter((_, idx) => idx !== index))}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              value: "0",
              suffix: "",
              label: "Новый показатель",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить показатель</span>
      </button>
    </Panel>
  );
}

function TrustLineEditor({ title, subtitle, items, readonly, onChange, idPrefix }) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(entry, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <div className="ap-grid ap-grid-3">
                <Field
                  label="Значение"
                  value={entry.value || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { value: event.target.value })}
                />
                <Field
                  label="Подпись"
                  value={entry.caption || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { caption: event.target.value })}
                />
                <Toggle
                  label="Показывать"
                  checked={entry.isPublished !== false}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
                />
              </div>
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => onChange(safeItems.filter((_, idx) => idx !== index))}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              value: "0+",
              caption: "подпись",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить пункт</span>
      </button>
    </Panel>
  );
}

function TitleTextListEditor({
  title,
  subtitle,
  items,
  readonly,
  onChange,
  idPrefix,
  titleLabel = "Заголовок",
  textLabel = "Описание"
}) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(entry, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <Field
                label={titleLabel}
                value={entry.title || ""}
                disabled={readonly}
                onChange={(event) => updateAt(index, { title: event.target.value })}
              />
              <TextField
                label={textLabel}
                value={entry.text || ""}
                rows={3}
                disabled={readonly}
                onChange={(event) => updateAt(index, { text: event.target.value })}
              />
              <Toggle
                label="Показывать"
                checked={entry.isPublished !== false}
                disabled={readonly}
                onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
              />
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => onChange(safeItems.filter((_, idx) => idx !== index))}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              title: "Новый пункт",
              text: "",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить пункт</span>
      </button>
    </Panel>
  );
}

function PillarsListEditor({ title, subtitle, items, readonly, onChange, idPrefix }) {
  const safeItems = Array.isArray(items) ? items : [];

  function updateAt(index, nextPartial) {
    const next = [...safeItems];
    next[index] = { ...next[index], ...nextPartial };
    onChange(next);
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <DraggableList
        items={safeItems}
        readonly={readonly}
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(entry, index) => (
          <div className="ap-item-body ap-item-doc">
            <div className="ap-item-fields">
              <div className="ap-grid ap-grid-3">
                <Field
                  label="Ключ (для tooltip)"
                  value={entry.key || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { key: event.target.value })}
                />
                <Field
                  label="Заголовок"
                  value={entry.title || ""}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { title: event.target.value })}
                />
                <Toggle
                  label="Показывать"
                  checked={entry.isPublished !== false}
                  disabled={readonly}
                  onChange={(event) => updateAt(index, { isPublished: event.target.checked })}
                />
              </div>
              <TextField
                label="Описание"
                value={entry.text || ""}
                rows={3}
                disabled={readonly}
                onChange={(event) => updateAt(index, { text: event.target.value })}
              />
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly}
                onClick={() => onChange(safeItems.filter((_, idx) => idx !== index))}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        className="ap-btn ap-btn-plus"
        disabled={readonly}
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: makeId(idPrefix),
              key: "Параметр",
              title: "Новый столп",
              text: "",
              isPublished: true
            }
          ])
        }
      >
        <span>+</span>
        <span>Добавить столп</span>
      </button>
    </Panel>
  );
}

function VideoEditor({ media, readonly, onChange, localPreviewMap, onPickPreview, onUploadFile, onDeleteFile, uploadFolder }) {
  const currentPath = media.videoDesktop || media.videoMobile || media.videoFallback || "";

  function updateVideoPath(pathValue) {
    const nextPath = String(pathValue || "").trim();
    onChange({
      ...media,
      videoDesktop: nextPath,
      videoMobile: nextPath,
      videoFallback: nextPath
    });
  }

  return (
    <Panel title="Видео" subtitle="Один файл используется для десктопа, мобильной версии и резервного источника">
      <div className="ap-list">
        <article className="ap-item">
          <div className="ap-item-body ap-item-video">
            <div className="ap-video-wrap">
              {currentPath || localPreviewMap.videoPrimary ? (
                <video
                  className="ap-video"
                  controls
                  muted
                  preload="metadata"
                  src={localPreviewMap.videoPrimary || currentPath}
                />
              ) : (
                <div className="ap-thumb-empty">Видео не задано</div>
              )}
            </div>

            <div className="ap-item-fields">
              <Field
                label="Видео (единый файл)"
                value={currentPath}
                disabled={readonly}
                onChange={(event) => updateVideoPath(event.target.value)}
              />

              <UploadButton
                label="Загрузить видео"
                accept={ACCEPT_VIDEO}
                disabled={readonly}
                kind="plus"
                onPick={async (file) => {
                  const previousPath = currentPath;
                  const path = await onUploadFile(file, uploadFolder);
                  if (!path) {
                    return;
                  }
                      updateVideoPath(path);
                      onPickPreview("videoPrimary", file);
                      if (previousPath && previousPath !== path) {
                        await onDeleteFile(previousPath, { ignoreDraftPathOccurrences: 3 });
                      }
                    }}
                  />

              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={readonly || !currentPath}
                onClick={async () => {
                  const previousPath = currentPath;
                  updateVideoPath("");
                  await onDeleteFile(previousPath, { ignoreDraftPathOccurrences: 3 });
                }}
              >
                Удалить видео
              </button>
            </div>
          </div>
        </article>
      </div>
    </Panel>
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeHtmlSandbox(bodyHtml) {
  if (typeof document === "undefined") {
    return null;
  }
  const box = document.createElement("div");
  box.innerHTML = String(bodyHtml || "");
  return box;
}

function getNodesText(root, selector) {
  if (!root) {
    return [];
  }
  return Array.from(root.querySelectorAll(selector))
    .map((item) => item.textContent || "")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getModalEditorKind(modalId) {
  const id = String(modalId || "");
  if (id === "ms-results") return "ms-results";
  if (id === "ms-participants") return "quotes";
  if (id === "ms-minister") return "quote-note";
  if (id === "sovereignty") return "lead-list-note";
  if (id === "formats") return "cards";
  if (id === "methodology") return "steps";
  if (id === "team") return "team";
  if (id === "awards") return "list";
  if (id === "achievements") return "achievements";
  return "paragraphs";
}

function parseModalBodyForEditor(modalId, bodyHtml) {
  const kind = getModalEditorKind(modalId);
  const root = makeHtmlSandbox(bodyHtml);
  const fallbackText = root ? (root.textContent || "").trim() : "";

  if (kind === "ms-results") {
    const metrics = getNodesText(root, ".numbers-12 span");
    const bars = root
      ? Array.from(root.querySelectorAll(".bar-item")).map((item) => {
          const label = (item.querySelector("span")?.textContent || "").trim();
          const valueRaw =
            (item.querySelector("i")?.getAttribute("data-value") || "").trim() ||
            (item.querySelector("strong")?.textContent || "").replace("%", "").trim();
          return [label, valueRaw].filter(Boolean).join(" | ");
        })
      : [];
    return {
      kind,
      metricsText: listToMultiline(metrics),
      barsText: listToMultiline(bars)
    };
  }

  if (kind === "quotes") {
    return {
      kind,
      quotesText: listToMultiline(getNodesText(root, "blockquote"))
    };
  }

  if (kind === "quote-note") {
    const paragraphs = getNodesText(root, "p:not(.modal-note)");
    return {
      kind,
      quote: paragraphs[0] || "",
      note: (root?.querySelector(".modal-note")?.textContent || "").trim()
    };
  }

  if (kind === "lead-list-note") {
    const paragraphs = getNodesText(root, "p:not(.modal-note)");
    return {
      kind,
      lead: paragraphs[0] || "",
      pointsText: listToMultiline(getNodesText(root, "ul li")),
      note: (root?.querySelector(".modal-note")?.textContent || "").trim()
    };
  }

  if (kind === "cards") {
    const lines = root
      ? Array.from(root.querySelectorAll(".format-cards article")).map((item) => {
          const title = (item.querySelector("h4")?.textContent || "").trim();
          const duration = (item.querySelector("p:not(.tags)")?.textContent || "").trim();
          const tags = (item.querySelector(".tags")?.textContent || "").trim();
          return [title, duration, tags].filter(Boolean).join(" | ");
        })
      : [];
    return { kind, cardsText: listToMultiline(lines) };
  }

  if (kind === "steps") {
    return {
      kind,
      stepsText: listToMultiline(getNodesText(root, ".timeline li"))
    };
  }

  if (kind === "team") {
    const lines = root
      ? Array.from(root.querySelectorAll(".team-grid article")).map((item) => {
          const initials = (item.querySelector("i")?.textContent || "").trim();
          const name = (item.querySelector("span")?.textContent || "").trim();
          const role = (item.querySelector("small")?.textContent || "").trim();
          return [initials, name, role].filter(Boolean).join(" | ");
        })
      : [];
    return { kind, membersText: listToMultiline(lines) };
  }

  if (kind === "list") {
    return {
      kind,
      listText: listToMultiline(getNodesText(root, "ul li"))
    };
  }

  if (kind === "achievements") {
    const cards = root
      ? Array.from(root.querySelectorAll(".achievements-grid article")).map((item) => {
          const value = (item.querySelector("strong")?.textContent || "").trim();
          const label = (item.querySelector("span")?.textContent || "").trim();
          return [value, label].filter(Boolean).join(" | ");
        })
      : [];
    const note = (root?.querySelector("p")?.textContent || "").trim();
    return {
      kind,
      cardsText: listToMultiline(cards),
      note
    };
  }

  const paragraphItems = getNodesText(root, "p");
  return {
    kind,
    paragraphsText: listToMultiline(paragraphItems.length ? paragraphItems : multilineToList(fallbackText))
  };
}

function buildModalBodyFromEditor(modalId, data) {
  const kind = getModalEditorKind(modalId);

  if (kind === "ms-results") {
    const metrics = multilineToList(data.metricsText || "");
    const bars = multilineToList(data.barsText || "");
    const metricsHtml = metrics.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
    const barsHtml = bars
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts[0] || parts[1])
      .map((parts) => {
        const label = escapeHtml(parts[0] || "Показатель");
        const rawValue = (parts[1] || "0").replace("%", "").trim();
        const numeric = Number.parseFloat(rawValue.replace(",", "."));
        const safeValue = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
        const labelValue = `${String(rawValue || "0").replace(".", ",")}%`;
        return `<div class="bar-item"><span>${label}</span><strong>${escapeHtml(labelValue)}</strong><div class="bar"><i data-value="${safeValue}"></i></div></div>`;
      })
      .join("");
    return `<div class="modal-grid numbers-12">${metricsHtml}</div><div class="bars modal-bars">${barsHtml}</div>`;
  }

  if (kind === "quotes") {
    return multilineToList(data.quotesText || "")
      .map((line) => `<blockquote>${escapeHtml(line)}</blockquote>`)
      .join("");
  }

  if (kind === "quote-note") {
    const quote = String(data.quote || "").trim();
    const note = String(data.note || "").trim();
    return `${quote ? `<p>${escapeHtml(quote)}</p>` : ""}${note ? `<p class="modal-note">${escapeHtml(note)}</p>` : ""}`;
  }

  if (kind === "lead-list-note") {
    const lead = String(data.lead || "").trim();
    const points = multilineToList(data.pointsText || "");
    const note = String(data.note || "").trim();
    const listHtml = points.length ? `<ul>${points.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
    return `${lead ? `<p>${escapeHtml(lead)}</p>` : ""}${listHtml}${note ? `<p class="modal-note">${escapeHtml(note)}</p>` : ""}`;
  }

  if (kind === "cards") {
    const cards = multilineToList(data.cardsText || "")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts[0] || parts[1] || parts[2])
      .map((parts) => {
        const title = escapeHtml(parts[0] || "Новый формат");
        const duration = escapeHtml(parts[1] || "");
        const tags = escapeHtml(parts[2] || "");
        return `<article><h4>${title}</h4><p>${duration}</p><p class="tags">${tags}</p></article>`;
      })
      .join("");
    return `<div class="modal-grid format-cards">${cards}</div>`;
  }

  if (kind === "steps") {
    const steps = multilineToList(data.stepsText || "");
    return `<ol class="timeline">${steps.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>`;
  }

  if (kind === "team") {
    const members = multilineToList(data.membersText || "")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts[0] || parts[1] || parts[2])
      .map((parts) => {
        const initials = escapeHtml(parts[0] || "XX");
        const name = escapeHtml(parts[1] || "Новый участник");
        const role = escapeHtml(parts[2] || "Роль");
        return `<article><i>${initials}</i><span>${name}</span><small>${role}</small></article>`;
      })
      .join("");
    return `<div class="modal-grid team-grid">${members}</div>`;
  }

  if (kind === "list") {
    const items = multilineToList(data.listText || "");
    return `<ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  }

  if (kind === "achievements") {
    const cards = multilineToList(data.cardsText || "")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts[0] || parts[1])
      .map((parts) => `<article><strong>${escapeHtml(parts[0] || "0")}</strong><span>${escapeHtml(parts[1] || "")}</span></article>`)
      .join("");
    const note = String(data.note || "").trim();
    return `<div class="modal-grid achievements-grid">${cards}</div>${note ? `<p>${escapeHtml(note)}</p>` : ""}`;
  }

  const paragraphs = multilineToList(data.paragraphsText || "");
  return paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function ModalBodyEditor({ entry, readonly, onChange }) {
  const editorData = useMemo(
    () => parseModalBodyForEditor(entry.id, entry.bodyHtml),
    [entry.id, entry.bodyHtml]
  );

  const kind = editorData.kind;
  const updateBody = (patch) => {
    const nextData = { ...editorData, ...patch };
    onChange(buildModalBodyFromEditor(entry.id, nextData));
  };

  if (kind === "ms-results") {
    return (
      <div className="ap-grid ap-grid-2">
        <TextField
          label="Показатели (каждый с новой строки)"
          rows={8}
          value={editorData.metricsText}
          disabled={readonly}
          onChange={(event) => updateBody({ metricsText: event.target.value })}
        />
        <TextField
          label="Шкалы (формат: Название | Процент)"
          rows={8}
          value={editorData.barsText}
          disabled={readonly}
          onChange={(event) => updateBody({ barsText: event.target.value })}
        />
      </div>
    );
  }

  if (kind === "quotes") {
    return (
      <TextField
        label="Отзывы (каждый отзыв с новой строки)"
        rows={8}
        value={editorData.quotesText}
        disabled={readonly}
        onChange={(event) => updateBody({ quotesText: event.target.value })}
      />
    );
  }

  if (kind === "quote-note") {
    return (
      <div className="ap-grid ap-grid-2">
        <TextField
          label="Основная цитата"
          rows={5}
          value={editorData.quote}
          disabled={readonly}
          onChange={(event) => updateBody({ quote: event.target.value })}
        />
        <TextField
          label="Подпись / источник"
          rows={5}
          value={editorData.note}
          disabled={readonly}
          onChange={(event) => updateBody({ note: event.target.value })}
        />
      </div>
    );
  }

  if (kind === "lead-list-note") {
    return (
      <div className="ap-grid ap-grid-2">
        <TextField
          label="Вводный текст"
          rows={5}
          value={editorData.lead}
          disabled={readonly}
          onChange={(event) => updateBody({ lead: event.target.value })}
        />
        <TextField
          label="Список пунктов (каждый с новой строки)"
          rows={5}
          value={editorData.pointsText}
          disabled={readonly}
          onChange={(event) => updateBody({ pointsText: event.target.value })}
        />
        <TextField
          label="Примечание"
          rows={3}
          value={editorData.note}
          disabled={readonly}
          onChange={(event) => updateBody({ note: event.target.value })}
        />
      </div>
    );
  }

  if (kind === "cards") {
    return (
      <TextField
        label="Карточки (формат строки: Заголовок | Длительность | Теги)"
        rows={8}
        value={editorData.cardsText}
        disabled={readonly}
        onChange={(event) => updateBody({ cardsText: event.target.value })}
      />
    );
  }

  if (kind === "steps") {
    return (
      <TextField
        label="Шаги методологии (каждый шаг с новой строки)"
        rows={6}
        value={editorData.stepsText}
        disabled={readonly}
        onChange={(event) => updateBody({ stepsText: event.target.value })}
      />
    );
  }

  if (kind === "team") {
    return (
      <TextField
        label="Команда (формат строки: Инициалы | Имя | Роль)"
        rows={10}
        value={editorData.membersText}
        disabled={readonly}
        onChange={(event) => updateBody({ membersText: event.target.value })}
      />
    );
  }

  if (kind === "list") {
    return (
      <TextField
        label="Список (каждый пункт с новой строки)"
        rows={7}
        value={editorData.listText}
        disabled={readonly}
        onChange={(event) => updateBody({ listText: event.target.value })}
      />
    );
  }

  if (kind === "achievements") {
    return (
      <div className="ap-grid ap-grid-2">
        <TextField
          label="Факты (формат строки: Значение | Подпись)"
          rows={8}
          value={editorData.cardsText}
          disabled={readonly}
          onChange={(event) => updateBody({ cardsText: event.target.value })}
        />
        <TextField
          label="Дополнительный текст"
          rows={8}
          value={editorData.note}
          disabled={readonly}
          onChange={(event) => updateBody({ note: event.target.value })}
        />
      </div>
    );
  }

  return (
    <TextField
      label="Текст модального окна (каждая строка станет отдельным абзацем)"
      rows={8}
      value={editorData.paragraphsText}
      disabled={readonly}
      onChange={(event) => updateBody({ paragraphsText: event.target.value })}
    />
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(() => getSession());
  const [cmsState, setCmsState] = useState(() => loadCmsState());
  const [tab, setTab] = useState("dashboard");
  const [feedback, setFeedback] = useState("");
  const [authForm, setAuthForm] = useState({ login: "", password: "" });
  const [localImagePreviews, setLocalImagePreviews] = useState({});
  const [localVideoPreviews, setLocalVideoPreviews] = useState({});
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [userEditDrafts, setUserEditDrafts] = useState({});
  const [editingUsers, setEditingUsers] = useState({});
  const [passwordGateForm, setPasswordGateForm] = useState({ login: "", password: "", codeword: "" });
  const [passwordGateUserId, setPasswordGateUserId] = useState("");
  const [passwordGateBusy, setPasswordGateBusy] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [versionsState, setVersionsState] = useState({ list: [], limit: null, loadedAt: null, loading: false });
  const [versionActionBusyId, setVersionActionBusyId] = useState("");

  const draft = cmsState.draft;
  const readonly = !session || !canEdit(session.role);
  const editLocked = readonly || isProcessingFiles;
  const canPublishNow = session && canPublish(session.role);
  const canManageUsersNow = session && canManageUsers(session.role);
  const canManageVersionsNow = canManageUsersNow;
  const isPasswordGateOpen = Boolean(passwordGateUserId);
  const passwordGateTargetUser = isPasswordGateOpen ? cmsState.users.find((user) => user.id === passwordGateUserId) : null;

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => item.key !== "users" || canManageUsersNow),
    [canManageUsersNow]
  );

  useEffect(() => {
    if (tab === "users" && !canManageUsersNow) {
      setTab("dashboard");
    }
  }, [tab, canManageUsersNow]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", isPasswordGateOpen);
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isPasswordGateOpen]);

  useEffect(() => {
    if (!isPasswordGateOpen) {
      return undefined;
    }
    function onEsc(event) {
      if (event.key === "Escape" && !passwordGateBusy) {
        setPasswordGateUserId("");
        setPasswordGateForm((prev) => ({ ...prev, password: "", codeword: "" }));
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
    };
  }, [isPasswordGateOpen, passwordGateBusy]);

  useEffect(() => {
    if (session) {
      return;
    }

    let isDisposed = false;
    restoreSessionFromServer()
      .then((restored) => {
        if (isDisposed || !restored?.session) {
          return;
        }
        setSession(restored.session);
        if (restored.state) {
          setCmsState(restored.state);
        }
      })
      .catch(() => {
        // Silent fallback to login form when API is unavailable.
      });

    return () => {
      isDisposed = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let isDisposed = false;
    refreshCmsStateFromServer()
      .then((remoteState) => {
        if (!isDisposed && remoteState) {
          setCmsState(remoteState);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setFeedback("Не удалось обновить состояние CMS с сервера");
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      setVersionsState({ list: [], limit: null, loadedAt: null, loading: false });
      return;
    }
    void loadVersionsList(false);
  }, [session]);

  useEffect(() => {
    if (tab !== "versions" || !session) {
      return;
    }
    if (!versionsState.loadedAt && !versionsState.loading) {
      void loadVersionsList(false);
    }
  }, [tab, session, versionsState.loadedAt, versionsState.loading]);

  useEffect(() => {
    return () => {
      Object.values(localImagePreviews).forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      Object.values(localVideoPreviews).forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [localImagePreviews, localVideoPreviews]);

  function syncState(nextState, message = "") {
    setCmsState(nextState);
    if (message) {
      setFeedback(message);
    }
  }

  async function loadVersionsList(showFeedback = false) {
    if (!session) {
      return [];
    }
    // Держим явный индикатор загрузки, чтобы не запускать параллельные запросы из нескольких кликов.
    setVersionsState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await fetchVersions();
      const loadedAt = new Date().toISOString();
      setVersionsState({
        list: Array.isArray(result.versions) ? result.versions : [],
        limit: result.limit ?? null,
        loadedAt,
        loading: false
      });
      if (showFeedback) {
        setFeedback("Список версий обновлён");
      }
      return Array.isArray(result.versions) ? result.versions : [];
    } catch (error) {
      setVersionsState((prev) => ({ ...prev, loading: false }));
      const code = error instanceof Error ? error.message : "versions_load_failed";
      if (code === "unauthorized") {
        setFeedback("Сессия истекла. Войдите снова");
      } else {
        setFeedback("Не удалось загрузить список версий");
      }
      return [];
    }
  }

  async function runFileTask(task, successMessage) {
    if (isProcessingFiles) {
      return null;
    }
    setIsProcessingFiles(true);
    try {
      const result = await task();
      if (successMessage) {
        setFeedback(successMessage);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "file_operation_failed";
      setFeedback(`Ошибка работы с файлом: ${message}`);
      return null;
    } finally {
      setIsProcessingFiles(false);
    }
  }

  function updateDraft(mutator, message = "Черновик сохранён") {
    if (editLocked) {
      return;
    }
    // Любое изменение в форме сразу считается правкой черновика.
    // Серверная часть сама заведет snapshot-версию для возможного отката.
    const nextDraft = mutator(cloneDeep(draft));
    const nextState = saveDraft(() => nextDraft);
    syncState(nextState, message);
  }

  async function updateUsers(mutator, message = "Пользователи обновлены") {
    const nextUsers = mutator(cloneDeep(cmsState.users));
    try {
      const nextState = await setUsersRemote(nextUsers);
      syncState(nextState, message);
      return nextState;
    } catch (error) {
      const code = error instanceof Error ? error.message : "users_update_failed";
      if (code === "forbidden") {
        setFeedback("Нет прав для изменения пользователей");
      } else if (code === "unauthorized") {
        setFeedback("Сессия истекла. Войдите снова");
      } else {
        setFeedback("Не удалось сохранить изменения пользователей");
      }
      return null;
    }
  }

  function toggleUserExpanded(userId, currentOpen) {
    setExpandedUsers((prev) => ({ ...prev, [userId]: !currentOpen }));
  }

  function makeUserDraft(user) {
    return {
      name: user?.name || "",
      login: user?.login || "",
      role: user?.role || ROLE_VIEWER,
      newPassword: "",
      repeatPassword: ""
    };
  }

  function startUserEditing(user) {
    setEditingUsers((prev) => ({ ...prev, [user.id]: true }));
    setUserEditDrafts((prev) => ({ ...prev, [user.id]: makeUserDraft(user) }));
  }

  function cancelUserEditing(userId) {
    setEditingUsers((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setUserEditDrafts((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    if (passwordGateUserId === userId) {
      closePasswordGate();
    }
  }

  function patchUserDraft(userId, patch) {
    setUserEditDrafts((prev) => {
      const nextCurrent = prev[userId] || makeUserDraft(cmsState.users.find((item) => item.id === userId));
      return {
        ...prev,
        [userId]: { ...nextCurrent, ...patch }
      };
    });
  }

  function openPasswordGate(user) {
    if (!editingUsers[user.id]) {
      setFeedback("Сначала нажмите «Редактировать»");
      return;
    }

    const draftUser = userEditDrafts[user.id];
    if (!draftUser) {
      setFeedback("Не найден черновик редактирования пользователя");
      return;
    }

    const nextName = String(draftUser.name || "").trim();
    const nextLogin = String(draftUser.login || "").trim();
    const nextPassword = String(draftUser.newPassword || "").trim();
    const repeatPassword = String(draftUser.repeatPassword || "").trim();

    if (!nextName || !nextLogin) {
      setFeedback("Заполните ФИО и логин");
      return;
    }

    if (nextPassword || repeatPassword) {
      if (nextPassword !== repeatPassword) {
        setFeedback("Пароль и подтверждение не совпадают");
        return;
      }
      if (!isPasswordStrongEnough(nextPassword)) {
        setFeedback("Пароль должен содержать минимум 10 символов, буквы и цифры");
        return;
      }
    }

    const isDemotingAdmin = user.role === ROLE_ADMIN && draftUser.role !== ROLE_ADMIN;
    if (isDemotingAdmin) {
      const adminsLeft = cmsState.users.filter((item) => item.role === ROLE_ADMIN && item.id !== user.id).length;
      if (adminsLeft < 1) {
        setFeedback("В системе должен оставаться минимум один администратор");
        return;
      }
    }

    setPasswordGateForm((prev) => ({
      login: prev.login || session?.login || "",
      password: "",
      codeword: ""
    }));
    setPasswordGateUserId(user.id);
  }

  function closePasswordGate() {
    if (passwordGateBusy) {
      return;
    }
    setPasswordGateUserId("");
    setPasswordGateForm((prev) => ({ ...prev, password: "", codeword: "" }));
  }

  async function confirmPasswordGate() {
    if (!passwordGateTargetUser || !session) {
      closePasswordGate();
      return;
    }

    const draftUser = userEditDrafts[passwordGateTargetUser.id];
    if (!draftUser || !editingUsers[passwordGateTargetUser.id]) {
      setFeedback("Сначала включите режим редактирования пользователя");
      return;
    }

    const nextName = String(draftUser.name || "").trim();
    const nextLogin = String(draftUser.login || "").trim().toLowerCase();
    const nextRole = draftUser.role || ROLE_VIEWER;
    const nextPassword = String(draftUser.newPassword || "").trim();
    const repeatPassword = String(draftUser.repeatPassword || "").trim();

    if (!nextName || !nextLogin) {
      setFeedback("Заполните ФИО и логин");
      return;
    }
    if (nextPassword || repeatPassword) {
      if (nextPassword !== repeatPassword) {
        setFeedback("Пароль и подтверждение не совпадают");
        return;
      }
      if (!isPasswordStrongEnough(nextPassword)) {
        setFeedback("Пароль должен содержать минимум 10 символов, буквы и цифры");
        return;
      }
    }
    if (!passwordGateForm.login || !passwordGateForm.password || !passwordGateForm.codeword) {
      setFeedback("Заполните все поля подтверждения безопасности");
      return;
    }

    setPasswordGateBusy(true);
    try {
      await verifySensitiveGate({
        authLogin: passwordGateForm.login.trim(),
        authPassword: passwordGateForm.password,
        codeword: passwordGateForm.codeword.trim(),
        sessionUserId: session.id
      });

      let nextState = await updateUsers((nextUsers) => {
        const idx = nextUsers.findIndex((item) => item.id === passwordGateTargetUser.id);
        if (idx >= 0) {
          nextUsers[idx].name = nextName;
          nextUsers[idx].login = nextLogin;
          nextUsers[idx].role = nextRole;
        }
        return nextUsers;
      }, `Изменения пользователя «${nextName || nextLogin}» сохранены`);
      if (!nextState) {
        return;
      }

      if (nextPassword) {
        nextState = await setUserPassword(passwordGateTargetUser.id, nextPassword, {
          authLogin: passwordGateForm.login.trim(),
          authPassword: passwordGateForm.password,
          codeword: passwordGateForm.codeword.trim(),
          sessionUserId: session.id
        });
        syncState(nextState, `Изменения пользователя «${nextName || nextLogin}» сохранены`);
      }

      cancelUserEditing(passwordGateTargetUser.id);
      setPasswordGateUserId("");
      setPasswordGateForm((prev) => ({ ...prev, password: "", codeword: "" }));
    } catch (error) {
      const code = error instanceof Error ? error.message : "user_update_failed";
      if (code === "invalid_codeword") {
        setFeedback("Неверное кодовое слово");
      } else if (code === "invalid_auth") {
        setFeedback("Повторная авторизация не пройдена");
      } else if (code === "forbidden") {
        setFeedback("Подтверждение должно быть выполнено под текущей админ-учёткой администратора");
      } else if (code === "locked") {
        setFeedback("Слишком много неудачных попыток подтверждения. Подождите и повторите.");
      } else if (code === "password_too_short" || code === "password_missing_letter" || code === "password_missing_digit") {
        setFeedback("Новый пароль не соответствует требованиям: минимум 10 символов, буквы и цифры.");
      } else if (code === "unauthorized") {
        setFeedback("Сессия истекла. Войдите снова");
      } else {
        setFeedback("Не удалось сохранить изменения пользователя");
      }
    } finally {
      setPasswordGateBusy(false);
    }
  }

  function rememberImagePreview(key, file) {
    const previewUrl = URL.createObjectURL(file);
    setLocalImagePreviews((prev) => {
      const old = prev[key];
      if (old && old.startsWith("blob:")) {
        URL.revokeObjectURL(old);
      }
      return { ...prev, [key]: previewUrl };
    });
  }

  function rememberVideoPreview(key, file) {
    const previewUrl = URL.createObjectURL(file);
    setLocalVideoPreviews((prev) => {
      const old = prev[key];
      if (old && old.startsWith("blob:")) {
        URL.revokeObjectURL(old);
      }
      return { ...prev, [key]: previewUrl };
    });
  }

  async function handleUploadFile(file, folder = "") {
    if (!file) {
      return null;
    }

    const uploadedPath = await runFileTask(
      async () => uploadFileToProject(file, folder),
      `Файл добавлен в проект: ${file.name}`
    );
    return typeof uploadedPath === "string" ? uploadedPath : null;
  }

  async function handleDeleteFile(filePath, options = {}) {
    const normalizedPath = String(filePath || "").trim();
    if (!isProjectAssetPath(normalizedPath)) {
      return false;
    }

    const ignoredDraftRefs = Math.max(0, Number(options.ignoreDraftPathOccurrences) || 0);
    const draftRefsRaw = countAssetPathOccurrences(draft, normalizedPath);
    const draftRefs = Math.max(0, draftRefsRaw - ignoredDraftRefs);
    const publishedRefs = countAssetPathOccurrences(cmsState.published, normalizedPath);

    if (draftRefs > 1) {
      setFeedback(`Файл не удалён: используется в черновике ${draftRefs} раз(а) — ${normalizedPath}`);
      return false;
    }

    if (publishedRefs > 0) {
      setFeedback(`Файл не удалён: он ещё используется в опубликованной версии — ${normalizedPath}`);
      return false;
    }

    const deleted = await runFileTask(
      async () => {
        await deleteFileFromProject(normalizedPath);
        return true;
      },
      `Файл удалён из проекта: ${normalizedPath}`
    );
    return Boolean(deleted);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const result = await authenticate(authForm.login.trim(), authForm.password);
    if (!result.session) {
      if (result.error === "locked" && result.retryAt) {
        setFeedback(`Слишком много попыток. Повторите после ${formatDate(result.retryAt)}.`);
        return;
      }
      if (result.error === "unavailable") {
        setFeedback("Сервер CMS недоступен. Проверьте API и повторите вход.");
        return;
      }
      setFeedback("Неверный логин или пароль");
      return;
    }

    setSession(result.session);
    setAuthForm({ login: "", password: "" });
    setFeedback(`Вход выполнен: ${ROLE_LABELS[result.session.role]}.`);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setFeedback("Вы вышли из системы");
  }

  async function handlePublish() {
    if (!session || !canPublishNow) {
      return;
    }
    try {
      await flushDraftSync();
      const next = await publishDraft(session.id);
      syncState(next, "Изменения опубликованы");
      void loadVersionsList(false);
    } catch {
      setFeedback("Не удалось опубликовать изменения на сервере");
    }
  }

  async function handleRefresh() {
    try {
      const remote = await refreshCmsStateFromServer();
      if (remote) {
        setCmsState(remote);
        setFeedback("Черновик перечитан с сервера");
        return;
      }
    } catch {
      // fallback to local cache
    }
    const local = loadCmsState();
    setCmsState(local);
    setFeedback("Черновик перечитан из локального кеша");
  }

  async function handleRollbackVersion(versionId) {
    if (!canManageVersionsNow) {
      setFeedback("Только администратор может откатывать версии");
      return;
    }
    const safeId = String(versionId || "").trim();
    if (!safeId) {
      return;
    }
    const approved = window.confirm("Откатить сайт на выбранную версию? Текущий черновик и публикация будут заменены.");
    if (!approved) {
      return;
    }
    setVersionActionBusyId(safeId);
    try {
      // После отката сервер возвращает уже восстановленный state — сразу подменяем его в UI.
      const result = await rollbackToVersion(safeId);
      if (result.state) {
        setCmsState(result.state);
      }
      setVersionsState((prev) => ({
        ...prev,
        list: Array.isArray(result.versions) ? result.versions : prev.list,
        loadedAt: new Date().toISOString(),
        loading: false
      }));
      setFeedback("Версия успешно восстановлена");
    } catch (error) {
      const code = error instanceof Error ? error.message : "rollback_failed";
      if (code === "version_not_found") {
        setFeedback("Версия не найдена. Обновите список.");
      } else if (code === "forbidden") {
        setFeedback("Откат доступен только администратору");
      } else {
        setFeedback("Не удалось выполнить откат версии");
      }
    } finally {
      setVersionActionBusyId("");
    }
  }

  async function handleDeleteVersion(versionId) {
    if (!canManageVersionsNow) {
      setFeedback("Только администратор может удалять версии");
      return;
    }
    const safeId = String(versionId || "").trim();
    if (!safeId) {
      return;
    }
    const approved = window.confirm("Удалить выбранную версию безвозвратно?");
    if (!approved) {
      return;
    }
    setVersionActionBusyId(safeId);
    try {
      // Удаляем только архив версии. Текущий черновик/публикация не трогаются.
      const result = await deleteVersionRemote(safeId);
      setVersionsState((prev) => ({
        ...prev,
        list: Array.isArray(result.versions) ? result.versions : prev.list,
        loadedAt: new Date().toISOString(),
        loading: false
      }));
      setFeedback("Версия удалена");
    } catch (error) {
      const code = error instanceof Error ? error.message : "version_delete_failed";
      if (code === "version_not_found") {
        setFeedback("Версия уже удалена. Обновите список.");
      } else if (code === "forbidden") {
        setFeedback("Удаление доступно только администратору");
      } else {
        setFeedback("Не удалось удалить версию");
      }
    } finally {
      setVersionActionBusyId("");
    }
  }

  if (!session) {
    return (
      <main className="ap-login-shell">
        <section className="ap-login-card">
          <div className="ap-login-brand" aria-label="Институт креативных индустрий и социального проектирования АртКомм">
            <img className="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true" />
            <div className="ap-login-brand-copy">
              <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
              <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
            </div>
          </div>
          <header className="ap-login-head">
            <h1>Вход в админ-панель</h1>
            <p>Используйте логин и пароль администратора.</p>
          </header>
          <form onSubmit={handleLogin} className="ap-login-form">
            <Field
              label="Логин"
              value={authForm.login}
              autoComplete="username"
              autoFocus
              onChange={(event) => setAuthForm((prev) => ({ ...prev, login: event.target.value }))}
            />
            <Field
              label="Пароль"
              type="password"
              value={authForm.password}
              autoComplete="current-password"
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button type="submit" className="ap-btn ap-btn-primary">Войти</button>
          </form>
          {feedback ? <p className="ap-feedback">{feedback}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="ap-shell">
      <header className="ap-header">
        <div className="ap-brand" aria-label="Институт креативных индустрий и социального проектирования АртКомм">
          <img className="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true" />
          <div className="ap-brand-copy">
            <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
            <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
          </div>
        </div>

        <div className="ap-header-actions">
          <button type="button" className="ap-btn ap-btn-ghost" disabled={editLocked} onClick={handleRefresh}>
            Обновить черновик
          </button>
          <button type="button" className="ap-btn ap-btn-primary" disabled={!canPublishNow || isProcessingFiles} onClick={handlePublish}>
            Опубликовать на сайт
          </button>
          <button type="button" className="ap-btn ap-btn-ghost" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <div className="ap-layout">
        <aside className="ap-sidebar">
          <nav className="ap-nav" aria-label="Разделы админ-панели">
            {visibleNav.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`ap-nav-btn${tab === item.key ? " is-active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="ap-content">
          {feedback ? <p className="ap-feedback">{feedback}</p> : null}
          {isProcessingFiles ? <p className="ap-feedback">Идёт загрузка или удаление файла. Подождите завершения операции.</p> : null}
          {readonly ? <p className="ap-feedback">Режим просмотра: редактирование и публикация недоступны.</p> : null}

          {tab === "dashboard" ? (
            <Panel title="Добро пожаловать!" subtitle="Главная страница админ-панели">
              <div className="ap-dashboard-grid">
                <div className="ap-user-card">
                  <p><strong>ФИО:</strong> {session.name}</p>
                  <p><strong>Роль:</strong> {ROLE_LABELS[session.role]}</p>
                  <p><strong>Логин:</strong> {session.login}</p>
                  <p><strong>Черновик:</strong> {formatDate(cmsState.updatedAt)}</p>
                  <p><strong>Публикация:</strong> {formatDate(cmsState.publishedAt)}</p>
                </div>

                <article className="ap-instruction">
                  <h4>Инструкция по работе с панелью</h4>
                  <ol>
                    <li>Слева выберите раздел: Медиа, Документы, Контент главной, Контент /about, Модальные окна, Пользователи.</li>
                    <li>Все изменения сохраняются в черновик автоматически в момент редактирования.</li>
                    <li>Кнопка "Обновить" вверху перечитывает черновик из хранилища и нужна, если открыть панель в нескольких вкладках.</li>
                    <li>Кнопка "Опубликовать" переносит текущий черновик в публичную версию сайта.</li>
                    <li>В разделах Медиа и Документы используйте кнопку "+" для добавления файла.</li>
                    <li>Порядок элементов меняется перетаскиванием карточки мышью (зажмите и переместите).</li>
                    <li>Для замены файла у существующего элемента нажмите "Заменить файл".</li>
                    <li>После правок всегда проверяйте публичные страницы и затем публикуйте.</li>
                  </ol>
                </article>
              </div>
            </Panel>
          ) : null}

          {tab === "versions" ? (
            <Panel
              title="Версионный контроль"
              subtitle="Резервные копии создаются автоматически после сохранения черновика, публикации и отката."
            >
              <div className="ap-version-toolbar">
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  disabled={versionsState.loading || Boolean(versionActionBusyId)}
                  onClick={() => {
                    void loadVersionsList(true);
                  }}
                >
                  {versionsState.loading ? "Обновляем..." : "Обновить список версий"}
                </button>
                <p className="ap-subtitle">
                  Последнее обновление: {versionsState.loadedAt ? formatDate(versionsState.loadedAt) : "—"}
                  {versionsState.limit ? ` · Лимит хранения: ${versionsState.limit}` : ""}
                </p>
              </div>

              {!canManageVersionsNow ? (
                <p className="ap-feedback ap-feedback-muted">
                  Просмотр версий доступен всем ролям, но откат и удаление разрешены только администратору.
                </p>
              ) : null}

              {versionsState.list.length ? (
                <div className="ap-list">
                  {versionsState.list.map((version, index) => {
                    const isBusy = versionActionBusyId === version.id;
                    const actorName = version.actorName || version.actorLogin || version.actorId || "Система";
                    return (
                      <article key={version.id} className="ap-item ap-item-version">
                        <div className="ap-item-head">
                          <span className="ap-item-index">{index + 1}</span>
                          <strong>{formatVersionTrigger(version.trigger)}</strong>
                        </div>
                        <div className="ap-item-body ap-item-doc">
                          <div className="ap-item-fields">
                            <div className="ap-grid ap-grid-4">
                              <Field label="ID версии" value={version.id} disabled />
                              <Field label="Дата создания" value={formatDate(version.createdAt)} disabled />
                              <Field label="Автор" value={actorName} disabled />
                              <Field label="Размер снапшота" value={formatFileSize(version.sizeBytes)} disabled />
                            </div>
                            <div className="ap-grid ap-grid-2">
                              <Field label="Черновик на момент версии" value={formatDate(version.sourceUpdatedAt)} disabled />
                              <Field label="Публикация на момент версии" value={formatDate(version.sourcePublishedAt)} disabled />
                            </div>
                            <div className="ap-item-actions">
                              <button
                                type="button"
                                className="ap-btn ap-btn-primary"
                                disabled={!canManageVersionsNow || Boolean(versionActionBusyId)}
                                onClick={() => {
                                  void handleRollbackVersion(version.id);
                                }}
                              >
                                {isBusy ? "Выполняется..." : "Откатить эту версию"}
                              </button>
                              <button
                                type="button"
                                className="ap-btn ap-btn-danger"
                                disabled={!canManageVersionsNow || Boolean(versionActionBusyId)}
                                onClick={() => {
                                  void handleDeleteVersion(version.id);
                                }}
                              >
                                Удалить версию
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="ap-subtitle">Пока нет сохранённых версий. Первая версия появится после сохранения черновика.</p>
              )}
            </Panel>
          ) : null}

          {tab === "media" ? (
            <div className="ap-stack">
              <ImageListEditor
                title="Слайды главного экрана"
                subtitle="Добавление, удаление, перетаскивание и замена изображений"
                items={draft.home.slides}
                readonly={editLocked}
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.slides = nextItems;
                    return next;
                  })
                }
                imageKey="image"
                altKey="alt"
                titleKey={null}
                localPreviewMap={localImagePreviews}
                onPickPreview={rememberImagePreview}
                idPrefix="slide"
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="slides"
                thumbPreset="hero"
              />

              <ImageListEditor
                title="Логотипы в блоке «Нам доверяют»"
                subtitle="Здесь видно текущие логотипы и их порядок"
                items={draft.home.trustedPartners}
                readonly={editLocked}
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.trustedPartners = nextItems;
                    return next;
                  })
                }
                imageKey="logo"
                altKey="name"
                titleKey="name"
                localPreviewMap={localImagePreviews}
                onPickPreview={rememberImagePreview}
                idPrefix="trusted"
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="logos"
                thumbPreset="logo"
              />

              <ImageListEditor
                title="Фотографии Романа Скуднякова"
                subtitle="Галерея секции «Эксперт» с теми же правилами сортировки и замены"
                items={draft.home.expert.photos || []}
                readonly={editLocked}
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.expert.photos = nextItems;
                    return next;
                  })
                }
                imageKey="image"
                altKey="alt"
                titleKey={null}
                localPreviewMap={localImagePreviews}
                onPickPreview={rememberImagePreview}
                idPrefix="expert-photo-media"
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="expert"
                thumbPreset="expert"
              />

              <VideoEditor
                media={draft.home.mediaStation}
                readonly={editLocked}
                onChange={(nextMedia) =>
                  updateDraft((next) => {
                    next.home.mediaStation = nextMedia;
                    return next;
                  })
                }
                localPreviewMap={localVideoPreviews}
                onPickPreview={rememberVideoPreview}
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="video"
              />
            </div>
          ) : null}

          {tab === "docs" ? (
            <div className="ap-stack">
              <DocumentListEditor
                title="Основные документы (/about)"
                subtitle="Добавление, замена, удаление и сортировка"
                items={draft.about.documentsMain}
                readonly={editLocked}
                idPrefix="doc-main"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.documentsMain = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Документы по основным сведениям"
                subtitle="Документы блока «Основные сведения»"
                items={draft.about.documentsBasic}
                readonly={editLocked}
                idPrefix="doc-basic"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.documentsBasic = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Платные образовательные услуги"
                items={draft.about.extra.paidServices}
                readonly={editLocked}
                idPrefix="paid"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.extra.paidServices = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Педагогический состав"
                items={draft.about.extra.pedagogy}
                readonly={editLocked}
                idPrefix="pedagogy"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.extra.pedagogy = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Образовательные стандарты"
                items={draft.about.extra.standards}
                readonly={editLocked}
                idPrefix="standards"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.extra.standards = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Образовательные программы"
                items={draft.about.extra.programs}
                readonly={editLocked}
                idPrefix="programs"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.extra.programs = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />

              <DocumentListEditor
                title="Ссылки раздела «Образование»"
                items={draft.about.education.links}
                readonly={editLocked}
                idPrefix="education-link"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.about.education.links = nextItems;
                    return next;
                  })
                }
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="documents"
              />
            </div>
          ) : null}

          {tab === "home" ? (
            <div className="ap-stack">
              <Panel title="Hero: тексты">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.home.hero.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.hero.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок"
                    value={draft.home.hero.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.hero.title = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Цитата"
                    rows={2}
                    value={draft.home.hero.quote}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.hero.quote = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <ActionListEditor
                title="Hero: кнопки"
                subtitle="Порядок меняется перетаскиванием"
                items={draft.home.hero.actions || []}
                readonly={readonly}
                idPrefix="hero-action"
                maxItems={3}
                defaultScrollTarget="#contacts"
                defaultModalTarget="test"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.hero.actions = nextItems;
                    return next;
                  })
                }
              />

              <TrustLineEditor
                title="Hero: строка доверия"
                subtitle="Например: 20+ лет, 40+ городов, 1000+ участников"
                items={draft.home.hero.trustLine || []}
                readonly={readonly}
                idPrefix="hero-trust"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.hero.trustLine = nextItems;
                    return next;
                  })
                }
              />

              <Panel title="Секция «Знакомо?»: заголовки">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.home.common.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок"
                    value={draft.home.common.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.title = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <TitleTextListEditor
                title="Секция «Знакомо?»: карточки боли"
                subtitle="Карточки слева в секции"
                items={draft.home.common.pains || []}
                readonly={readonly}
                idPrefix="common-pain"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.common.pains = nextItems;
                    return next;
                  })
                }
              />

              <Panel title="Секция «Знакомо?»: CTA справа">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Кикер CTA"
                    value={draft.home.common.cta.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок, строка 1"
                    value={draft.home.common.cta.titleLine1}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.titleLine1 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок, строка 2"
                    value={draft.home.common.cta.titleLine2}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.titleLine2 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст, строка 1"
                    value={draft.home.common.cta.textLine1}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.textLine1 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст, строка 2"
                    value={draft.home.common.cta.textLine2}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.textLine2 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Кнопка 1: текст"
                    value={draft.home.common.cta.primaryLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.primaryLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Кнопка 1: цель"
                    value={draft.home.common.cta.primaryTarget}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.primaryTarget = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Кнопка 2: текст"
                    value={draft.home.common.cta.secondaryLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.secondaryLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Кнопка 2: цель"
                    value={draft.home.common.cta.secondaryTarget}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.common.cta.secondaryTarget = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <Panel title="МедиаСтанция: тексты и метрика">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.home.mediaStation.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок"
                    value={draft.home.mediaStation.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.title = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Подпись секции"
                    rows={2}
                    value={draft.home.mediaStation.subtitle}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.subtitle = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Подпись под видео"
                    rows={2}
                    value={draft.home.mediaStation.caption}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.caption = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Лид-абзац (заголовок)"
                    rows={2}
                    value={draft.home.mediaStation.storyTitle}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.storyTitle = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Лид-абзац (описание)"
                    rows={2}
                    value={draft.home.mediaStation.storyText}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.storyText = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ключевая метрика: значение"
                    value={draft.home.mediaStation.metricValue}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.metricValue = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ключевая метрика: суффикс"
                    value={draft.home.mediaStation.metricSuffix}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.metricSuffix = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Ключевая метрика: подпись"
                    rows={2}
                    value={draft.home.mediaStation.metricCaption}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.mediaStation.metricCaption = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <MetricsListEditor
                title="МедиаСтанция: статистика"
                subtitle="Сетка 3×2"
                items={draft.home.mediaStation.stats || []}
                readonly={readonly}
                idPrefix="ms-stat"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.mediaStation.stats = nextItems;
                    return next;
                  })
                }
              />

              <MetricsListEditor
                title="МедиаСтанция: лояльность"
                subtitle="Круговые индикаторы"
                items={draft.home.mediaStation.loyalty || []}
                readonly={readonly}
                idPrefix="ms-loyalty"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.mediaStation.loyalty = nextItems;
                    return next;
                  })
                }
              />

              <ActionListEditor
                title="МедиаСтанция: кнопки"
                subtitle="Хвост секции под метриками"
                items={draft.home.mediaStation.actions || []}
                readonly={readonly}
                idPrefix="ms-action"
                maxItems={3}
                defaultModalTarget="ms-results"
                defaultScrollTarget="#ms"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.mediaStation.actions = nextItems;
                    return next;
                  })
                }
              />

              <Panel title="ИКС: тексты">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.home.iks.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.iks.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок"
                    value={draft.home.iks.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.iks.title = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Описание"
                    rows={3}
                    value={draft.home.iks.description}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.iks.description = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <PillarsListEditor
                title="ИКС: столпы"
                subtitle="Четыре карточки слева от диаграммы"
                items={draft.home.iks.pillars || []}
                readonly={readonly}
                idPrefix="iks-pillar"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.iks.pillars = nextItems;
                    return next;
                  })
                }
              />

              <ActionListEditor
                title="ИКС: кнопки"
                subtitle="Кнопки под диаграммой"
                items={draft.home.iks.actions || []}
                readonly={readonly}
                idPrefix="iks-action"
                maxItems={3}
                defaultModalTarget="diamond"
                defaultScrollTarget="#iks"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.iks.actions = nextItems;
                    return next;
                  })
                }
              />

              <Panel title="Эксперт: тексты">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.home.expert.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Имя / заголовок"
                    value={draft.home.expert.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.title = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Цитата"
                    rows={3}
                    value={draft.home.expert.quote}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.quote = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Краткое описание"
                    rows={3}
                    value={draft.home.expert.brief}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.brief = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Блок impact: значение"
                    value={draft.home.expert.impactPrimaryValue}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.impactPrimaryValue = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Блок impact: подпись"
                    value={draft.home.expert.impactPrimaryLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.impactPrimaryLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Блок impact: вторичная строка"
                    value={draft.home.expert.impactSecondaryText}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.expert.impactSecondaryText = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <ImageListEditor
                title="Эксперт: фотогалерея"
                subtitle="Порядок миниатюр меняется перетаскиванием"
                items={draft.home.expert.photos || []}
                readonly={editLocked}
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.expert.photos = nextItems;
                    return next;
                  })
                }
                imageKey="image"
                altKey="alt"
                titleKey={null}
                localPreviewMap={localImagePreviews}
                onPickPreview={rememberImagePreview}
                idPrefix="expert-photo"
                onUploadFile={handleUploadFile}
                onDeleteFile={handleDeleteFile}
                uploadFolder="expert"
                thumbPreset="expert"
              />

              <TextItemListEditor
                title="Эксперт: позиции"
                subtitle="Список справа от галереи"
                items={draft.home.expert.positions || []}
                readonly={readonly}
                idPrefix="expert-pos"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.expert.positions = nextItems;
                    return next;
                  })
                }
              />

              <ActionListEditor
                title="Эксперт: кнопки"
                items={draft.home.expert.actions || []}
                readonly={readonly}
                idPrefix="expert-action"
                maxItems={3}
                defaultModalTarget="achievements"
                defaultScrollTarget="#expert"
                onChange={(nextItems) =>
                  updateDraft((next) => {
                    next.home.expert.actions = nextItems;
                    return next;
                  })
                }
              />

              <Panel title="Секция контактов: тексты и подписи">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Кикер"
                    value={draft.home.contactsSection.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок, строка 1"
                    value={draft.home.contactsSection.titleLine1}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.titleLine1 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок, строка 2"
                    value={draft.home.contactsSection.titleLine2}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.titleLine2 = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок карточки контактов"
                    value={draft.home.contactsSection.cardTitle}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.cardTitle = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок формы"
                    value={draft.home.contactsSection.formTitle}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.formTitle = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Лид формы"
                    rows={2}
                    value={draft.home.contactsSection.formLead}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.formLead = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Кнопка отправки"
                    value={draft.home.contactsSection.submitLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.submitLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок «Нам доверяют»"
                    value={draft.home.contactsSection.trustedTitle}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.trustedTitle = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст согласия 1 (до ссылки)"
                    value={draft.home.contactsSection.policyPrefix}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.policyPrefix = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст ссылки 1"
                    value={draft.home.contactsSection.policyLinkLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.policyLinkLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ссылка 1"
                    value={draft.home.contactsSection.policyLink}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.policyLink = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст согласия 2 (до ссылки)"
                    value={draft.home.contactsSection.newsPrefix}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.newsPrefix = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст ссылки 2"
                    value={draft.home.contactsSection.newsLinkLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.newsLinkLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ссылка 2"
                    value={draft.home.contactsSection.newsLink}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contactsSection.newsLink = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <Panel title="Контакты: ссылки и реквизиты">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Телефон"
                    value={draft.home.contacts.phone}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.phone = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ссылка телефона"
                    value={draft.home.contacts.phoneHref}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.phoneHref = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="E-mail"
                    value={draft.home.contacts.email}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.email = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Ссылка e-mail"
                    value={draft.home.contacts.emailHref}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.emailHref = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст Telegram"
                    value={draft.home.contacts.telegramLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.telegramLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Telegram URL"
                    value={draft.home.contacts.telegramUrl}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.telegramUrl = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Текст Max"
                    value={draft.home.contacts.maxLabel}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.maxLabel = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Max URL"
                    value={draft.home.contacts.maxUrl}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.home.contacts.maxUrl = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === "about" ? (
            <div className="ap-stack">
              <Panel title="Hero /about">
                <div className="ap-grid ap-grid-2">
                  <Field
                    label="Подзаголовок"
                    value={draft.about.hero.kicker}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.about.hero.kicker = event.target.value;
                        return next;
                      })
                    }
                  />
                  <Field
                    label="Заголовок"
                    value={draft.about.hero.title}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.about.hero.title = event.target.value;
                        return next;
                      })
                    }
                  />
                  <TextField
                    label="Описание"
                    rows={3}
                    value={draft.about.hero.description}
                    disabled={readonly}
                    onChange={(event) =>
                      updateDraft((next) => {
                        next.about.hero.description = event.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              </Panel>

              <Panel title="Основные сведения">
                <DraggableList
                  items={draft.about.basicFacts || []}
                  readonly={readonly}
                  getKey={(item, index) => item.id || `fact-${index}`}
                  onReorder={(nextItems) =>
                    updateDraft((next) => {
                      next.about.basicFacts = nextItems;
                      return next;
                    })
                  }
                  renderItem={(fact, index) => (
                    <div className="ap-item-body ap-item-doc">
                      <div className="ap-item-fields">
                        <div className="ap-grid ap-grid-2">
                          <Field
                            label="Поле"
                            value={fact.label}
                            disabled={readonly}
                            onChange={(event) =>
                              updateDraft((next) => {
                                next.about.basicFacts[index].label = event.target.value;
                                return next;
                              })
                            }
                          />
                          <Field
                            label="Значение"
                            value={fact.value}
                            disabled={readonly}
                            onChange={(event) =>
                              updateDraft((next) => {
                                next.about.basicFacts[index].value = event.target.value;
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="ap-grid ap-grid-2">
                          <Field
                            label="Ссылка"
                            value={fact.link || ""}
                            disabled={readonly}
                            onChange={(event) =>
                              updateDraft((next) => {
                                next.about.basicFacts[index].link = event.target.value;
                                return next;
                              })
                            }
                          />
                          <Toggle
                            label="Показывать"
                            checked={fact.isPublished !== false}
                            disabled={readonly}
                            onChange={(event) =>
                              updateDraft((next) => {
                                next.about.basicFacts[index].isPublished = event.target.checked;
                                return next;
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                />
              </Panel>

              <Panel title="Таблицы /about">
                <TextField
                  label="Образование: заголовки колонок (каждый с новой строки)"
                  value={listToMultiline(draft.about.education.headers)}
                  rows={6}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.education.headers = multilineToList(event.target.value);
                      return next;
                    })
                  }
                />
                <TextField
                  label="Образование: строки таблицы (разделитель |)"
                  value={listToTableText(draft.about.education.rows)}
                  rows={6}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.education.rows = tableTextToList(event.target.value);
                      return next;
                    })
                  }
                />
                <TextField
                  label="Руководство: заголовки колонок (каждый с новой строки)"
                  value={listToMultiline(draft.about.management.headers)}
                  rows={4}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.management.headers = multilineToList(event.target.value);
                      return next;
                    })
                  }
                />
                <TextField
                  label="Руководство: строки таблицы (разделитель |)"
                  value={listToTableText(draft.about.management.rows)}
                  rows={4}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.management.rows = tableTextToList(event.target.value);
                      return next;
                    })
                  }
                />
                <TextField
                  label="Финансы: заголовки колонок (каждый с новой строки)"
                  value={listToMultiline(draft.about.financial.headers)}
                  rows={3}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.financial.headers = multilineToList(event.target.value);
                      return next;
                    })
                  }
                />
                <TextField
                  label="Финансы: строки таблицы (разделитель |)"
                  value={listToTableText(draft.about.financial.rows)}
                  rows={4}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.financial.rows = tableTextToList(event.target.value);
                      return next;
                    })
                  }
                />
              </Panel>

              <Panel title="О разделе «Образование»">
                <TextField
                  label="Поясняющий текст"
                  value={draft.about.education.note}
                  rows={3}
                  disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      next.about.education.note = event.target.value;
                      return next;
                    })
                  }
                />
              </Panel>

              <Panel title="Лицензия">
                <div className="ap-grid ap-grid-2">
                  <TextField
                    label="Текст-заглушка"
                    rows={3}
                    value={draft.about.extra.license?.placeholder || ""}
                    disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      if (!next.about.extra.license) {
                        next.about.extra.license = { placeholder: "", registryLabel: "", registryUrl: "" };
                      }
                      next.about.extra.license.placeholder = event.target.value;
                      return next;
                    })
                  }
                />
                  <Field
                    label="Подпись ссылки в реестр"
                    value={draft.about.extra.license?.registryLabel || ""}
                    disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      if (!next.about.extra.license) {
                        next.about.extra.license = { placeholder: "", registryLabel: "", registryUrl: "" };
                      }
                      next.about.extra.license.registryLabel = event.target.value;
                      return next;
                    })
                  }
                />
                  <Field
                    label="Ссылка в реестр"
                    value={draft.about.extra.license?.registryUrl || ""}
                    disabled={readonly}
                  onChange={(event) =>
                    updateDraft((next) => {
                      if (!next.about.extra.license) {
                        next.about.extra.license = { placeholder: "", registryLabel: "", registryUrl: "" };
                      }
                      next.about.extra.license.registryUrl = event.target.value;
                      return next;
                    })
                  }
                />
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === "modals" ? (
            <Panel
              title={`Модальные окна (${Array.isArray(draft.modals) ? draft.modals.length : 0})`}
              subtitle="Все модальные окна отображаются ниже. Здесь редактируются заголовки и содержимое в удобных полях."
            >
              <div className="ap-list">
                {(Array.isArray(draft.modals) ? draft.modals : []).map((entry, index) => (
                  <article className="ap-item" key={entry.id || `modal-${index}`}>
                    <div className="ap-item-head">
                      <span className="ap-item-index">{index + 1}</span>
                      <strong>{entry.id || "modal-id"}</strong>
                    </div>
                    <div className="ap-item-body ap-item-doc">
                      <div className="ap-item-fields">
                        <Field
                          label="Заголовок"
                          value={entry.title || ""}
                          disabled={readonly}
                          onChange={(event) =>
                            updateDraft((next) => {
                              const idx = next.modals.findIndex((modalEntry) => modalEntry.id === entry.id);
                              if (idx >= 0) {
                                next.modals[idx].title = event.target.value;
                              }
                              return next;
                            })
                          }
                        />
                        <ModalBodyEditor
                          entry={entry}
                          readonly={readonly}
                          onChange={(nextBodyHtml) =>
                            updateDraft((next) => {
                              const idx = next.modals.findIndex((modalEntry) => modalEntry.id === entry.id);
                              if (idx >= 0) {
                                next.modals[idx].bodyHtml = nextBodyHtml;
                              }
                              return next;
                            })
                          }
                        />
                        <Toggle
                          label="Показывать модальное окно"
                          checked={entry.isPublished !== false}
                          disabled={readonly}
                          onChange={(event) =>
                            updateDraft((next) => {
                              const idx = next.modals.findIndex((modalEntry) => modalEntry.id === entry.id);
                              if (idx >= 0) {
                                next.modals[idx].isPublished = event.target.checked;
                              }
                              return next;
                            })
                          }
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          {tab === "users" && canManageUsersNow ? (
            <Panel title="Пользователи" subtitle="Роли и безопасная смена паролей">
              <p className="ap-feedback ap-feedback-muted">Для смены пароля и другой личной информации нажмите «Сохранить изменения» в карточке пользователя и подтвердите действие в модальном окне.</p>

              <div className="ap-list">
                {cmsState.users.map((user, index) => {
                  const isOpen = expandedUsers[user.id] ?? index === 0;
                  const isEditing = Boolean(editingUsers[user.id]);
                  const userDraft = userEditDrafts[user.id] || makeUserDraft(user);
                  return (
                    <article key={user.id} className="ap-item ap-user-item">
                        <button
                          type="button"
                          className={`ap-accordion-btn${isOpen ? " is-open" : ""}`}
                          onClick={() => toggleUserExpanded(user.id, isOpen)}
                        >
                          <span className="ap-accordion-title">{user.name || `Пользователь ${index + 1}`}</span>
                          <span className="ap-accordion-meta">{user.login} · {ROLE_LABELS[user.role]}</span>
                          <span className="ap-accordion-icon" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                        </button>

                        {isOpen ? (
                          <div className="ap-item-body ap-item-doc">
                            <div className="ap-item-fields">
                              <div className="ap-grid ap-grid-4">
                                <Field
                                  label="ФИО"
                                  value={isEditing ? userDraft.name : user.name}
                                  disabled={!isEditing}
                                  onChange={(event) => patchUserDraft(user.id, { name: event.target.value })}
                                />
                                <Field
                                  label="Логин"
                                  value={isEditing ? userDraft.login : user.login}
                                  disabled={!isEditing}
                                  onChange={(event) => patchUserDraft(user.id, { login: event.target.value })}
                                />
                                <Field
                                  label="Новый пароль"
                                  type="password"
                                  value={isEditing ? userDraft.newPassword : ""}
                                  disabled={!isEditing}
                                  onChange={(event) => patchUserDraft(user.id, { newPassword: event.target.value })}
                                />
                                <Field
                                  label="Повторите пароль"
                                  type="password"
                                  value={isEditing ? userDraft.repeatPassword : ""}
                                  disabled={!isEditing}
                                  onChange={(event) => patchUserDraft(user.id, { repeatPassword: event.target.value })}
                                />
                              </div>

                              <div className="ap-user-footer">
                                <label className="ap-field ap-role-field">
                                  <span>Роль</span>
                                  <select
                                    value={isEditing ? userDraft.role : user.role}
                                    disabled={!isEditing}
                                    onChange={(event) => {
                                      const nextRole = event.target.value;
                                      patchUserDraft(user.id, { role: nextRole });
                                    }}
                                  >
                                    <option value={ROLE_ADMIN}>Администратор</option>
                                    <option value={ROLE_EDITOR}>Редактор</option>
                                    <option value={ROLE_VIEWER}>Наблюдатель</option>
                                  </select>
                                </label>

                                <div className="ap-item-actions ap-user-actions">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="ap-btn ap-btn-ghost"
                                        onClick={() => cancelUserEditing(user.id)}
                                      >
                                        Отменить
                                      </button>
                                      <button
                                        type="button"
                                        className="ap-btn ap-btn-primary"
                                        onClick={() => openPasswordGate(user)}
                                      >
                                        Сохранить изменения
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="ap-btn ap-btn-ghost"
                                      onClick={() => startUserEditing(user)}
                                    >
                                      Редактировать
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="ap-btn ap-btn-danger"
                                    onClick={async () => {
                                      if (session && user.id === session.id) {
                                        setFeedback("Нельзя удалить текущую активную учётную запись");
                                        return;
                                      }
                                      const nextUsers = cmsState.users.filter((_, idx) => idx !== index);
                                      const adminCount = nextUsers.filter((item) => item.role === ROLE_ADMIN).length;
                                      if (adminCount < 1) {
                                        setFeedback("Нельзя удалить последнюю учётную запись администратора");
                                        return;
                                      }
                                      await updateUsers(() => nextUsers, "Пользователь удалён");
                                      setUserEditDrafts((prev) => {
                                        const next = { ...prev };
                                        delete next[user.id];
                                        return next;
                                      });
                                      setEditingUsers((prev) => {
                                        const next = { ...prev };
                                        delete next[user.id];
                                        return next;
                                      });
                                      setExpandedUsers((prev) => {
                                        const next = { ...prev };
                                        delete next[user.id];
                                        return next;
                                      });
                                      if (passwordGateUserId === user.id) {
                                        closePasswordGate();
                                      }
                                    }}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="ap-btn ap-btn-plus"
                onClick={async () => {
                  const nextUsers = [
                    ...cmsState.users,
                    {
                      id: makeId("user"),
                      name: "Новый пользователь",
                      login: `user${cmsState.users.length + 1}`,
                      role: ROLE_VIEWER,
                      createdAt: new Date().toISOString()
                    }
                  ];
                  await updateUsers(() => nextUsers, "Пользователь добавлен. Задайте пароль через «Редактировать»");
                }}
              >
                <span>+</span>
                <span>Добавить пользователя</span>
              </button>
            </Panel>
          ) : null}

        </section>
      </div>
      </main>

      {isPasswordGateOpen ? (
        <div className="ap-modal-layer" role="dialog" aria-modal="true" aria-labelledby="password-gate-title">
          <div className="ap-modal-overlay" onClick={closePasswordGate} />
          <section className="ap-modal-card">
            <header className="ap-modal-head">
              <h3 id="password-gate-title">Подтвердите сохранение изменений</h3>
              <p>Введите текущий логин администратора, пароль и кодовое слово.</p>
            </header>

            <div className="ap-modal-body">
              <p className="ap-modal-user">
                Пользователь: <strong>{passwordGateTargetUser?.name || passwordGateTargetUser?.login || "—"}</strong>
              </p>
              <div className="ap-grid ap-modal-grid">
                <Field
                  label="Логин для подтверждения"
                  value={passwordGateForm.login}
                  autoComplete="username"
                  onChange={(event) => setPasswordGateForm((prev) => ({ ...prev, login: event.target.value }))}
                />
                <Field
                  label="Пароль для подтверждения"
                  type="password"
                  autoComplete="current-password"
                  value={passwordGateForm.password}
                  onChange={(event) => setPasswordGateForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <Field
                  label="Кодовое слово"
                  type="password"
                  value={passwordGateForm.codeword}
                  onChange={(event) => setPasswordGateForm((prev) => ({ ...prev, codeword: event.target.value }))}
                />
              </div>
            </div>

            <footer className="ap-modal-actions">
              <button type="button" className="ap-btn ap-btn-ghost" disabled={passwordGateBusy} onClick={closePasswordGate}>
                Отмена
              </button>
              <button
                type="button"
                className="ap-btn ap-btn-primary"
                disabled={passwordGateBusy}
                onClick={() => {
                  void confirmPasswordGate();
                }}
              >
                {passwordGateBusy ? "Проверяем..." : "Сохранить изменения"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
