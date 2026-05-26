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
  const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
  const isPublished = item.isPublished !== false;

  if (hasUrl && isPublished) {
    const safeHref = sanitizeHref(item.url);
    if (!safeHref) {
      const placeholder = documentRef.createElement("span");
      placeholder.className = "about-link-pending";
      placeholder.textContent = item.title + " (небезопасная ссылка отклонена)";
      li.appendChild(placeholder);
      return li;
    }
    const anchor = documentRef.createElement("a");
    anchor.href = safeHref;
    if (/^https?:\/\//i.test(safeHref)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    anchor.textContent = item.title;
    li.appendChild(anchor);
  } else {
    const placeholder = documentRef.createElement("span");
    placeholder.className = "about-link-pending";
    placeholder.textContent = item.title + (item.title.includes("добавляется") ? "" : " (файл добавляется)");
    li.appendChild(placeholder);
  }

  return li;
}

function createLinkNode(documentRef, item) {
  const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
  const isPublished = item.isPublished !== false;

  if (hasUrl && isPublished) {
    const safeHref = sanitizeHref(item.url);
    if (!safeHref) {
      const placeholder = documentRef.createElement("span");
      placeholder.className = "about-link-pending";
      placeholder.textContent = item.title + " (небезопасная ссылка отклонена)";
      return placeholder;
    }
    const anchor = documentRef.createElement("a");
    anchor.href = safeHref;
    if (/^https?:\/\//i.test(safeHref)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    anchor.textContent = item.title;
    return anchor;
  }

  const placeholder = documentRef.createElement("span");
  placeholder.className = "about-link-pending";
  placeholder.textContent = item.title + (item.title.includes("добавляется") ? "" : " (файл добавляется)");
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

function applyHomeContent(root, content) {
  if (!content || !content.home) {
    return;
  }

  const { home } = content;

  if (home.hero) {
    setTextContent(root, ".hero-kicker", home.hero.kicker);
    setTextContent(root, "#hero .hero-main h1", home.hero.title);
    setTextContent(root, ".hero-quote", home.hero.quote);

    const actionButtons = Array.from(root.querySelectorAll(".hero-actions .btn"));
    if (Array.isArray(home.hero.actions)) {
      const publishedActions = home.hero.actions.filter((item) => item && item.isPublished !== false);
      actionButtons.forEach((button, index) => {
        const source = publishedActions[index];
        if (!source) {
          button.style.display = "none";
          return;
        }
        button.style.display = "inline-flex";
        button.textContent = source.label || button.textContent;
        button.classList.toggle("btn-primary", source.variant === "primary");
        button.classList.toggle("btn-secondary", source.variant !== "primary");

        button.removeAttribute("data-modal");
        button.removeAttribute("data-scroll");

        if (source.type === "modal") {
          const modalTarget =
            typeof source.target === "string" && /^[a-z0-9-]{1,48}$/i.test(source.target)
              ? source.target
              : "test";
          button.setAttribute("data-modal", modalTarget);
        } else {
          const scrollTarget =
            typeof source.target === "string" && /^#[a-z0-9_-]{1,48}$/i.test(source.target)
              ? source.target
              : "#contacts";
          button.setAttribute("data-scroll", scrollTarget);
        }
      });
    }

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
