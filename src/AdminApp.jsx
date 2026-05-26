import React, { useMemo, useState } from "react";
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
  getSession,
  loadCmsState,
  makeId,
  publishDraft,
  resetCms,
  saveDraft,
  setUserPassword,
  setUsers
} from "./cms/storage";

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

function moveItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) {
    return list;
  }
  const next = [...list];
  const current = next[index];
  next[index] = next[target];
  next[target] = current;
  return next;
}

function Panel({ title, caption, children, compact }) {
  return (
    <section className={`admin-panel${compact ? " is-compact" : ""}`}>
      <header className="admin-panel-head">
        <h2>{title}</h2>
        {caption ? <p>{caption}</p> : null}
      </header>
      <div className="admin-panel-body">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input type={type} value={value || ""} onChange={onChange} placeholder={placeholder || ""} disabled={disabled} />
    </label>
  );
}

function TextField({ label, value, onChange, rows = 4, placeholder }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <textarea value={value || ""} rows={rows} onChange={onChange} placeholder={placeholder || ""} />
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function DocumentListEditor({
  title,
  items,
  onChange,
  readonly,
  allowStatus = true,
  hint
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Panel title={title} caption={hint} compact>
      <div className="admin-list">
        {safeItems.map((item, index) => (
          <article className="admin-item" key={item.id || `${title}-${index}`}>
            <div className="admin-item-grid">
              <Field
                label="Название"
                value={item.title}
                onChange={(event) => {
                  const next = [...safeItems];
                  next[index] = { ...item, title: event.target.value };
                  onChange(next);
                }}
              />
              <Field
                label="Ссылка (URL или /assets/...)"
                value={item.url}
                onChange={(event) => {
                  const next = [...safeItems];
                  next[index] = { ...item, url: event.target.value };
                  onChange(next);
                }}
              />
            </div>

            <div className="admin-item-actions">
              {allowStatus ? (
                <Toggle
                  label="Показывать на сайте"
                  checked={item.isPublished !== false}
                  disabled={readonly}
                  onChange={(event) => {
                    const next = [...safeItems];
                    next[index] = { ...item, isPublished: event.target.checked };
                    onChange(next);
                  }}
                />
              ) : null}

              <div className="admin-inline-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={readonly || index === 0}
                  onClick={() => onChange(moveItem(safeItems, index, -1))}
                >
                  Вверх
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={readonly || index === safeItems.length - 1}
                  onClick={() => onChange(moveItem(safeItems, index, 1))}
                >
                  Вниз
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
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
          </article>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={readonly}
        onClick={() => {
          onChange([
            ...safeItems,
            {
              id: makeId("doc"),
              title: "Новый документ",
              url: "",
              isPublished: false
            }
          ]);
        }}
      >
        Добавить элемент
      </button>
    </Panel>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(() => getSession());
  const [cmsState, setCmsState] = useState(() => loadCmsState());
  const [tab, setTab] = useState("dashboard");
  const [selectedModalId, setSelectedModalId] = useState(() => cmsState.draft.modals?.[0]?.id || "test");
  const [authForm, setAuthForm] = useState({ login: "", password: "" });
  const [userPasswordDrafts, setUserPasswordDrafts] = useState({});
  const [feedback, setFeedback] = useState("");

  const draft = cmsState.draft;
  const readonly = !session || !canEdit(session.role);
  const canPublishNow = session && canPublish(session.role);
  const canManageUsersNow = session && canManageUsers(session.role);

  const activeModal = useMemo(() => {
    const list = Array.isArray(draft.modals) ? draft.modals : [];
    return list.find((item) => item.id === selectedModalId) || list[0] || null;
  }, [draft.modals, selectedModalId]);

  function syncState(nextState, message) {
    setCmsState(nextState);
    if (message) {
      setFeedback(message);
    }
  }

  function updateDraft(mutator, message) {
    if (readonly) {
      return;
    }
    const nextDraft = mutator(cloneDeep(draft));
    const nextState = saveDraft(() => nextDraft);
    syncState(nextState, message || "Черновик сохранён");
  }

  function updateUsers(mutator, message) {
    const nextUsers = mutator(cloneDeep(cmsState.users));
    const nextState = setUsers(nextUsers);
    syncState(nextState, message || "Пользователи обновлены");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const result = await authenticate(authForm.login.trim(), authForm.password);
    if (!result.session) {
      if (result.error === "locked" && result.retryAt) {
        const retryDate = new Date(result.retryAt).toLocaleString("ru-RU");
        setFeedback(`Слишком много попыток входа. Повторите после ${retryDate}.`);
        return;
      }
      setFeedback("Неверный логин или пароль");
      return;
    }
    setSession(result.session);
    setAuthForm({ login: "", password: "" });
    setFeedback(`Вход выполнен: ${ROLE_LABELS[result.session.role]}`);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setFeedback("Вы вышли из административной панели");
  }

  function openPublishedPage(pathname) {
    window.open(pathname, "_blank", "noopener,noreferrer");
  }

  if (!session) {
    return (
      <main className="admin-shell auth-shell">
        <section className="admin-auth-card">
          <h1>Административная панель АртКомм</h1>
          <p>
            Войдите по логину и паролю. Роли: <strong>Администратор</strong>, <strong>Редактор</strong>, <strong>Просмотр</strong>.
          </p>
          <form onSubmit={handleLogin} className="admin-auth-form">
            <Field
              label="Логин"
              value={authForm.login}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, login: event.target.value }))}
            />
            <Field
              label="Пароль"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button className="btn btn-primary" type="submit">
              Войти
            </button>
          </form>
          <div className="admin-auth-hint">
            <p>Тестовые данные:</p>
            <ul>
              <li>`admin / artcomm-admin-2026`</li>
              <li>`editor / artcomm-editor-2026`</li>
              <li>`viewer / artcomm-view-2026`</li>
            </ul>
          </div>
          {feedback ? <p className="admin-feedback">{feedback}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={`admin-shell${readonly ? " is-readonly" : ""}`}>
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">Админ-панель</p>
          <h1>Управление контентом сайта АртКомм</h1>
          <p className="admin-meta">
            Пользователь: <strong>{session.name}</strong> ({ROLE_LABELS[session.role]})
          </p>
        </div>
        <div className="admin-topbar-actions">
          <button className="btn btn-secondary" onClick={() => openPublishedPage("/")}>Главная</button>
          <button className="btn btn-secondary" onClick={() => openPublishedPage("/about")}>/about</button>
          <button className="btn btn-secondary" onClick={() => openPublishedPage("/documents")}>/documents</button>
          <button className="btn btn-primary" onClick={handleLogout}>Выйти</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Разделы админ-панели">
        {[
          ["dashboard", "Сводка"],
          ["home", "Главная"],
          ["modals", "Модальные окна"],
          ["about", "Сведения /about"],
          ["docs", "Файлы и документы"],
          ["users", "Пользователи"]
        ].map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab${tab === key ? " is-active" : ""}`}
            onClick={() => setTab(key)}
            disabled={key === "users" && !canManageUsersNow}
          >
            {label}
          </button>
        ))}
      </nav>

      {feedback ? <p className="admin-feedback is-inline">{feedback}</p> : null}
      {readonly ? <p className="admin-feedback is-inline">Режим просмотра: редактирование и публикация недоступны.</p> : null}

      {tab === "dashboard" ? (
        <div className="admin-grid">
          <Panel title="Статус публикации" caption="Черновик редактируется отдельно от опубликованной версии">
            <dl className="admin-stats">
              <div>
                <dt>Последнее изменение</dt>
                <dd>{cmsState.updatedAt || "—"}</dd>
              </div>
              <div>
                <dt>Последняя публикация</dt>
                <dd>{cmsState.publishedAt || "Публикации ещё не было"}</dd>
              </div>
              <div>
                <dt>Последний публикавший</dt>
                <dd>{cmsState.lastPublishedBy || "—"}</dd>
              </div>
            </dl>
            <div className="admin-inline-actions">
              <button
                className="btn btn-primary"
                disabled={!canPublishNow}
                onClick={() => {
                  const next = publishDraft(session.id);
                  syncState(next, "Черновик опубликован");
                }}
              >
                Опубликовать изменения
              </button>
              <button
                className="btn btn-secondary"
                disabled={!canManageUsersNow}
                onClick={() => {
                  const next = publishDraft(session.id);
                  syncState(next, "Контент повторно опубликован");
                }}
              >
                Переопубликовать
              </button>
              <button
                className="btn btn-secondary"
                disabled={!canManageUsersNow}
                onClick={() => {
                  const confirmed = window.confirm("Сбросить админку к базовым значениям? Это действие нельзя отменить.");
                  if (!confirmed) {
                    return;
                  }
                  const next = resetCms();
                  setSession(null);
                  setCmsState(next);
                  setFeedback("Система сброшена. Войдите повторно.");
                }}
              >
                Сброс CMS
              </button>
            </div>
          </Panel>

          <Panel title="Права ролей" compact>
            <ul className="admin-checklist">
              <li>Администратор: полный доступ + управление пользователями</li>
              <li>Редактор: редактирование, публикация, снятие с публикации</li>
              <li>Просмотр: только чтение без изменений</li>
            </ul>
          </Panel>
        </div>
      ) : null}

      {tab === "home" ? (
        <div className="admin-grid">
          <Panel title="Главный экран" caption="Редактирование текстов, CTA и линий доверия">
            <div className="admin-form-grid two-col">
              <Field
                label="Kicker"
                value={draft.home.hero.kicker}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.hero.title = event.target.value;
                    return next;
                  })
                }
              />
              <TextField
                label="Цитата"
                value={draft.home.hero.quote}
                rows={2}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.hero.quote = event.target.value;
                    return next;
                  })
                }
              />
            </div>
          </Panel>

          <Panel title="Кнопки Hero" compact>
            <div className="admin-list">
              {draft.home.hero.actions.map((action, index) => (
                <article className="admin-item" key={action.id}>
                  <div className="admin-item-grid">
                    <Field
                      label="Текст кнопки"
                      value={action.label}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.hero.actions[index].label = event.target.value;
                          return next;
                        })
                      }
                    />
                    <Field
                      label="Цель (#id или modal-id)"
                      value={action.target}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.hero.actions[index].target = event.target.value;
                          return next;
                        })
                      }
                    />
                  </div>

                  <div className="admin-item-grid three-col">
                    <label className="admin-field">
                      <span>Тип действия</span>
                      <select
                        value={action.type}
                        onChange={(event) =>
                          updateDraft((next) => {
                            next.home.hero.actions[index].type = event.target.value;
                            return next;
                          })
                        }
                      >
                        <option value="scroll">Scroll</option>
                        <option value="modal">Modal</option>
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Вид кнопки</span>
                      <select
                        value={action.variant}
                        onChange={(event) =>
                          updateDraft((next) => {
                            next.home.hero.actions[index].variant = event.target.value;
                            return next;
                          })
                        }
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                      </select>
                    </label>
                    <Toggle
                      label="Показывать"
                      checked={action.isPublished !== false}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.hero.actions[index].isPublished = event.target.checked;
                          return next;
                        })
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Слайды Hero" caption="Добавление, скрытие, сортировка" compact>
            <div className="admin-list">
              {draft.home.slides.map((slide, index) => (
                <article className="admin-item" key={slide.id}>
                  <div className="admin-item-grid">
                    <Field
                      label="Путь к изображению"
                      value={slide.image}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.slides[index].image = event.target.value;
                          return next;
                        })
                      }
                    />
                    <Field
                      label="Alt-текст"
                      value={slide.alt}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.slides[index].alt = event.target.value;
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="admin-item-actions">
                    <Toggle
                      label="Показывать"
                      checked={slide.isPublished !== false}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.slides[index].isPublished = event.target.checked;
                          return next;
                        })
                      }
                    />
                    <div className="admin-inline-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          updateDraft((next) => {
                            next.home.slides = moveItem(next.home.slides, index, -1);
                            return next;
                          })
                        }
                        disabled={index === 0}
                      >
                        Вверх
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          updateDraft((next) => {
                            next.home.slides = moveItem(next.home.slides, index, 1);
                            return next;
                          })
                        }
                        disabled={index === draft.home.slides.length - 1}
                      >
                        Вниз
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          updateDraft((next) => {
                            next.home.slides.splice(index, 1);
                            return next;
                          })
                        }
                        disabled={draft.home.slides.length <= 1}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() =>
                updateDraft((next) => {
                  next.home.slides.push({
                    id: makeId("slide"),
                    image: "/assets/hero-1.jpeg",
                    alt: "Новый слайд",
                    isPublished: false
                  });
                  return next;
                })
              }
            >
              Добавить слайд
            </button>
          </Panel>

          <Panel title="Блок МедиаСтанции" compact>
            <div className="admin-form-grid two-col">
              <Field
                label="Kicker"
                value={draft.home.mediaStation.kicker}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.mediaStation.title = event.target.value;
                    return next;
                  })
                }
              />
              <TextField
                label="Подзаголовок"
                rows={2}
                value={draft.home.mediaStation.subtitle}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.mediaStation.caption = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Видео Desktop"
                value={draft.home.mediaStation.videoDesktop}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.mediaStation.videoDesktop = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Видео Mobile (быстрое)"
                value={draft.home.mediaStation.videoMobile}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.mediaStation.videoMobile = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Fallback видео"
                value={draft.home.mediaStation.videoFallback}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.mediaStation.videoFallback = event.target.value;
                    return next;
                  })
                }
              />
            </div>
            <p className="admin-note">
              Для прода используйте полный файл: <code>/assets/gimn-ed-zy9mar.mp4</code>. Быстрый вариант оставляйте только в поле Mobile.
            </p>
          </Panel>

          <Panel title="Контакты и ссылки" compact>
            <div className="admin-form-grid two-col">
              <Field
                label="Режим работы (подпись)"
                value={draft.home.contacts.scheduleLabel}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.scheduleLabel = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Режим работы"
                value={draft.home.contacts.scheduleValue}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.scheduleValue = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Телефон"
                value={draft.home.contacts.phone}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.phone = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Телефон href"
                value={draft.home.contacts.phoneHref}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.email = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="E-mail href"
                value={draft.home.contacts.emailHref}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.emailHref = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Telegram label"
                value={draft.home.contacts.telegramLabel}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.telegramUrl = event.target.value;
                    return next;
                  })
                }
              />
              <Field
                label="Max label"
                value={draft.home.contacts.maxLabel}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.home.contacts.maxUrl = event.target.value;
                    return next;
                  })
                }
              />
            </div>
          </Panel>

          <Panel title="Блок «Нам доверяют»" compact>
            <div className="admin-list">
              {draft.home.trustedPartners.map((partner, index) => (
                <article className="admin-item" key={partner.id}>
                  <div className="admin-item-grid two-col">
                    <Field
                      label="Название"
                      value={partner.name}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].name = event.target.value;
                          return next;
                        })
                      }
                    />
                    <Field
                      label="Логотип"
                      value={partner.logo}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].logo = event.target.value;
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="admin-item-grid four-col">
                    <Field
                      label="X (0-100)"
                      value={String(partner.x)}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].x = Number(event.target.value) || 0;
                          return next;
                        })
                      }
                    />
                    <Field
                      label="Y (0-100)"
                      value={String(partner.y)}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].y = Number(event.target.value) || 0;
                          return next;
                        })
                      }
                    />
                    <Field
                      label="Range"
                      value={String(partner.range)}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].range = Number(event.target.value) || 40;
                          return next;
                        })
                      }
                    />
                    <Toggle
                      label="Показывать"
                      checked={partner.isPublished !== false}
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.home.trustedPartners[index].isPublished = event.target.checked;
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="admin-inline-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.home.trustedPartners = moveItem(next.home.trustedPartners, index, -1);
                          return next;
                        })
                      }
                      disabled={index === 0}
                    >
                      Вверх
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.home.trustedPartners = moveItem(next.home.trustedPartners, index, 1);
                          return next;
                        })
                      }
                      disabled={index === draft.home.trustedPartners.length - 1}
                    >
                      Вниз
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.home.trustedPartners.splice(index, 1);
                          return next;
                        })
                      }
                      disabled={draft.home.trustedPartners.length <= 1}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() =>
                updateDraft((next) => {
                  next.home.trustedPartners.push({
                    id: makeId("trusted"),
                    name: "Новый партнёр",
                    logo: "/assets/logos/asi.png",
                    x: 50,
                    y: 50,
                    range: 40,
                    isPublished: false
                  });
                  return next;
                })
              }
            >
              Добавить партнёра
            </button>
          </Panel>
        </div>
      ) : null}

      {tab === "modals" ? (
        <div className="admin-grid">
          <Panel title="Модальные окна" caption="Редактирование заголовков и содержимого (HTML)" compact>
            <div className="admin-form-grid two-col">
              <label className="admin-field">
                <span>Выберите модалку</span>
                <select
                  value={activeModal?.id || ""}
                  onChange={(event) => setSelectedModalId(event.target.value)}
                >
                  {draft.modals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </label>

              <Toggle
                label="Показывать модалку"
                checked={activeModal?.isPublished !== false}
                onChange={(event) =>
                  updateDraft((next) => {
                    const index = next.modals.findIndex((item) => item.id === activeModal.id);
                    if (index >= 0) {
                      next.modals[index].isPublished = event.target.checked;
                    }
                    return next;
                  })
                }
              />
            </div>

            {activeModal ? (
              <div className="admin-form-grid">
                <Field
                  label="Заголовок"
                  value={activeModal.title}
                  onChange={(event) =>
                    updateDraft((next) => {
                      const index = next.modals.findIndex((item) => item.id === activeModal.id);
                      if (index >= 0) {
                        next.modals[index].title = event.target.value;
                      }
                      return next;
                    })
                  }
                />
                <TextField
                  label="HTML контент"
                  rows={14}
                  value={activeModal.bodyHtml}
                  onChange={(event) =>
                    updateDraft((next) => {
                      const index = next.modals.findIndex((item) => item.id === activeModal.id);
                      if (index >= 0) {
                        next.modals[index].bodyHtml = event.target.value;
                      }
                      return next;
                    })
                  }
                />
              </div>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {tab === "about" ? (
        <div className="admin-grid">
          <Panel title="Hero /about" compact>
            <div className="admin-form-grid two-col">
              <Field
                label="Kicker"
                value={draft.about.hero.kicker}
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
                onChange={(event) =>
                  updateDraft((next) => {
                    next.about.hero.description = event.target.value;
                    return next;
                  })
                }
              />
            </div>
          </Panel>

          <Panel title="Основные сведения" caption="Факты организации" compact>
            <div className="admin-list">
              {draft.about.basicFacts.map((fact, index) => (
                <article className="admin-item" key={fact.id}>
                  <div className="admin-item-grid two-col">
                    <Field
                      label="Поле"
                      value={fact.label}
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
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.about.basicFacts[index].value = event.target.value;
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="admin-item-grid two-col">
                    <Field
                      label="Ссылка (необязательно)"
                      value={fact.link || ""}
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
                      onChange={(event) =>
                        updateDraft((next) => {
                          next.about.basicFacts[index].isPublished = event.target.checked;
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="admin-inline-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.about.basicFacts = moveItem(next.about.basicFacts, index, -1);
                          return next;
                        })
                      }
                      disabled={index === 0}
                    >
                      Вверх
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.about.basicFacts = moveItem(next.about.basicFacts, index, 1);
                          return next;
                        })
                      }
                      disabled={index === draft.about.basicFacts.length - 1}
                    >
                      Вниз
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        updateDraft((next) => {
                          next.about.basicFacts.splice(index, 1);
                          return next;
                        })
                      }
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() =>
                updateDraft((next) => {
                  next.about.basicFacts.push({
                    id: makeId("fact"),
                    label: "Новый факт",
                    value: "",
                    link: "",
                    isPublished: true
                  });
                  return next;
                })
              }
            >
              Добавить факт
            </button>
          </Panel>

          <DocumentListEditor
            title="Документы — Основные сведения"
            items={draft.about.documentsBasic}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.documentsBasic = nextItems;
                return next;
              })
            }
          />

          <DocumentListEditor
            title="Документы — раздел /about"
            items={draft.about.documentsMain}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.documentsMain = nextItems;
                return next;
              })
            }
          />

          <Panel title="Образование" caption="Таблица: разделитель столбцов — символ |" compact>
            <TextField
              label="Пояснение"
              rows={2}
              value={draft.about.education.note}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.education.note = event.target.value;
                  return next;
                })
              }
            />
            <TextField
              label="Заголовки таблицы (по одному в строке)"
              rows={6}
              value={(draft.about.education.headers || []).join("\n")}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.education.headers = event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                  return next;
                })
              }
            />
            <TextField
              label="Строки таблицы"
              rows={8}
              value={listToTableText(draft.about.education.rows)}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.education.rows = tableTextToList(event.target.value);
                  return next;
                })
              }
            />
            <DocumentListEditor
              title="Ссылки в разделе Образование"
              items={draft.about.education.links}
              readonly={readonly}
              onChange={(nextItems) =>
                updateDraft((next) => {
                  next.about.education.links = nextItems;
                  return next;
                })
              }
              hint="Например, PDF программы"
            />
          </Panel>

          <Panel title="Руководство" caption="Таблица: ФИО | Должность | Телефон | E-mail" compact>
            <TextField
              label="Заголовки таблицы (по одному в строке)"
              rows={4}
              value={(draft.about.management.headers || []).join("\n")}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.management.headers = event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                  return next;
                })
              }
            />
            <TextField
              label="Строки руководства"
              rows={6}
              value={listToTableText(draft.about.management.rows)}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.management.rows = tableTextToList(event.target.value);
                  return next;
                })
              }
            />
          </Panel>

          <Panel title="Финансово-хозяйственная деятельность" compact>
            <TextField
              label="Пояснение"
              rows={2}
              value={draft.about.financial.note}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.financial.note = event.target.value;
                  return next;
                })
              }
            />
            <TextField
              label="Заголовки (по одному в строке)"
              rows={3}
              value={(draft.about.financial.headers || []).join("\n")}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.financial.headers = event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                  return next;
                })
              }
            />
            <TextField
              label="Строки таблицы"
              rows={5}
              value={listToTableText(draft.about.financial.rows)}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.financial.rows = tableTextToList(event.target.value);
                  return next;
                })
              }
            />
          </Panel>

          <DocumentListEditor
            title="Педагогический состав"
            items={draft.about.extra.pedagogy}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.extra.pedagogy = nextItems;
                return next;
              })
            }
          />

          <DocumentListEditor
            title="Платные образовательные услуги"
            items={draft.about.extra.paidServices}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.extra.paidServices = nextItems;
                return next;
              })
            }
          />

          <DocumentListEditor
            title="Образовательные стандарты"
            items={draft.about.extra.standards}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.extra.standards = nextItems;
                return next;
              })
            }
          />

          <Panel title="Лицензия" compact>
            <TextField
              label="Плейсхолдер"
              rows={2}
              value={draft.about.extra.license.placeholder}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.extra.license.placeholder = event.target.value;
                  return next;
                })
              }
            />
            <Field
              label="Текст ссылки"
              value={draft.about.extra.license.registryLabel}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.extra.license.registryLabel = event.target.value;
                  return next;
                })
              }
            />
            <Field
              label="URL реестра"
              value={draft.about.extra.license.registryUrl}
              onChange={(event) =>
                updateDraft((next) => {
                  next.about.extra.license.registryUrl = event.target.value;
                  return next;
                })
              }
            />
          </Panel>

          <DocumentListEditor
            title="Образовательные программы"
            items={draft.about.extra.programs}
            readonly={readonly}
            onChange={(nextItems) =>
              updateDraft((next) => {
                next.about.extra.programs = nextItems;
                return next;
              })
            }
          />
        </div>
      ) : null}

      {tab === "docs" ? (
        <div className="admin-grid">
          <Panel
            title="Файлы и документы"
            caption="Поддерживаемые форматы: PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/WebP. В текущей версии панели вы управляете URL/путями к загруженным файлам."
          >
            <p className="admin-note">
              Рекомендуемый путь для статических файлов: <code>/assets/имя-файла.ext</code>. Для внешних документов можно использовать полный URL.
            </p>
            <DocumentListEditor
              title="Список обязательных документов"
              items={draft.about.documentsMain}
              readonly={readonly}
              onChange={(nextItems) =>
                updateDraft((next) => {
                  next.about.documentsMain = nextItems;
                  return next;
                })
              }
            />
            <DocumentListEditor
              title="Документы по основным сведениям"
              items={draft.about.documentsBasic}
              readonly={readonly}
              onChange={(nextItems) =>
                updateDraft((next) => {
                  next.about.documentsBasic = nextItems;
                  return next;
                })
              }
            />
            <DocumentListEditor
              title="Платные услуги"
              items={draft.about.extra.paidServices}
              readonly={readonly}
              onChange={(nextItems) =>
                updateDraft((next) => {
                  next.about.extra.paidServices = nextItems;
                  return next;
                })
              }
            />
          </Panel>
        </div>
      ) : null}

      {tab === "users" && canManageUsersNow ? (
        <div className="admin-grid">
          <Panel title="Пользователи и роли" caption="Минимум 3 учётные записи по ТЗ" compact>
            <div className="admin-list">
              {cmsState.users.map((user, index) => (
                <article className="admin-item" key={user.id}>
                  <div className="admin-item-grid three-col">
                    <Field
                      label="Имя"
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
                      placeholder="Оставьте пустым, если без изменений"
                      value={userPasswordDrafts[user.id] || ""}
                      onChange={(event) =>
                        setUserPasswordDrafts((prev) => ({
                          ...prev,
                          [user.id]: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="admin-item-actions">
                    <label className="admin-field">
                      <span>Роль</span>
                      <select
                        value={user.role}
                        onChange={(event) =>
                          updateUsers((nextUsers) => {
                            nextUsers[index].role = event.target.value;
                            return nextUsers;
                          }, "Роль обновлена")
                        }
                      >
                        <option value={ROLE_ADMIN}>Администратор</option>
                        <option value={ROLE_EDITOR}>Редактор</option>
                        <option value={ROLE_VIEWER}>Просмотр</option>
                      </select>
                    </label>

                    <button
                      className="btn btn-secondary"
                      onClick={async () => {
                        const nextPassword = (userPasswordDrafts[user.id] || "").trim();
                        if (!nextPassword) {
                          setFeedback("Введите новый пароль перед сохранением");
                          return;
                        }
                        if (nextPassword.length < 8) {
                          setFeedback("Пароль должен содержать минимум 8 символов");
                          return;
                        }
                        const nextState = await setUserPassword(user.id, nextPassword);
                        setUserPasswordDrafts((prev) => ({ ...prev, [user.id]: "" }));
                        syncState(nextState, "Пароль пользователя обновлён");
                      }}
                    >
                      Сохранить пароль
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        const nextUsers = cmsState.users.filter((_, idx) => idx !== index);
                        if (nextUsers.length < 3) {
                          setFeedback("По ТЗ должно быть минимум 3 учётные записи");
                          return;
                        }
                        const nextState = setUsers(nextUsers);
                        setUserPasswordDrafts((prev) => {
                          const nextDrafts = { ...prev };
                          delete nextDrafts[user.id];
                          return nextDrafts;
                        });
                        syncState(nextState, "Пользователь удалён");
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
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
                const nextState = setUsers(nextUsers);
                syncState(nextState, "Пользователь добавлен (временный пароль: change-me)");
              }}
            >
              Добавить пользователя
            </button>
          </Panel>
        </div>
      ) : null}

      <footer className="admin-footer">
        <div className="admin-footer-actions">
          <button
            className="btn btn-primary"
            disabled={!canPublishNow}
            onClick={() => {
              const next = publishDraft(session.id);
              syncState(next, "Изменения опубликованы");
            }}
          >
            Опубликовать
          </button>
          <button
            className="btn btn-secondary"
            disabled={!canEdit(session.role)}
            onClick={() => {
              const state = loadCmsState();
              setCmsState(state);
              setFeedback("Черновик обновлён из хранилища");
            }}
          >
            Обновить
          </button>
        </div>
        <p>
          Публикация обновляет публичные страницы <code>/</code>, <code>/about</code> и <code>/documents</code>. Вёрстка и стили сайта не меняются, редактируется только контент.
        </p>
      </footer>
    </main>
  );
}
