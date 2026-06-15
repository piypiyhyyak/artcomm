import React, { useEffect, useMemo, useState } from "react";
import { fetchPublishedContentFromServer, getPublishedContent } from "./cms/storage";
import { sanitizeHtmlFragment, sanitizeSrc } from "./cms/security";

function getFallbackContent() {
  try {
    return getPublishedContent();
  } catch {
    return null;
  }
}

function buildSafeHtml(bodyHtml) {
  if (typeof document === "undefined") {
    return "";
  }
  const box = document.createElement("div");
  box.appendChild(sanitizeHtmlFragment(bodyHtml || "", document));
  return box.innerHTML;
}

function getActionHref(action) {
  if (!action || action.type === "modal") {
    return "";
  }
  return String(action.target || "").trim();
}

export default function ExpertsApp() {
  const [content, setContent] = useState(() => getFallbackContent());
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeModalId, setActiveModalId] = useState("");

  useEffect(() => {
    let disposed = false;

    fetchPublishedContentFromServer()
      .then((remoteContent) => {
        if (!disposed && remoteContent) {
          setContent(remoteContent);
        }
      })
      .catch(() => {
        // Keep local snapshot when the API is temporarily unavailable.
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    const frameId = window.requestAnimationFrame(() => {
      nodes.forEach((node) => node.classList.add("revealed"));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      nodes.forEach((node) => node.classList.remove("revealed"));
    };
  }, []);

  useEffect(() => {
    if (!activeModalId) {
      document.body.classList.remove("modal-open");
      return undefined;
    }

    document.body.classList.add("modal-open");
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActiveModalId("");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeModalId]);

  const expert = content?.home?.expert || {};
  const photos = Array.isArray(expert.photos) ? expert.photos.filter((item) => item && item.isPublished !== false) : [];
  const photoCount = photos.length || 1;
  const safeIndex = Math.min(activePhotoIndex, photoCount - 1);
  const currentPhoto = photos[safeIndex] || {};

  const positions = Array.isArray(expert.positions) ? expert.positions.filter((item) => item && item.isPublished !== false) : [];
  const actions = Array.isArray(expert.actions)
    ? expert.actions.filter((item) => item && item.isPublished !== false).slice(0, 2)
    : [];

  const modalEntries = Array.isArray(content?.modals) ? content.modals.filter((item) => item && item.isPublished !== false) : [];
  const visibleModalEntries = useMemo(
    () => modalEntries.filter((entry) => actions.some((action) => action.type === "modal" && action.target === entry.id)),
    [actions, modalEntries]
  );

  const modalHtmlMap = useMemo(() => {
    return Object.fromEntries(
      visibleModalEntries.map((entry) => [entry.id, buildSafeHtml(entry.bodyHtml || "")])
    );
  }, [visibleModalEntries]);

  const nextPhoto = (step) => {
    if (!photos.length) {
      return;
    }
    setActivePhotoIndex((prev) => (prev + step + photos.length) % photos.length);
  };

  return (
    <>
      <a className="skip-link" href="#expertsMain">Перейти к странице экспертов</a>

      <header className="site-header is-solid site-header-static experts-page-header">
        <div className="container header-inner">
          <a href="/" className="logo" aria-label="На главную">
            <img className="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true" />
            <div className="logo-copy">
              <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
              <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
            </div>
          </a>
          <div className="header-actions">
            <a className="btn btn-primary" href="/">На главную</a>
          </div>
        </div>
      </header>

      <main id="expertsMain" className="experts-page">
        <section className="expert section-pale experts-page-stage">
          <div className="container expert-reset experts-page-grid">
            <div className="expert-reset-media" data-reveal>
              <div
                className="gallery-main"
                role="img"
                aria-label={currentPhoto.alt || "Фото эксперта"}
                style={{ backgroundImage: currentPhoto.image ? `url("${sanitizeSrc(currentPhoto.image)}")` : "none" }}
              >
                <div className="expert-photo-overlay">
                  <p>Эксперт проекта</p>
                  <strong>{expert.title || "Роман Скудняков"}</strong>
                </div>
                {photos.length > 1 ? (
                  <>
                    <button type="button" className="expert-photo-arrow prev" aria-label="Предыдущее фото" onClick={() => nextPhoto(-1)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M14.5 5.5L8 12l6.5 6.5"></path>
                      </svg>
                    </button>
                    <button type="button" className="expert-photo-arrow next" aria-label="Следующее фото" onClick={() => nextPhoto(1)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M9.5 5.5L16 12l-6.5 6.5"></path>
                      </svg>
                    </button>
                  </>
                ) : null}
              </div>

              <div className="expert-photo-controls">
                <span className="expert-photo-caption">Фотогалерея эксперта</span>
                <span className="expert-photo-counter">
                  <strong>{String(safeIndex + 1).padStart(2, "0")}</strong>
                  <small>/ {String(photoCount).padStart(2, "0")}</small>
                </span>
              </div>
            </div>

            <article className="expert-reset-content" data-reveal>
              <div className="expert-copy-core">
                <p className="section-kicker">{expert.kicker || "Наши эксперты"}</p>
                <h1 className="experts-page-title">{expert.title || "Роман Скудняков"}</h1>
                <p className="expert-lead-quote">{expert.quote || "«Управляемость команды начинается с того, как она разговаривает и как принимает решения»."}</p>
                <p className="expert-brief">{expert.brief || "Стратегический коммуникатор и модератор управленческих команд в сложных распределённых структурах."}</p>

                <ul className="positions">
                  {positions.map((item) => (
                    <li key={item.id || item.text}>{item.text}</li>
                  ))}
                </ul>
              </div>

              <div className="stack-actions horizontal expert-actions">
                {actions.map((action, index) => {
                  const isPrimary = (action.variant || "").trim() !== "secondary";
                  const className = `btn ${isPrimary ? "btn-primary" : "btn-secondary"}`;
                  const href = getActionHref(action);

                  if (action.type === "modal") {
                    return (
                      <button
                        key={action.id || `${action.label}-${index}`}
                        type="button"
                        className={className}
                        onClick={() => setActiveModalId(String(action.target || "").trim())}
                      >
                        {action.label}
                      </button>
                    );
                  }

                  return (
                    <a key={action.id || `${action.label}-${index}`} className={className} href={href || "#"}>
                      {action.label}
                    </a>
                  );
                })}
              </div>
            </article>
          </div>
        </section>
      </main>

      <div className={`modal-layer${activeModalId ? " is-open" : ""}`} aria-hidden={activeModalId ? "false" : "true"}>
        <div className="modal-overlay" onClick={() => setActiveModalId("")}></div>
        {visibleModalEntries.map((entry) => (
          <article
            key={entry.id}
            className={`modal${activeModalId === entry.id ? " is-open" : ""}`}
            data-modal-id={entry.id}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${entry.id}Title`}
            hidden={activeModalId !== entry.id}
          >
            <button className="modal-close" aria-label="Закрыть" onClick={() => setActiveModalId("")}>×</button>
            <h3 id={`${entry.id}Title`}>{entry.title}</h3>
            <div dangerouslySetInnerHTML={{ __html: modalHtmlMap[entry.id] || "" }} />
          </article>
        ))}
      </div>
    </>
  );
}
