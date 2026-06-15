import { getPublishedContent } from "./storage";
import { sanitizeHref, sanitizeHtmlFragment, sanitizeSrc } from "./security";

function getDocumentRef(root) {
  if (!root) {
    return document;
  }
  return root.nodeType === 9 ? root : root.ownerDocument || document;
}

function setTextContent(root, selector, value) {
  const node = root.querySelector(selector);
  if (node && typeof value === "string") {
    node.textContent = value;
  }
}

function setLinkContent(node, { text, href }) {
  if (!node) {
    return;
  }
  if (typeof text === "string") {
    node.textContent = text;
  }
  if (typeof href === "string") {
    const safeHref = sanitizeHref(href);
    if (!safeHref) {
      node.removeAttribute("href");
      node.removeAttribute("target");
      node.removeAttribute("rel");
      return;
    }
    node.setAttribute("href", safeHref);
    if (/^https?:\/\//i.test(safeHref)) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    } else {
      node.removeAttribute("target");
      node.removeAttribute("rel");
    }
  }
}

function createLinkItem(documentRef, item) {
  const li = documentRef.createElement("li");
  const safeTitle = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : "Документ";
  const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
  const isPublished = item.isPublished !== false;

  if (hasUrl && isPublished) {
    const safeHref = sanitizeHref(item.url);
    if (!safeHref) {
      const placeholder = documentRef.createElement("span");
      placeholder.className = "about-link-pending";
      placeholder.textContent = safeTitle + " (небезопасная ссылка отклонена)";
      li.appendChild(placeholder);
      return li;
    }
    const anchor = documentRef.createElement("a");
    anchor.href = safeHref;
    if (/^https?:\/\//i.test(safeHref)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    anchor.textContent = safeTitle;
    li.appendChild(anchor);
  } else {
    const placeholder = documentRef.createElement("span");
    placeholder.className = "about-link-pending";
    placeholder.textContent = safeTitle;
    li.appendChild(placeholder);
  }

  return li;
}

function createLinkNode(documentRef, item) {
  const safeTitle = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : "Документ";
  const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
  const isPublished = item.isPublished !== false;

  if (hasUrl && isPublished) {
    const safeHref = sanitizeHref(item.url);
    if (!safeHref) {
      const placeholder = documentRef.createElement("span");
      placeholder.className = "about-link-pending";
      placeholder.textContent = safeTitle + " (небезопасная ссылка отклонена)";
      return placeholder;
    }
    const anchor = documentRef.createElement("a");
    anchor.href = safeHref;
    if (/^https?:\/\//i.test(safeHref)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    anchor.textContent = safeTitle;
    return anchor;
  }

  const placeholder = documentRef.createElement("span");
  placeholder.className = "about-link-pending";
  placeholder.textContent = safeTitle;
  return placeholder;
}

function renderTrustedPartners(root, trustedPartners) {
  const trustedNetwork = root.querySelector("#trustedNetwork");
  if (!trustedNetwork || !Array.isArray(trustedPartners)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = trustedPartners.filter((item) => item && item.isPublished !== false);
  trustedNetwork.innerHTML = "";

  const canvas = documentRef.createElement("canvas");
  canvas.className = "trusted-network-canvas";
  canvas.id = "trustedNetworkCanvas";
  canvas.setAttribute("aria-hidden", "true");
  trustedNetwork.appendChild(canvas);

  published.forEach((item) => {
    const node = documentRef.createElement("span");
    node.className = "trusted-node";
    node.setAttribute("data-node", "");
    node.setAttribute("data-x", String(item.x ?? 50));
    node.setAttribute("data-y", String(item.y ?? 50));
    node.setAttribute("data-range", String(item.range ?? 40));

    const image = documentRef.createElement("img");
    image.src = sanitizeSrc(item.logo || "") || "/assets/logos/asi.png";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.loading = "lazy";

    const label = documentRef.createElement("span");
    label.className = "trusted-node-name";
    label.textContent = item.name || "Партнёр";

    node.appendChild(image);
    node.appendChild(label);
    trustedNetwork.appendChild(node);
  });
}

function renderHeroSlides(root, slides) {
  const heroSlidesNode = root.querySelector("#heroSlides");
  if (!heroSlidesNode || !Array.isArray(slides)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = slides.filter((slide) => slide && slide.isPublished !== false && slide.image);
  const sourcePool = published.length ? published : slides;

  heroSlidesNode.innerHTML = "";
  sourcePool.forEach((item, index) => {
    const slide = documentRef.createElement("div");
    slide.className = `hero-slide${index === 0 ? " is-active" : ""}`;
    slide.setAttribute("data-slide", String(index));
    slide.setAttribute("role", "img");
    slide.setAttribute("aria-label", item.alt || `Слайд ${index + 1}`);
    heroSlidesNode.appendChild(slide);
  });

  if (typeof window !== "undefined") {
    window.__artcommHeroSlides = sourcePool.map((item) => sanitizeSrc(item.image)).filter(Boolean);
  }
}

function applyActionButton(node, source, fallbackScroll = "#contacts", fallbackModal = "test") {
  if (!node || !source) {
    return;
  }

  const rawTarget = typeof source.target === "string" ? source.target.trim() : "";
  const isLegacyFormatsLink = source.type === "link" && (rawTarget === "/formats" || rawTarget === "/formats/");
  const isLegacyMethodologyLink =
    source.type === "link" &&
    (rawTarget === "/formats#methodology" ||
      rawTarget === "/formats/#methodology" ||
      rawTarget === "/?page=formats#methodology");

  node.textContent = source.label || node.textContent;
  node.classList.toggle("btn-primary", source.variant === "primary");
  node.classList.toggle("btn-secondary", source.variant !== "primary");

  node.removeAttribute("data-modal");
  node.removeAttribute("data-scroll");
  node.removeAttribute("data-link");
  if (node.tagName.toLowerCase() === "a") {
    node.removeAttribute("href");
  }

  if (source.type === "modal" || isLegacyFormatsLink || isLegacyMethodologyLink) {
    const modalTarget =
      source.type === "modal" && /^[a-z0-9-]{1,48}$/i.test(rawTarget)
        ? rawTarget
        : isLegacyMethodologyLink
          ? "methodology"
          : isLegacyFormatsLink
            ? "formats"
        : fallbackModal;
    node.setAttribute("data-modal", modalTarget);
    if (node.tagName.toLowerCase() === "a") {
      node.setAttribute("href", `/?modal=${modalTarget}`);
    }
    return;
  }

  if (source.type === "link") {
    const safeHref = sanitizeHref(source.target || "");
    const safeLink = safeHref || fallbackScroll;
    node.setAttribute("data-link", safeLink);
    if (node.tagName.toLowerCase() === "a") {
      node.setAttribute("href", safeLink);
    }
    return;
  }

  const scrollTarget =
    typeof source.target === "string" && /^#[a-z0-9_-]{1,64}$/i.test(source.target)
      ? source.target
      : fallbackScroll;
  node.setAttribute("data-scroll", scrollTarget);
}

function applyActionButtons(root, selector, actions, options = {}) {
  const buttons = Array.from(root.querySelectorAll(selector));
  if (!buttons.length || !Array.isArray(actions)) {
    return;
  }

  const published = actions.filter((item) => item && item.isPublished !== false);
  buttons.forEach((button, index) => {
    const source = published[index];
    if (!source) {
      button.style.display = "none";
      return;
    }
    button.style.display = "inline-flex";
    applyActionButton(button, source, options.fallbackScroll, options.fallbackModal);
  });
}

function renderCommonPains(root, pains) {
  const stack = root.querySelector("#commonDrumStack");
  if (!stack || !Array.isArray(pains)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = pains.filter((item) => item && item.isPublished !== false);
  stack.innerHTML = "";

  published.forEach((item, index) => {
    const article = documentRef.createElement("article");
    article.className = "common-drum-item pain-redo";
    article.setAttribute("data-drum-index", String(index));

    const icon = documentRef.createElement("span");
    icon.className = "pain-redo-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "›";

    const copy = documentRef.createElement("div");
    copy.className = "pain-redo-copy";
    const title = documentRef.createElement("h3");
    const text = documentRef.createElement("p");
    title.textContent = item.title || "";
    text.textContent = item.text || "";
    copy.appendChild(title);
    copy.appendChild(text);

    article.appendChild(icon);
    article.appendChild(copy);
    stack.appendChild(article);
  });
}

function renderMetricStats(root, stats) {
  const container = root.querySelector(".ms-stats-list");
  if (!container || !Array.isArray(stats)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = stats.filter((item) => item && item.isPublished !== false);
  container.innerHTML = "";

  published.forEach((item) => {
    const article = documentRef.createElement("article");
    const strong = documentRef.createElement("strong");
    const span = documentRef.createElement("span");

    const rawValue = String(item.value ?? "").trim();
    const suffix = String(item.suffix || "").trim();
    const numeric = Number.parseFloat(rawValue.replace(",", ".").replace(/\s+/g, ""));
    if (Number.isFinite(numeric)) {
      strong.dataset.counter = String(numeric);
    } else {
      strong.removeAttribute("data-counter");
    }
    if (suffix) {
      strong.dataset.suffix = suffix;
    } else {
      strong.removeAttribute("data-suffix");
    }
    strong.textContent = `${rawValue}${suffix}`;
    span.textContent = item.label || "";

    article.appendChild(strong);
    article.appendChild(span);
    container.appendChild(article);
  });
}

function renderLoyaltyRings(root, loyalty) {
  const container = root.querySelector("#loyaltyBars");
  if (!container || !Array.isArray(loyalty)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = loyalty.filter((item) => item && item.isPublished !== false);
  container.innerHTML = "";

  published.forEach((item) => {
    const valueNum = Number.parseFloat(String(item.value ?? "0").replace(",", "."));
    const value = Number.isFinite(valueNum) ? Math.max(0, Math.min(100, valueNum)) : 0;

    const article = documentRef.createElement("article");
    article.className = "loyalty-cell";

    const ringWrap = documentRef.createElement("div");
    ringWrap.className = "loyalty-ring-wrap";

    const svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "loyalty-ring");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("aria-hidden", "true");

    const track = documentRef.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("class", "ring-track");
    track.setAttribute("cx", "60");
    track.setAttribute("cy", "60");
    track.setAttribute("r", "46");

    const progress = documentRef.createElementNS("http://www.w3.org/2000/svg", "circle");
    progress.setAttribute("class", "ring-progress");
    progress.setAttribute("cx", "60");
    progress.setAttribute("cy", "60");
    progress.setAttribute("r", "46");
    progress.setAttribute("data-value", String(value));

    const strong = documentRef.createElement("strong");
    strong.textContent = `${Math.round(value)}%`;

    svg.appendChild(track);
    svg.appendChild(progress);
    ringWrap.appendChild(svg);
    ringWrap.appendChild(strong);

    const text = documentRef.createElement("p");
    text.textContent = item.label || "";

    article.appendChild(ringWrap);
    article.appendChild(text);
    container.appendChild(article);
  });
}

function renderIksPillars(root, pillars) {
  const container = root.querySelector(".iks-axis-list");
  if (!container || !Array.isArray(pillars)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = pillars.filter((item) => item && item.isPublished !== false);
  container.innerHTML = "";

  published.forEach((item) => {
    const li = documentRef.createElement("li");
    li.setAttribute("tabindex", "0");
    li.dataset.key = item.key || item.title || "Параметр";

    const wrap = documentRef.createElement("div");
    const title = documentRef.createElement("strong");
    const text = documentRef.createElement("p");
    title.textContent = item.title || "";
    text.textContent = item.text || "";
    wrap.appendChild(title);
    wrap.appendChild(text);

    li.appendChild(wrap);
    container.appendChild(li);
  });
}

function renderExpertPositions(root, positions) {
  const list = root.querySelector(".positions");
  if (!list || !Array.isArray(positions)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  const published = positions.filter((item) => item && item.isPublished !== false);
  list.innerHTML = "";
  published.forEach((item) => {
    const li = documentRef.createElement("li");
    li.textContent = item.text || "";
    list.appendChild(li);
  });
}

function renderExpertGallery(root, photos) {
  const safePhotos = Array.isArray(photos)
    ? photos
        .filter((item) => item && item.isPublished !== false)
        .map((item) => sanitizeSrc(item.image))
        .filter(Boolean)
    : [];

  const fallbackPhotos = [
    "/assets/expert-1.jpg",
    "/assets/expert-2.jpg",
    "/assets/expert-3.jpg",
    "/assets/expert-4.jpg"
  ];

  const effectivePhotos = safePhotos.length ? safePhotos : fallbackPhotos;

  if (typeof window !== "undefined") {
    window.__artcommExpertPhotos = effectivePhotos;
  }

  const thumbsRoot = root.querySelector("#expertThumbs");
  if (!thumbsRoot) {
    return;
  }

  const documentRef = getDocumentRef(root);
  thumbsRoot.innerHTML = "";
  effectivePhotos.forEach((src, index) => {
    const button = documentRef.createElement("button");
    button.className = `thumb${index === 0 ? " is-active" : ""}`;
    button.dataset.index = String(index);
    button.setAttribute("tabindex", "-1");
    button.style.backgroundImage = `url('${src}')`;
    thumbsRoot.appendChild(button);
  });

  const totalNode = root.querySelector(".expert-photo-counter small");
  if (totalNode) {
    totalNode.textContent = `/ ${String(effectivePhotos.length).padStart(2, "0")}`;
  }

  thumbsRoot.hidden = effectivePhotos.length < 2;
}

function setContactCheckText(root, selector, prefix, linkLabel, href, suffix = "") {
  const span = root.querySelector(selector);
  if (!span) {
    return;
  }

  const link = span.querySelector("a");
  if (!link) {
    return;
  }

  setLinkContent(link, { text: linkLabel, href });

  const docRef = getDocumentRef(root);
  span.textContent = "";
  span.appendChild(docRef.createTextNode(`${prefix} `));
  span.appendChild(link);
  if (suffix) {
    span.appendChild(docRef.createTextNode(suffix));
  }
}

function applyHomeContent(root, content) {
  if (!content || !content.home) {
    return;
  }

  const { home } = content;

  if (home.hero) {
    setTextContent(root, ".hero-kicker", home.hero.kicker);
    setTextContent(root, "#hero .hero-main h1", home.hero.title);
    setTextContent(root, ".hero-quote", home.hero.quote);

    applyActionButtons(root, ".hero-actions .btn", home.hero.actions || [], {
      fallbackScroll: "#contacts",
      fallbackModal: "test"
    });

    const trustLine = root.querySelector(".trust-line");
    if (trustLine && Array.isArray(home.hero.trustLine)) {
      const entries = home.hero.trustLine.filter((item) => item && item.isPublished !== false);
      trustLine.innerHTML = "";
      entries.forEach((item) => {
        const documentRef = getDocumentRef(root);
        const li = documentRef.createElement("li");
        const strong = documentRef.createElement("strong");
        const span = documentRef.createElement("span");
        strong.textContent = item.value || "";
        span.textContent = item.caption || "";
        li.appendChild(strong);
        li.appendChild(span);
        trustLine.appendChild(li);
      });
    }
  }

  if (home.common) {
    setTextContent(root, "#common .common-redo-head .section-kicker", home.common.kicker);
    setTextContent(root, "#common .common-redo-head h2", home.common.title);
    renderCommonPains(root, home.common.pains || []);

    if (home.common.cta) {
      setTextContent(root, "#common .common-redo-kicker", home.common.cta.kicker);
      setTextContent(root, "#common .common-redo-title span:nth-child(1)", home.common.cta.titleLine1);
      setTextContent(root, "#common .common-redo-title span:nth-child(2)", home.common.cta.titleLine2);
      setTextContent(root, "#common .common-redo-cta-text span:nth-child(1)", home.common.cta.textLine1);
      setTextContent(root, "#common .common-redo-cta-text span:nth-child(2)", home.common.cta.textLine2);

      const commonButtons = Array.from(root.querySelectorAll("#common .common-redo-cta .stack-actions .btn"));
      if (commonButtons.length >= 1) {
        const primaryTarget = String(home.common.cta.primaryTarget || "").trim();
        applyActionButton(
          commonButtons[0],
          {
            label: home.common.cta.primaryLabel,
            type: primaryTarget && !primaryTarget.startsWith("#") ? "link" : "scroll",
            target: primaryTarget,
            variant: "primary"
          },
          "#ms"
        );
      }
      if (commonButtons.length >= 2) {
        applyActionButton(
          commonButtons[1],
          {
            label: home.common.cta.secondaryLabel,
            type: "scroll",
            target: home.common.cta.secondaryTarget,
            variant: "secondary"
          },
          "#contacts"
        );
      }
    }
  }

  renderHeroSlides(root, home.slides || []);

  if (home.mediaStation) {
    setTextContent(root, "#ms .ms-intro .section-kicker", home.mediaStation.kicker);
    setTextContent(root, "#ms .ms-intro h2", home.mediaStation.title);
    setTextContent(root, "#ms .ms-intro .section-sub", home.mediaStation.subtitle);
    setTextContent(root, "#ms .ms-video-caption", home.mediaStation.caption);
    setTextContent(root, "#msVideoHeadline span", home.mediaStation.kicker);
    setTextContent(root, "#msVideoHeadline strong", home.mediaStation.title);

    const source = root.querySelector("#msVideo source");
    if (source) {
      const safeDesktop = sanitizeSrc(home.mediaStation.videoDesktop) || "/assets/gimn-ed-zy9mar.mp4";
      const safeMobile = sanitizeSrc(home.mediaStation.videoMobile) || safeDesktop;
      const safeFallback = sanitizeSrc(home.mediaStation.videoFallback) || safeDesktop;
      source.setAttribute("data-src", safeDesktop);
      source.setAttribute("data-local-src", safeMobile);
      source.setAttribute("data-fallback-src", safeFallback);
      source.removeAttribute("src");
    }

    setTextContent(root, "#ms .ms-story-lead h3", home.mediaStation.storyTitle);
    setTextContent(root, "#ms .ms-story-lead p", home.mediaStation.storyText);
    setTextContent(root, "#ms .ms-metric-main p", home.mediaStation.metricCaption);
    const metricNode = root.querySelector("#ms .ms-metric-main .metric-value");
    if (metricNode) {
      const rawMetric = String(home.mediaStation.metricValue ?? "").trim();
      const metricNumeric = Number.parseFloat(rawMetric.replace(",", ".").replace(/\s+/g, ""));
      if (Number.isFinite(metricNumeric)) {
        metricNode.dataset.counter = String(metricNumeric);
      } else {
        metricNode.removeAttribute("data-counter");
      }
      const metricSuffix = String(home.mediaStation.metricSuffix || "").trim();
      if (metricSuffix) {
        metricNode.dataset.suffix = metricSuffix;
      } else {
        metricNode.removeAttribute("data-suffix");
      }
      metricNode.textContent = `${rawMetric}${metricSuffix}`;
    }

    renderMetricStats(root, home.mediaStation.stats || []);
    renderLoyaltyRings(root, home.mediaStation.loyalty || []);
    applyActionButtons(root, "#ms .ms-tail-actions .btn", home.mediaStation.actions || [], {
      fallbackModal: "ms-participants",
      fallbackScroll: "#ms"
    });
  }

  if (home.iks) {
    setTextContent(root, "#iks .iks-reset-head .section-kicker", home.iks.kicker);
    setTextContent(root, "#iks .iks-reset-head h2", home.iks.title);
    setTextContent(root, "#iks .iks-reset-head > p:not(.section-kicker)", home.iks.description);
    renderIksPillars(root, home.iks.pillars || []);
    applyActionButtons(root, "#iks .iks-actions .btn", home.iks.actions || [], {
      fallbackModal: "diamond",
      fallbackScroll: "#iks"
    });
  }

  if (home.expert) {
    setTextContent(root, "#expert .expert-copy-core .section-kicker", home.expert.kicker);
    setTextContent(root, "#expert .expert-copy-core h2", home.expert.title);
    setTextContent(root, "#expert .expert-lead-quote", home.expert.quote);
    setTextContent(root, "#expert .expert-brief", home.expert.brief);
    renderExpertPositions(root, home.expert.positions || []);
    renderExpertGallery(root, home.expert.photos || []);
    setTextContent(root, "#expert .expert-impact-item-primary strong", home.expert.impactPrimaryValue);
    setTextContent(root, "#expert .expert-impact-item-primary p", home.expert.impactPrimaryLabel);
    setTextContent(root, "#expert .expert-impact-item-outline strong", home.expert.impactSecondaryText);
    applyActionButtons(root, "#expert .expert-actions .btn", home.expert.actions || [], {
      fallbackModal: "achievements",
      fallbackScroll: "#expert"
    });
  }

  if (home.contactsSection) {
    setTextContent(root, "#contacts .contacts-head .section-kicker", home.contactsSection.kicker);
    setTextContent(root, "#contacts .contacts-head h2 span:nth-child(1)", home.contactsSection.titleLine1);
    setTextContent(root, "#contacts .contacts-head h2 span:nth-child(2)", home.contactsSection.titleLine2);
    setTextContent(root, "#contacts .contacts-brief-card h3", home.contactsSection.cardTitle);
    setTextContent(root, "#contacts .contact-form h3", home.contactsSection.formTitle);
    setTextContent(root, "#contacts .contact-form .contact-form-lead", home.contactsSection.formLead);
    setTextContent(root, "#contacts .trusted-network-card h3", home.contactsSection.trustedTitle);
    setTextContent(root, "#contacts .trusted-network-card .trusted-network-sub", home.contactsSection.trustedSubtitle);

    setContactCheckText(
      root,
      "#contacts .contact-check:nth-of-type(1) span",
      home.contactsSection.policyPrefix || "",
      home.contactsSection.policyLinkLabel || "",
      home.contactsSection.policyLink || ""
    );
    setContactCheckText(
      root,
      "#contacts .contact-check:nth-of-type(2) span",
      home.contactsSection.newsPrefix || "",
      home.contactsSection.newsLinkLabel || "",
      home.contactsSection.newsLink || "",
      "."
    );
    setTextContent(root, "#contacts .contact-form .contact-form-submit", home.contactsSection.submitLabel);
  }

  if (home.contacts) {
    setTextContent(root, ".contacts-brief-schedule-label", home.contacts.scheduleLabel);
    setTextContent(root, ".contacts-brief-schedule-value", home.contacts.scheduleValue);

    const phoneNode = root.querySelector(".contacts-brief-phone");
    const mailNode = root.querySelector(".contacts-brief-mail");
    const telegramNode = root.querySelector(".contacts-brief-card .contacts-brief-telegram:nth-of-type(1)");
    const maxNode = root.querySelector(".contacts-brief-card .contacts-brief-telegram:nth-of-type(2)");

    setLinkContent(phoneNode, {
      text: home.contacts.phone,
      href: home.contacts.phoneHref || `tel:${String(home.contacts.phone || "").replace(/[^\d+]/g, "")}`
    });

    setLinkContent(mailNode, {
      text: home.contacts.email,
      href: home.contacts.emailHref || `mailto:${home.contacts.email || ""}`
    });

    setLinkContent(telegramNode, {
      text: home.contacts.telegramLabel,
      href: home.contacts.telegramUrl
    });

    setLinkContent(maxNode, {
      text: home.contacts.maxLabel,
      href: home.contacts.maxUrl
    });

    const footerContacts = Array.from(root.querySelectorAll("#siteFooter .footer-links-contacts a"));
    if (footerContacts.length >= 4) {
      setLinkContent(footerContacts[0], {
        text: home.contacts.email,
        href: home.contacts.emailHref || `mailto:${home.contacts.email || ""}`
      });
      setLinkContent(footerContacts[1], {
        text: home.contacts.phone,
        href: home.contacts.phoneHref || `tel:${String(home.contacts.phone || "").replace(/[^\d+]/g, "")}`
      });
      setLinkContent(footerContacts[2], {
        text: home.contacts.telegramLabel,
        href: home.contacts.telegramUrl
      });
      setLinkContent(footerContacts[3], {
        text: home.contacts.maxLabel,
        href: home.contacts.maxUrl
      });
    }
  }

  if (Array.isArray(home.trustedPartners)) {
    renderTrustedPartners(root, home.trustedPartners);
  }

  if (Array.isArray(content.modals)) {
    content.modals.forEach((entry) => {
      const modal = root.querySelector(`.modal[data-modal-id="${entry.id}"]`);
      if (!modal || entry.isPublished === false) {
        return;
      }

      const title = modal.querySelector("h3");
      if (title && typeof entry.title === "string" && entry.title) {
        title.textContent = entry.title;
      }

      if (!entry.bodyHtml || entry.id === "test") {
        return;
      }

      const closeButton = modal.querySelector(".modal-close");
      const oldChildren = Array.from(modal.children);
      oldChildren.forEach((child) => {
        if (child === closeButton || child === title) {
          return;
        }
        modal.removeChild(child);
      });

      const fragment = sanitizeHtmlFragment(entry.bodyHtml, getDocumentRef(root));
      modal.appendChild(fragment);
    });
  }
}

function renderAboutFacts(root, facts) {
  const list = root.querySelector("#about-basic .about-facts");
  if (!list || !Array.isArray(facts)) {
    return;
  }

  const documentRef = getDocumentRef(root);
  list.innerHTML = "";
  const items = facts.filter((item) => item && item.isPublished !== false);
  items.forEach((item) => {
    const row = documentRef.createElement("div");
    const dt = documentRef.createElement("dt");
    const dd = documentRef.createElement("dd");
    dt.textContent = item.label || "";

    if (item.link) {
      const safeLink = sanitizeHref(item.link);
      const anchor = documentRef.createElement("a");
      if (!safeLink) {
        dd.textContent = item.value || "";
        row.appendChild(dt);
        row.appendChild(dd);
        list.appendChild(row);
        return;
      }
      anchor.href = safeLink;
      anchor.textContent = item.value || "";
      if (/^https?:\/\//i.test(safeLink)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      dd.appendChild(anchor);
    } else {
      dd.textContent = item.value || "";
    }

    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  });
}

function renderAboutLinks(root, selector, items, type) {
  const container = root.querySelector(selector);
  if (!container || !Array.isArray(items)) {
    return;
  }

  container.innerHTML = "";
  const documentRef = getDocumentRef(root);
  const source = items.filter((item) => item);

  if (type === "list") {
    source.forEach((item) => {
      container.appendChild(createLinkItem(documentRef, item));
    });
    return;
  }

  source.forEach((item) => {
    container.appendChild(createLinkNode(documentRef, item));
  });
}

function renderTable(root, tableSelector, headers, rows, options = {}) {
  const table = root.querySelector(tableSelector);
  if (!table) {
    return;
  }

  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  if (!thead || !tbody) {
    return;
  }

  const documentRef = getDocumentRef(root);
  if (Array.isArray(headers) && headers.length) {
    const tr = documentRef.createElement("tr");
    headers.forEach((header) => {
      const th = documentRef.createElement("th");
      th.textContent = header;
      tr.appendChild(th);
    });
    thead.innerHTML = "";
    thead.appendChild(tr);
  }

  if (Array.isArray(rows)) {
    tbody.innerHTML = "";
    rows.forEach((cells) => {
      const tr = documentRef.createElement("tr");
      (cells || []).forEach((cell, index) => {
        const td = documentRef.createElement("td");

        if (options.linkColumns && options.linkColumns[index]) {
          const linkKind = options.linkColumns[index];
          const anchor = documentRef.createElement("a");
          if (linkKind === "mail") {
            anchor.href = sanitizeHref(`mailto:${cell}`) || "#";
          } else if (linkKind === "tel") {
            anchor.href = sanitizeHref(`tel:${String(cell || "").replace(/[^\d+]/g, "")}`) || "#";
          } else {
            anchor.href = sanitizeHref(cell) || "#";
            if (/^https?:\/\//i.test(anchor.href)) {
              anchor.target = "_blank";
              anchor.rel = "noopener noreferrer";
            }
          }
          anchor.textContent = cell;
          td.appendChild(anchor);
        } else {
          td.textContent = cell;
        }

        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
}

function applyAboutContent(root, content) {
  if (!content || !content.about) {
    return;
  }

  const about = content.about;

  if (about.hero) {
    setTextContent(root, ".about-hero .section-kicker", about.hero.kicker);
    setTextContent(root, ".about-hero h1", about.hero.title);
    setTextContent(root, ".about-hero .about-hero-text", about.hero.description);
  }

  renderAboutFacts(root, about.basicFacts || []);
  renderAboutLinks(root, "#about-basic .about-card:nth-child(2) .about-links-list", about.documentsBasic || [], "links");
  renderAboutLinks(root, "#about-docs .about-doc-list", about.documentsMain || [], "list");

  if (about.education) {
    setTextContent(root, "#about-education .about-note", about.education.note);
    renderAboutLinks(root, "#about-education .about-links-list", about.education.links || [], "links");
    renderTable(root, "#about-education .about-table", about.education.headers || [], about.education.rows || []);
  }

  if (about.management) {
    renderTable(root, "#about-management .about-table", about.management.headers || [], about.management.rows || [], {
      linkColumns: {
        2: "tel",
        3: "mail"
      }
    });
  }

  if (about.financial) {
    setTextContent(root, "#about-extra .about-card:nth-child(3) .about-note", about.financial.note);
    renderTable(root, "#about-extra .about-card:nth-child(3) .about-table", about.financial.headers || [], about.financial.rows || []);
  }

  if (about.extra) {
    renderAboutLinks(root, "#about-extra .about-card:nth-child(1) .about-links-list", about.extra.pedagogy || [], "links");
    renderAboutLinks(root, "#about-extra .about-card:nth-child(2) .about-links-list", about.extra.paidServices || [], "links");
    renderAboutLinks(root, "#about-extra .about-card:nth-child(4) .about-links-list", about.extra.standards || [], "links");
    setTextContent(root, "#about-extra .about-card:nth-child(5) .about-license-placeholder", about.extra.license?.placeholder);

    const licenseLink = root.querySelector("#about-extra .about-card:nth-child(5) .about-links-list a");
    if (licenseLink) {
      setLinkContent(licenseLink, {
        text: about.extra.license?.registryLabel,
        href: about.extra.license?.registryUrl
      });
    }

    renderAboutLinks(root, "#about-extra .about-card:nth-child(6) .about-program-list", about.extra.programs || [], "list");

    const footerDocs = root.querySelector(".about-footer .footer-col-docs .footer-subsection:first-child .footer-links");
    if (footerDocs && Array.isArray(about.documentsMain)) {
      const topDocs = about.documentsMain.filter((item) => item.isPublished !== false && item.url).slice(0, 2);
      footerDocs.innerHTML = "";
      topDocs.forEach((item) => {
        const safeHref = sanitizeHref(item.url);
        if (!safeHref) {
          return;
        }
        const anchor = getDocumentRef(root).createElement("a");
        anchor.href = safeHref;
        if (/^https?:\/\//i.test(safeHref)) {
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }
        anchor.textContent = item.title;
        footerDocs.appendChild(anchor);
      });
    }

    const aboutFooterContacts = Array.from(root.querySelectorAll(".about-footer .footer-links-contacts a"));
    if (aboutFooterContacts.length >= 4 && content.home?.contacts) {
      const contacts = content.home.contacts;
      setLinkContent(aboutFooterContacts[0], {
        text: contacts.email,
        href: contacts.emailHref || `mailto:${contacts.email || ""}`
      });
      setLinkContent(aboutFooterContacts[1], {
        text: contacts.phone,
        href: contacts.phoneHref || `tel:${String(contacts.phone || "").replace(/[^\d+]/g, "")}`
      });
      setLinkContent(aboutFooterContacts[2], {
        text: contacts.telegramLabel,
        href: contacts.telegramUrl
      });
      setLinkContent(aboutFooterContacts[3], {
        text: contacts.maxLabel,
        href: contacts.maxUrl
      });
    }
  }
}

export function applyPublishedCms(root = document, content) {
  const effectiveContent = content || getPublishedContent();
  if (!effectiveContent || !root) {
    return;
  }

  if (root.querySelector("#hero")) {
    applyHomeContent(root, effectiveContent);
  }

  if (root.querySelector("#aboutMainContent")) {
    applyAboutContent(root, effectiveContent);
  }
}
