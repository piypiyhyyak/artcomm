function initAbout() {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const siteHeader = $("#aboutHeader");
  const menuToggle = $("#menuToggle");
  const menuClose = $("#menuClose");
  const menuDrawer = $("#menuDrawer");
  const drawerOverlay = $("#drawerOverlay");

  if (!siteHeader || !menuToggle || !menuClose || !menuDrawer || !drawerOverlay) {
    return () => {};
  }

  const cleanupHandlers = [];
  const addListener = (element, eventName, handler, options) => {
    element.addEventListener(eventName, handler, options);
    cleanupHandlers.push(() => element.removeEventListener(eventName, handler, options));
  };

  const setMenuState = (isOpen) => {
    menuDrawer.classList.toggle("is-open", isOpen);
    drawerOverlay.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuDrawer.setAttribute("aria-hidden", String(!isOpen));
    document.body.classList.toggle("menu-open", isOpen);
    syncHeaderVisualState();
  };

  let isHeaderHovered = false;
  let isHeaderSolidByScroll = false;

  const syncHeaderVisualState = () => {
    const shouldBeSolid =
      isHeaderHovered ||
      isHeaderSolidByScroll ||
      menuDrawer.classList.contains("is-open");

    siteHeader.classList.toggle("is-solid", shouldBeSolid);
  };

  const handleHeaderScroll = () => {
    isHeaderSolidByScroll = window.pageYOffset > 22;
    syncHeaderVisualState();
  };

  const scrollToTarget = (targetSelector) => {
    const target = $(targetSelector);
    if (!target) {
      return;
    }

    const headerOffset = siteHeader.offsetHeight + 8;
    const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  addListener(menuToggle, "click", () => {
    const isOpen = menuDrawer.classList.contains("is-open");
    setMenuState(!isOpen);
  });

  addListener(menuClose, "click", () => setMenuState(false));
  addListener(drawerOverlay, "click", () => setMenuState(false));
  addListener(siteHeader, "mouseenter", () => {
    isHeaderHovered = true;
    syncHeaderVisualState();
  });
  addListener(siteHeader, "mouseleave", () => {
    isHeaderHovered = false;
    syncHeaderVisualState();
  });
  addListener(window, "scroll", handleHeaderScroll, { passive: true });

  addListener(document, "keydown", (event) => {
    if (event.key === "Escape" && menuDrawer.classList.contains("is-open")) {
      setMenuState(false);
    }
  });

  $$("[data-scroll]").forEach((element) => {
    const handler = (event) => {
      const targetSelector = element.getAttribute("data-scroll");
      if (!targetSelector) {
        return;
      }
      event.preventDefault();
      setMenuState(false);
      scrollToTarget(targetSelector);
    };
    addListener(element, "click", handler);
  });

  handleHeaderScroll();

  return () => {
    setMenuState(false);
    cleanupHandlers.forEach((cleanup) => cleanup());
  };
}

export default initAbout;
