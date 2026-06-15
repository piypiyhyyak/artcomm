const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const RELATIVE_PREFIXES = ["/", "#", "?"];

const ALLOWED_HTML_TAGS = new Set([
  "p",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "small",
  "span",
  "div",
  "article",
  "section",
  "h4",
  "h5",
  "ul",
  "ol",
  "li",
  "blockquote",
  "img",
  "br",
  "code"
]);

const COMMON_ATTRS = new Set(["class"]);
const TAG_ATTRS = {
  a: new Set(["href", "target", "rel", "class"]),
  i: new Set(["data-value", "class"]),
  span: new Set(["class"]),
  div: new Set(["class"]),
  article: new Set(["class"]),
  p: new Set(["class"]),
  ul: new Set(["class"]),
  ol: new Set(["class"]),
  li: new Set(["class"]),
  blockquote: new Set(["class"]),
  section: new Set(["class"]),
  code: new Set(["class"]),
  img: new Set(["src", "alt", "loading", "decoding", "class"])
};

const SAFE_CLASS_RE = /^[a-zA-Z0-9 _-]{0,120}$/;

function normalizeUrl(value) {
  return String(value || "").trim();
}

export function sanitizeHref(value, { allowRelative = true } = {}) {
  const raw = normalizeUrl(value);
  if (!raw) {
    return "";
  }

  if (allowRelative && RELATIVE_PREFIXES.some((prefix) => raw.startsWith(prefix))) {
    return raw;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (SAFE_PROTOCOLS.has(parsed.protocol)) {
        return raw;
      }
      return "";
    } catch {
      return "";
    }
  }

  return "";
}

export function sanitizeSrc(value) {
  const raw = normalizeUrl(value);
  if (!raw) {
    return "";
  }

  if (raw.startsWith("/assets/") || raw.startsWith("/")) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return "";
}

function sanitizeClassValue(rawClass) {
  const value = String(rawClass || "").trim();
  if (!value) {
    return "";
  }
  if (!SAFE_CLASS_RE.test(value)) {
    return "";
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

function sanitizeDataValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return String(Math.max(0, Math.min(100, Math.round(numeric))));
}

function copyAllowedAttributes(sourceNode, targetNode, documentRef) {
  const tag = targetNode.tagName.toLowerCase();
  const tagAllowed = TAG_ATTRS[tag] || new Set();

  Array.from(sourceNode.attributes || []).forEach((attr) => {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value;

    if (attrName.startsWith("on") || attrName === "style" || attrName === "srcdoc") {
      return;
    }

    if (!tagAllowed.has(attrName) && !COMMON_ATTRS.has(attrName)) {
      return;
    }

    if (attrName === "class") {
      const safeClass = sanitizeClassValue(attrValue);
      if (safeClass) {
        targetNode.setAttribute("class", safeClass);
      }
      return;
    }

    if (attrName === "data-value") {
      targetNode.setAttribute("data-value", sanitizeDataValue(attrValue));
      return;
    }

    if (tag === "a" && attrName === "href") {
      const safeHref = sanitizeHref(attrValue);
      if (!safeHref) {
        return;
      }
      targetNode.setAttribute("href", safeHref);
      if (/^https?:\/\//i.test(safeHref)) {
        targetNode.setAttribute("target", "_blank");
        targetNode.setAttribute("rel", "noopener noreferrer");
      }
      return;
    }

    if (tag === "a" && attrName === "target") {
      if (attrValue === "_blank") {
        targetNode.setAttribute("target", "_blank");
      }
      return;
    }

    if (tag === "a" && attrName === "rel") {
      targetNode.setAttribute("rel", "noopener noreferrer");
      return;
    }

    if (tag === "img" && attrName === "src") {
      const safeSrc = sanitizeSrc(attrValue);
      if (!safeSrc) {
        return;
      }
      targetNode.setAttribute("src", safeSrc);
      return;
    }

    if (tag === "img" && attrName === "alt") {
      targetNode.setAttribute("alt", String(attrValue || "").slice(0, 180));
      return;
    }

    if (tag === "img" && attrName === "loading") {
      targetNode.setAttribute("loading", attrValue === "eager" ? "eager" : "lazy");
      return;
    }

    if (tag === "img" && attrName === "decoding") {
      targetNode.setAttribute("decoding", attrValue === "sync" ? "sync" : "async");
      return;
    }

    targetNode.setAttribute(attrName, attrValue);
  });

  if (tag === "a") {
    const href = targetNode.getAttribute("href");
    if (!href) {
      return null;
    }
    if (/^https?:\/\//i.test(href) && !targetNode.getAttribute("target")) {
      targetNode.setAttribute("target", "_blank");
      targetNode.setAttribute("rel", "noopener noreferrer");
    }
  }

  if (tag === "img" && !targetNode.getAttribute("src")) {
    return null;
  }

  return targetNode;
}

function sanitizeHtmlNode(node, documentRef) {
  if (!node) {
    return null;
  }

  if (node.nodeType === 3) {
    return documentRef.createTextNode(node.textContent || "");
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_HTML_TAGS.has(tag) && tag !== "a") {
    const fragment = documentRef.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const safeChild = sanitizeHtmlNode(child, documentRef);
      if (safeChild) {
        fragment.appendChild(safeChild);
      }
    });
    return fragment;
  }

  const target = documentRef.createElement(tag);
  const prepared = copyAllowedAttributes(node, target, documentRef);
  if (!prepared) {
    const fragment = documentRef.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const safeChild = sanitizeHtmlNode(child, documentRef);
      if (safeChild) {
        fragment.appendChild(safeChild);
      }
    });
    return fragment;
  }

  Array.from(node.childNodes).forEach((child) => {
    const safeChild = sanitizeHtmlNode(child, documentRef);
    if (safeChild) {
      prepared.appendChild(safeChild);
    }
  });

  return prepared;
}

export function sanitizeHtmlFragment(html, documentRef = document) {
  const template = documentRef.createElement("template");
  template.innerHTML = String(html || "");

  const fragment = documentRef.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((node) => {
    const safeNode = sanitizeHtmlNode(node, documentRef);
    if (safeNode) {
      fragment.appendChild(safeNode);
    }
  });

  return fragment;
}
