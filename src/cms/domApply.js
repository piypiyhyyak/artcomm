import { getPublishedContent } from "./storage";

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
  if (typeof href === "string" && href) {
    node.setAttribute("href", href);
  }
}

function createLinkItem(documentRef, item) {
  const li = documentRef.createElement("li");
  const hasUrl = typeof item.url === "string" && item.url.trim() !== "";
  const isPublished = item.isPublished !== false;

  if (hasUrl && isPublished) {
    const anchor = documentRef.createElement("a");
    anchor.href = item.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
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
    const anchor = documentRef.createElement("a");
    anchor.href = item.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
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

  const published = trustedPartners.filter((item) => item && item.isPublished !== false);
  trustedNetwork.innerHTML = "";

  const canvas = root.ownerDocument.createElement("canvas");
  canvas.className = "trusted-network-canvas";
  canvas.id = "trustedNetworkCanvas";
  canvas.setAttribute("aria-hidden", "true");
  trustedNetwork.appendChild(canvas);

  published.forEach((item) => {
    const node = root.ownerDocument.createElement("span");
    node.className = "trusted-node";
    node.setAttribute("data-node", "");
    node.setAttribute("data-x", String(item.x ?? 50));
    node.setAttribute("data-y", String(item.y ?? 50));
    node.setAttribute("data-range", String(item.range ?? 40));

    const image = root.ownerDocument.createElement("img");
    image.src = item.logo || "";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.loading = "lazy";

    const label = root.ownerDocument.createElement("span");
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

  const published = slides.filter((slide) => slide && slide.isPublished !== false && slide.image);
  const sourcePool = published.length ? published : slides;

  heroSlidesNode.innerHTML = sourcePool
    .map((item, index) => {
      const activeClass = index === 0 ? " is-active" : "";
      const alt = item.alt || `Слайд ${index + 1}`;
      return `<div class="hero-slide${activeClass}" data-slide="${index}" role="img" aria-label="${alt.replace(/"/g, "&quot;")}"></div>`;
    })
    .join("");

  if (typeof window !== "undefined") {
    window.__artcommHeroSlides = sourcePool.map((item) => item.image).filter(Boolean);
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
          button.setAttribute("data-modal", source.target || "test");
        } else {
          button.setAttribute("data-scroll", source.target || "#contacts");
        }
      });
    }

    const trustLine = root.querySelector(".trust-line");
    if (trustLine && Array.isArray(home.hero.trustLine)) {
      const entries = home.hero.trustLine.filter((item) => item && item.isPublished !== false);
      trustLine.innerHTML = "";
      entries.forEach((item) => {
        const li = root.ownerDocument.createElement("li");
        const strong = root.ownerDocument.createElement("strong");
        const span = root.ownerDocument.createElement("span");
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
      source.setAttribute("data-src", home.mediaStation.videoDesktop || "/assets/gimn-ed-zy9mar.mp4");
      source.setAttribute("data-local-src", home.mediaStation.videoMobile || home.mediaStation.videoDesktop || "/assets/gimn-ed-zy9mar.mp4");
      source.setAttribute("data-fallback-src", home.mediaStation.videoFallback || home.mediaStation.videoDesktop || "/assets/gimn-ed-zy9mar.mp4");
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

      const template = root.ownerDocument.createElement("template");
      template.innerHTML = entry.bodyHtml;
      const fragment = template.content;
      modal.appendChild(fragment);
    });
  }
}

function renderAboutFacts(root, facts) {
  const list = root.querySelector("#about-basic .about-facts");
  if (!list || !Array.isArray(facts)) {
    return;
  }

  list.innerHTML = "";
  const items = facts.filter((item) => item && item.isPublished !== false);
  items.forEach((item) => {
    const row = root.ownerDocument.createElement("div");
    const dt = root.ownerDocument.createElement("dt");
    const dd = root.ownerDocument.createElement("dd");
    dt.textContent = item.label || "";

    if (item.link) {
      const anchor = root.ownerDocument.createElement("a");
      anchor.href = item.link;
      anchor.textContent = item.value || "";
      if (item.link.startsWith("http")) {
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
  const documentRef = root.ownerDocument;
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

  if (Array.isArray(headers) && headers.length) {
    const tr = root.ownerDocument.createElement("tr");
    headers.forEach((header) => {
      const th = root.ownerDocument.createElement("th");
      th.textContent = header;
      tr.appendChild(th);
    });
    thead.innerHTML = "";
    thead.appendChild(tr);
  }

  if (Array.isArray(rows)) {
    tbody.innerHTML = "";
    rows.forEach((cells) => {
      const tr = root.ownerDocument.createElement("tr");
      (cells || []).forEach((cell, index) => {
        const td = root.ownerDocument.createElement("td");

        if (options.linkColumns && options.linkColumns[index]) {
          const linkKind = options.linkColumns[index];
          const anchor = root.ownerDocument.createElement("a");
          if (linkKind === "mail") {
            anchor.href = `mailto:${cell}`;
          } else if (linkKind === "tel") {
            anchor.href = `tel:${String(cell || "").replace(/[^\d+]/g, "")}`;
          } else {
            anchor.href = cell;
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
        const anchor = root.ownerDocument.createElement("a");
        anchor.href = item.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
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
