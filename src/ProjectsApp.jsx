import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchPublishedContentFromServer, getPublishedContent } from "./cms/storage";
import { sanitizeHtmlFragment, sanitizeSrc } from "./cms/security";
import { buildFastVideoSource, isSafariLikeBrowser } from "./videoSources";

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

export default function ProjectsApp() {
  const [content, setContent] = useState(() => getFallbackContent());
  const [activeModalId, setActiveModalId] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let isDisposed = false;

    fetchPublishedContentFromServer()
      .then((remoteContent) => {
        if (!isDisposed && remoteContent) {
          setContent(remoteContent);
        }
      })
      .catch(() => {
        // Keep local published snapshot when API is temporarily unavailable.
      });

    return () => {
      isDisposed = true;
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    video.muted = !soundEnabled;
    video.playsInline = true;
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        // Browsers may defer autoplay until the first interaction.
      });
    }

    return () => {
      video.pause();
    };
  }, []);

  const projects = content?.projects || {};
  const mediaStation = content?.home?.mediaStation || {};
  const modalEntries = Array.isArray(content?.modals) ? content.modals : [];
  const reviewsModal = modalEntries.find((entry) => entry && entry.id === "ms-participants" && entry.isPublished !== false);

  const safeReviewHtml = useMemo(() => buildSafeHtml(reviewsModal?.bodyHtml || ""), [reviewsModal?.bodyHtml]);

  const projectStats = useMemo(() => {
    const baseStats = Array.isArray(mediaStation.stats)
      ? mediaStation.stats.filter((item) => item && item.isPublished !== false)
      : [];
    const extraStats = Array.isArray(projects?.flagship?.extraStats)
      ? projects.flagship.extraStats.filter((item) => item)
      : [];
    return [...baseStats, ...extraStats];
  }, [mediaStation.stats, projects?.flagship?.extraStats]);

  const baseVideoSource =
    sanitizeSrc(projects.flagship?.videoSrc || mediaStation.videoDesktop || mediaStation.videoMobile || mediaStation.videoFallback || "") ||
    "/assets/gimn-ed-zy9mar.mp4";
  const videoSource = isSafariLikeBrowser() ? buildFastVideoSource(baseVideoSource) || baseVideoSource : baseVideoSource;

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextSoundState = !soundEnabled;
    video.muted = !nextSoundState;
    if (nextSoundState) {
      video.volume = 1;
    }

    try {
      await video.play();
    } catch {
      // Browser may block autoplay until the first interaction.
    }

    setSoundEnabled(nextSoundState);
  };

  const openReviews = () => {
    if (reviewsModal) {
      setActiveModalId(reviewsModal.id);
    }
  };

  const closeModal = () => setActiveModalId("");

  return (
    <>
      <a className="skip-link" href="#projectsMain">Перейти к проектам</a>

      <header className="site-header is-solid site-header-static projects-page-header">
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

      <main id="projectsMain" className="projects-page">
        <section className="projects-hero section-deep">
          <div className="container projects-hero-shell">
            <div className="projects-hero-copy">
              <p className="section-kicker">{projects.heroKicker || "Наши проекты"}</p>
              <h1>{projects.heroTitle || "Наши проекты"}</h1>
              <p className="projects-hero-lead">{projects.heroLead || "Полный перечень проектов института, включая флагманскую МедиаСтанцию и другие рабочие форматы АртКомм."}</p>
              {Array.isArray(projects.otherProjects) && projects.otherProjects.length ? (
                <div className="projects-hero-actions">
                  <a className="btn btn-secondary" href="#projectsListing">
                    {projects.listingButtonLabel || "Другие проекты"}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="projects-flagship" id="projectsFlagship">
          <div className="container projects-flagship-shell">
            <div className="projects-flagship-copy" data-reveal>
              <p className="section-kicker">{projects.flagship?.kicker || "Флагманский проект"}</p>
              <h2>{projects.flagship?.title || mediaStation.title || "МедиаСтанция"}</h2>
              <p className="projects-flagship-lead">{projects.flagship?.lead || "Коммуникационный формат для больших распределённых команд и управленческих контуров."}</p>

              <div className="projects-flagship-about">
                <span>{projects.flagship?.aboutTitle || "О проекте"}</span>
                <p>{projects.flagship?.aboutText || mediaStation.storyText || "Собираем единый коммуникационный ритм для больших распределённых команд."}</p>
              </div>

              <div className="projects-stats-grid">
                {projectStats.map((item) => (
                  <article className="projects-stat-card" key={item.id || `${item.label}-${item.value}`}>
                    <strong>
                      {item.value}
                      {item.suffix || ""}
                    </strong>
                    <span>{item.label}</span>
                  </article>
                ))}
              </div>

              <div className="projects-flagship-actions">
                <button type="button" className="btn btn-primary" onClick={openReviews}>
                  {projects.flagship?.reviewsLabel || "Отзывы о МедиаСтанции"}
                </button>
              </div>
            </div>

            <div className="projects-video-card" data-reveal>
              <div className="projects-video-head">
                <span>Видео проекта</span>
                <button type="button" className="btn btn-secondary projects-sound-toggle" onClick={toggleSound}>
                  {soundEnabled
                    ? projects.flagship?.mutedLabel || "Выключить звук"
                    : projects.flagship?.soundLabel || "Включить звук"}
                </button>
              </div>
              <div className="projects-video-frame">
                <video
                  ref={videoRef}
                  src={videoSource}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster="/assets/ms-video-poster.jpg"
                  className="projects-video"
                />
              </div>
              {projects.flagship?.videoCaption ? (
                <p className="projects-video-caption">{projects.flagship.videoCaption}</p>
              ) : null}
            </div>
          </div>
        </section>

        {Array.isArray(projects.otherProjects) && projects.otherProjects.length ? (
          <section className="projects-listing" id="projectsListing">
            <div className="container projects-listing-shell">
              <div className="projects-listing-head">
                <p className="section-kicker">{projects.listingKicker || "Полный перечень"}</p>
                <h2>{projects.listingTitle || "Другие проекты"}</h2>
              </div>
              <div className="projects-list-grid">
                {projects.otherProjects.map((project) => (
                  <article className="projects-list-card" key={project.id || project.title}>
                    <h3>{project.title}</h3>
                    <p>{project.subtitle}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <div className={`modal-layer${activeModalId ? " is-open" : ""}`} aria-hidden={activeModalId ? "false" : "true"}>
        <div className="modal-overlay" onClick={closeModal}></div>
        {reviewsModal ? (
          <article
            className={`modal${activeModalId === reviewsModal.id ? " is-open" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="projectsReviewsTitle"
            hidden={activeModalId !== reviewsModal.id}
          >
            <button className="modal-close" aria-label="Закрыть" onClick={closeModal}>×</button>
            <h3 id="projectsReviewsTitle">{reviewsModal.title || "Отзывы о МедиаСтанции"}</h3>
            <div dangerouslySetInnerHTML={{ __html: safeReviewHtml }} />
          </article>
        ) : null}
      </div>
    </>
  );
}
