const FAST_VIDEO_SUFFIX = "-fast";

export function isSafariLikeBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const vendor = navigator.vendor || "";

  return vendor === "Apple Computer, Inc." && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(userAgent);
}

export function buildFastVideoSource(source) {
  const safeSource = typeof source === "string" ? source.trim() : "";
  if (!safeSource) {
    return "";
  }

  if (new RegExp(`${FAST_VIDEO_SUFFIX}\\.[^./?#]+(?:[?#].*)?$`, "i").test(safeSource)) {
    return safeSource;
  }

  const match = safeSource.match(/^(.*?)(\.[a-z0-9]+)([?#].*)?$/i);
  if (!match) {
    return safeSource;
  }

  return `${match[1]}${FAST_VIDEO_SUFFIX}${match[2]}${match[3] || ""}`;
}
