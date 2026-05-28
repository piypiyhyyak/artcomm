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
  clearSession,
  flushDraftSync,
  getSession,
  hashPassword,
  loadCmsState,
  makeId,
  publishDraft,
  refreshCmsStateFromServer,
  restoreSessionFromServer,
  saveDraft,
  setUserPassword,
  setUsersRemote,
  verifySensitiveAuth
} from "./cms/storage";

const NAV_ITEMS = [
  { key: "dashboard", label: "Главная" },
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
const SECURITY_CODEWORD_HASH = "8fd706e21340a5033ccd4270f22c051de24cabb6b1c4c3ad8f61dc7fb8ad22d6";

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
  uploadFolder
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
        itemClassName="ap-item-media"
        getKey={(item, index) => item.id || `${idPrefix}-${index}`}
        onReorder={onChange}
        renderItem={(item, index) => {
          const preview = localPreviewMap[item.id] || item[imageKey];
          return (
            <div className="ap-item-body">
              <div className="ap-thumb-wrap">
                {preview ? <img src={preview} alt="preview" className="ap-thumb" /> : <div className="ap-thumb-empty">Нет превью</div>}
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
                    await onDeleteFile(previousPath);
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
                  await onDeleteFile(previousPath);
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

export default function AdminApp() {
  const [session, setSession] = useState(() => getSession());
  const [cmsState, setCmsState] = useState(() => loadCmsState());
  const [tab, setTab] = useState("dashboard");
  const [feedback, setFeedback] = useState("");
  const [authForm, setAuthForm] = useState({ login: "", password: "" });
  const [localImagePreviews, setLocalImagePreviews] = useState({});
  const [localVideoPreviews, setLocalVideoPreviews] = useState({});
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [userPasswordDrafts, setUserPasswordDrafts] = useState({});
  const [userPasswordConfirmDrafts, setUserPasswordConfirmDrafts] = useState({});
  const [passwordGateForm, setPasswordGateForm] = useState({ login: "", password: "", codeword: "" });

  const draft = cmsState.draft;
  const readonly = !session || !canEdit(session.role);
  const editLocked = readonly || isProcessingFiles;
  const canPublishNow = session && canPublish(session.role);
  const canManageUsersNow = session && canManageUsers(session.role);

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
    const nextDraft = mutator(cloneDeep(draft));
    const nextState = saveDraft(() => nextDraft);
    syncState(nextState, message);
  }

  async function updateUsers(mutator, message = "Пользователи обновлены") {
    const nextUsers = mutator(cloneDeep(cmsState.users));
    const nextState = await setUsersRemote(nextUsers);
    syncState(nextState, message);
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

  async function handleDeleteFile(filePath) {
    const normalizedPath = String(filePath || "").trim();
    if (!isProjectAssetPath(normalizedPath)) {
      return false;
    }

    const draftRefs = countAssetPathOccurrences(draft, normalizedPath);
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
              subtitle="Все модальные окна отображаются ниже. Здесь редактируются их заголовки и HTML."
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
                        <TextField
                          label="HTML-контент"
                          rows={10}
                          value={entry.bodyHtml || ""}
                          disabled={readonly}
                          onChange={(event) =>
                            updateDraft((next) => {
                              const idx = next.modals.findIndex((modalEntry) => modalEntry.id === entry.id);
                              if (idx >= 0) {
                                next.modals[idx].bodyHtml = event.target.value;
                              }
                              return next;
                            })
                          }
                        />
                        <Toggle
                          label="Показывать модалку"
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
              <div className="ap-grid ap-grid-3">
                <Field
                  label="Логин для подтверждения"
                  value={passwordGateForm.login}
                  onChange={(event) => setPasswordGateForm((prev) => ({ ...prev, login: event.target.value }))}
                />
                <Field
                  label="Пароль для подтверждения"
                  type="password"
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

              <div className="ap-list">
                {cmsState.users.map((user, index) => (
                  <article key={user.id} className="ap-item">
                    <div className="ap-item-body ap-item-doc">
                      <div className="ap-item-fields">
                        <div className="ap-grid ap-grid-4">
                          <Field
                            label="ФИО"
                            value={user.name}
                            onChange={(event) =>
                              updateUsers((nextUsers) => {
                                nextUsers[index].name = event.target.value;
                                return nextUsers;
                              })
                            }
                          />
                          <Field
                            label="Логин"
                            value={user.login}
                            onChange={(event) =>
                              updateUsers((nextUsers) => {
                                nextUsers[index].login = event.target.value;
                                return nextUsers;
                              })
                            }
                          />
                          <Field
                            label="Новый пароль"
                            type="password"
                            value={userPasswordDrafts[user.id] || ""}
                            onChange={(event) =>
                              setUserPasswordDrafts((prev) => ({
                                ...prev,
                                [user.id]: event.target.value
                              }))
                            }
                          />
                          <Field
                            label="Повторите пароль"
                            type="password"
                            value={userPasswordConfirmDrafts[user.id] || ""}
                            onChange={(event) =>
                              setUserPasswordConfirmDrafts((prev) => ({
                                ...prev,
                                [user.id]: event.target.value
                              }))
                            }
                          />
                        </div>

                        <div className="ap-item-actions">
                          <label className="ap-field ap-role-field">
                            <span>Роль</span>
                            <select
                              value={user.role}
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                const isDemotingAdmin = user.role === ROLE_ADMIN && nextRole !== ROLE_ADMIN;
                                if (isDemotingAdmin) {
                                  const adminsLeft = cmsState.users.filter((item) => item.role === ROLE_ADMIN && item.id !== user.id).length;
                                  if (adminsLeft < 1) {
                                    setFeedback("В системе должен оставаться минимум один администратор");
                                    return;
                                  }
                                }
                                updateUsers((nextUsers) => {
                                  nextUsers[index].role = nextRole;
                                  return nextUsers;
                                });
                              }}
                            >
                              <option value={ROLE_ADMIN}>Администратор</option>
                              <option value={ROLE_EDITOR}>Редактор</option>
                              <option value={ROLE_VIEWER}>Просмотр</option>
                            </select>
                          </label>

                          <button
                            type="button"
                            className="ap-btn ap-btn-ghost"
                            onClick={async () => {
                              const nextPassword = (userPasswordDrafts[user.id] || "").trim();
                              const repeatPassword = (userPasswordConfirmDrafts[user.id] || "").trim();

                              if (!nextPassword || !repeatPassword) {
                                setFeedback("Введите новый пароль и подтверждение");
                                return;
                              }
                              if (nextPassword !== repeatPassword) {
                                setFeedback("Пароль и подтверждение не совпадают");
                                return;
                              }
                              if (nextPassword.length < 8) {
                                setFeedback("Пароль должен содержать минимум 8 символов");
                                return;
                              }
                              if (!passwordGateForm.login || !passwordGateForm.password || !passwordGateForm.codeword) {
                                setFeedback("Для смены пароля заполните блок подтверждения безопасности");
                                return;
                              }

                              const codewordHash = await hashPassword(passwordGateForm.codeword.trim());
                              if (codewordHash !== SECURITY_CODEWORD_HASH) {
                                setFeedback("Неверное кодовое слово");
                                return;
                              }

                              const gate = await verifySensitiveAuth(passwordGateForm.login.trim(), passwordGateForm.password);
                              if (!gate.user) {
                                setFeedback("Повторная авторизация не пройдена");
                                return;
                              }

                              if (!session || gate.user.id !== session.id) {
                                setFeedback("Подтверждение должно быть выполнено под текущей админ-учёткой");
                                return;
                              }

                              try {
                                const nextState = await setUserPassword(user.id, nextPassword, {
                                  authLogin: passwordGateForm.login.trim(),
                                  authPassword: passwordGateForm.password,
                                  codeword: passwordGateForm.codeword.trim(),
                                  sessionUserId: session.id
                                });
                                setUserPasswordDrafts((prev) => ({ ...prev, [user.id]: "" }));
                                setUserPasswordConfirmDrafts((prev) => ({ ...prev, [user.id]: "" }));
                                setPasswordGateForm((prev) => ({ ...prev, password: "", codeword: "" }));
                                syncState(nextState, "Пароль обновлён");
                              } catch {
                                setFeedback("Не удалось обновить пароль");
                              }
                            }}
                          >
                            Сохранить пароль
                          </button>

                          <button
                            type="button"
                            className="ap-btn ap-btn-danger"
                            onClick={async () => {
                              if (session && user.id === session.id) {
                                setFeedback("Нельзя удалить текущую активную учётную запись");
                                return;
                              }
                              const nextUsers = cmsState.users.filter((_, idx) => idx !== index);
                              if (nextUsers.length < 3) {
                                setFeedback("По ТЗ должно быть минимум 3 учётные записи");
                                return;
                              }
                              const adminCount = nextUsers.filter((item) => item.role === ROLE_ADMIN).length;
                              if (adminCount < 1) {
                                setFeedback("Нельзя удалить последнюю учётную запись администратора");
                                return;
                              }
                              await updateUsers(() => nextUsers, "Пользователь удалён");
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
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
                      passwordHash: "e2186dbdb1bb4193608605e84f33208765b5693b55edd4f730a719a100eeea6f",
                      role: ROLE_VIEWER,
                      createdAt: new Date().toISOString()
                    }
                  ];
                  await updateUsers(() => nextUsers, "Пользователь добавлен (пароль: change-me)");
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
  );
}
