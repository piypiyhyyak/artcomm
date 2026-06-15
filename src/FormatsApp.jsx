import React, { useEffect, useMemo, useState } from "react";
import { fetchPublishedContentFromServer, getPublishedContent } from "./cms/storage";
import { sanitizeHtmlFragment } from "./cms/security";

const RECOMMENDATION_MAP = {
  session: {
    title: "Управленческая сессия",
    duration: "2–4 часа",
    anchor: "format-session"
  },
  foresight: {
    title: "Проектная форсайт-сессия",
    duration: "1–2 дня",
    anchor: "format-foresight"
  },
  acceleration: {
    title: "Акселерация",
    duration: "1–12 месяцев",
    anchor: "format-acceleration"
  }
};

const METHODOLOGY_DESCRIPTIONS = [
  "Смотрим, где команда теряет скорость решений и как именно искажается передача задач между людьми.",
  "Фиксируем проблемные стыки между ролями, подразделениями и уровнями управления.",
  "Настраиваем новый ритм встреч, договорённостей и маршрутов принятия решений.",
  "Собираем общий язык коммуникации, чтобы одинаково понимать цели, статусы и действия.",
  "Закрепляем новый контур работы в ежедневной практике команды и в правилах управления."
];

function getFallbackContent() {
  try {
    return getPublishedContent();
  } catch {
    return null;
  }
}

function getRecommendationFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const key = String(params.get("recommendation") || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(RECOMMENDATION_MAP, key) ? key : "";
}

function buildSafeHtml(bodyHtml, enhancer) {
  if (typeof document === "undefined") {
    return { html: "", kicker: "", lead: "" };
  }

  const sandbox = document.createElement("div");
  sandbox.appendChild(sanitizeHtmlFragment(bodyHtml || "", document));
  const kicker = (sandbox.querySelector(".formats-modal-kicker")?.textContent || "").trim();
  const lead = (sandbox.querySelector(".formats-modal-lead")?.textContent || "").trim();
  sandbox.querySelector(".formats-modal-kicker")?.remove();
  sandbox.querySelector(".formats-modal-lead")?.remove();

  if (typeof enhancer === "function") {
    enhancer(sandbox);
  }

  return {
    html: sandbox.innerHTML,
    kicker,
    lead
  };
}

function decorateFormatsMarkup(root, recommendationKey) {
  const cards = Array.from(root.querySelectorAll(".format-showcase-card"));
  cards.forEach((card) => {
    const title = (card.querySelector("h4")?.textContent || "").trim().toLowerCase();
    let key = "";

    if (title.includes("управленчес")) {
      key = "session";
    } else if (title.includes("форсайт")) {
      key = "foresight";
    } else if (title.includes("акселерац")) {
      key = "acceleration";
    }

    if (!key) {
      return;
    }

    const meta = RECOMMENDATION_MAP[key];
    card.id = meta.anchor;
    card.setAttribute("data-format-key", key);
    card.querySelectorAll(".format-showcase-group .format-showcase-label, .format-showcase-result .format-showcase-label").forEach((label) => {
      label.remove();
    });

    if (key === recommendationKey) {
      card.classList.add("is-recommended");
    }
  });
}

function decorateMethodologyMarkup(root) {
  const items = Array.from(root.querySelectorAll(".timeline li"));
  items.forEach((item, index) => {
    const title = (item.textContent || "").trim();
    item.setAttribute("data-step-index", String(index + 1));
    item.textContent = "";
    item.classList.add("formats-step-card");

    const number = document.createElement("span");
    number.className = "formats-step-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("div");
    copy.className = "formats-step-copy";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const description = document.createElement("p");
    description.textContent = METHODOLOGY_DESCRIPTIONS[index] || "";

    copy.append(heading, description);
    item.append(number, copy);
  });
}

function smoothScrollWithOffset(event, targetSelector) {
  if (typeof window === "undefined" || !targetSelector || !targetSelector.startsWith("#")) {
    return;
  }

  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  event.preventDefault();
  const header = document.querySelector(".formats-page-header");
  const offset = (header?.getBoundingClientRect().height || 88) + 64;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  const nextUrl = new URL(window.location.href);
  nextUrl.hash = targetSelector.slice(1);
  window.history.replaceState({}, "", nextUrl);
  window.scrollTo({ top, behavior: "smooth" });
}

export default function FormatsApp() {
  const [content, setContent] = useState(() => getFallbackContent());
  const recommendationKey = useMemo(() => getRecommendationFromLocation(), []);
  const recommendation = recommendationKey ? RECOMMENDATION_MAP[recommendationKey] : null;
  const heroTitle = "Три формата работы";
  const heroLead =
    "Выберите глубину включения: от короткой управленческой сессии до системной акселерации команды.";

  useEffect(() => {
    let disposed = false;

    fetchPublishedContentFromServer()
      .then((remoteContent) => {
        if (!disposed && remoteContent) {
          setContent(remoteContent);
        }
      })
      .catch(() => {
        // Keep the locally published snapshot when the API is temporarily unavailable.
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

  const modalEntries = Array.isArray(content?.modals) ? content.modals : [];
  const formatsModal = modalEntries.find((entry) => entry && entry.id === "formats" && entry.isPublished !== false);
  const methodologyModal = modalEntries.find((entry) => entry && entry.id === "methodology" && entry.isPublished !== false);

  const formatsSection = useMemo(
    () => buildSafeHtml(formatsModal?.bodyHtml || "", (root) => decorateFormatsMarkup(root, recommendationKey)),
    [formatsModal?.bodyHtml, recommendationKey]
  );
  const methodologySection = useMemo(
    () => buildSafeHtml(methodologyModal?.bodyHtml || "", decorateMethodologyMarkup),
    [methodologyModal?.bodyHtml]
  );

  return (
    <>
      <a className="skip-link" href="#formatsMain">Перейти к форматам работы</a>

      <header className="site-header is-solid site-header-static formats-page-header">
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

      <main id="formatsMain" className="formats-page">
        <section className="formats-hero section-deep">
          <div className="container formats-hero-shell">
            <div className="formats-hero-copy" data-reveal>
              <h1>{heroTitle}</h1>
              <p className="formats-hero-lead">{heroLead}</p>
              <div className="formats-hero-actions">
                <a
                  className="btn btn-primary"
                  href="#formatsCatalog"
                  onClick={(event) => smoothScrollWithOffset(event, "#formatsCatalog")}
                >
                  Смотреть форматы
                </a>
                <a
                  className="btn btn-secondary"
                  href="#methodology"
                  onClick={(event) => smoothScrollWithOffset(event, "#methodology")}
                >
                  Узнать методологию
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="formats-section" id="formatsCatalog">
          <div className="container formats-section-shell">
            <div className="formats-section-head" data-reveal>
              <p className="section-kicker">Каталог форматов</p>
              <h2>{recommendation ? "Сравните все варианты" : (formatsModal?.title || "Три формата — под любую задачу")}</h2>
            </div>
            <div className="formats-rich-content" data-reveal dangerouslySetInnerHTML={{ __html: formatsSection.html }} />
          </div>
        </section>

        <section className="formats-section section-pale" id="methodology">
          <div className="container formats-section-shell">
            <div className="formats-section-head" data-reveal>
              <p className="section-kicker">Методология</p>
              <h2>{methodologyModal?.title || "Методология 5 шагов"}</h2>
              <p className="formats-methodology-lead">Пошагово собираем управляемую систему коммуникаций, чтобы решения не терялись между людьми и подразделениями.</p>
            </div>
            <div className="formats-methodology-body" data-reveal dangerouslySetInnerHTML={{ __html: methodologySection.html }} />
          </div>
        </section>
      </main>
    </>
  );
}
