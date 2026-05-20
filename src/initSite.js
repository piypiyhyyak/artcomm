import diamondChartSvg from "./assets/chart.svg?raw";

export default function initSite() {
  if (window.__artcommSiteInitialized) {
    return;
  }
  window.__artcommSiteInitialized = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const siteHeader = $("#siteHeader");
  const menuToggle = $("#menuToggle");
  const menuClose = $("#menuClose");
  const menuDrawer = $("#menuDrawer");
  const drawerOverlay = $("#drawerOverlay");

  const heroSection = $("#hero");
  const commonSection = $("#common");
  const expertSection = $("#expert");
  const heroSlides = $$(".hero-slide");
  const heroDotsWrap = $("#heroDots");
  const prevSlideBtn = $("#prevSlide");
  const nextSlideBtn = $("#nextSlide");

  const msPinShell = $("#msPinShell");
  const videoWrap = $("#videoWrap");
  const msVideo = $("#msVideo");
  const videoPlaceholder = $("#videoPlaceholder");
  const videoPlayBtn = $("#videoPlay");
  const msVideoHeadline = $("#msVideoHeadline");

  const modalLayer = $("#modalLayer");
  const modalOverlay = $("#modalOverlay");
  const modals = $$(".modal");

  const expertMainPhoto = $("#expertMainPhoto");
  const expertThumbsRoot = $("#expertThumbs");
  const expertThumbs = $$(".thumb", expertThumbsRoot || document);
  const expertPrevBtn = $("#expertPrev");
  const expertNextBtn = $("#expertNext");
  const expertPhotoCurrent = $("#expertPhotoCurrent");
  const expertReset = $(".expert-reset");
  const expertResetMedia = $(".expert-reset-media", expertReset || document);
  const expertCopyCore = $(".expert-copy-core", expertReset || document);
  const expertBrief = $(".expert-brief", expertCopyCore || document);

  const diamondChart = $("#diamondChart");
  const diamondSvgHost = $("#diamondSvgHost");
  const diamondTooltip = $("#diamondTooltip");
  const diamondReadout = $("#diamondReadout");
  const iksAxisItems = $$(".iks-axis-list li[data-key]");

  const testQuestionWrap = $("#testQuestionWrap");
  const testProgressBar = $("#testProgressBar");
  const testNextBtn = $("#testNext");
  const testBackBtn = $("#testBack");
  const testResult = $("#testResult");

  const commonDrumStage = $("#commonDrumStage");
  const commonDrumItems = $$(".common-drum-item", commonDrumStage || document);
  const commonDrumArrow = $("#commonDrumArrow");

  const trustedNetwork = $("#trustedNetwork");
  const trustedNetworkCanvas = $("#trustedNetworkCanvas");
  const trustedNetworkNodes = $$(".trusted-node[data-node]", trustedNetwork || document);

  if (
    !siteHeader ||
    !menuToggle ||
    !menuClose ||
    !menuDrawer ||
    !drawerOverlay ||
    !heroSection ||
    !heroDotsWrap ||
    !prevSlideBtn ||
    !nextSlideBtn ||
    !modalLayer ||
    !modalOverlay ||
    !testQuestionWrap ||
    !testProgressBar ||
    !testNextBtn ||
    !testBackBtn ||
    !testResult
  ) {
    return;
  }

  let activeModal = null;
  let heroIndex = 0;
  let heroTimer = null;
  let isHeroPaused = false;
  let expertAutoTimer = null;
  let isHeaderHovered = false;
  let headerScrollTicking = false;
  let commonDrumTicking = false;
  let msPinTicking = false;
  let activeDiamondPoint = null;
  let diamondTooltipTimer = null;
  let diamondPointEntries = [];
  let diamondChartInitialized = false;
  let trustedNetworkInitialized = false;
  let videoPlayAttemptId = 0;

  function syncHeaderVisualState() {
    const shouldBeSolid =
      isHeaderHovered ||
      window.scrollY > 14 ||
      menuDrawer.classList.contains("is-open") ||
      document.body.classList.contains("modal-open");

    siteHeader.classList.toggle("is-solid", shouldBeSolid);
  }

  function handleHeaderScroll() {
    if (headerScrollTicking) {
      return;
    }
    headerScrollTicking = true;
    requestAnimationFrame(function () {
      headerScrollTicking = false;
      syncHeaderVisualState();
    });
  }

  function scrollToTarget(targetSelector) {
    const target = $(targetSelector);
    if (!target) {
      return;
    }

    const headerOffset = siteHeader ? siteHeader.offsetHeight + 8 : 0;
    const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function setMenuState(open) {
    menuDrawer.classList.toggle("is-open", open);
    drawerOverlay.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuDrawer.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-open", open);
    syncHeaderVisualState();
  }

  siteHeader.addEventListener("mouseenter", function () {
    isHeaderHovered = true;
    syncHeaderVisualState();
  });

  siteHeader.addEventListener("mouseleave", function () {
    isHeaderHovered = false;
    syncHeaderVisualState();
  });

  window.addEventListener("scroll", handleHeaderScroll, { passive: true });

  menuToggle.addEventListener("click", function () {
    const isOpen = menuDrawer.classList.contains("is-open");
    setMenuState(!isOpen);
  });

  menuClose.addEventListener("click", function () {
    setMenuState(false);
  });

  drawerOverlay.addEventListener("click", function () {
    setMenuState(false);
  });

  $$("[data-scroll]").forEach(function (el) {
    el.addEventListener("click", function (event) {
      event.preventDefault();
      const target = el.getAttribute("data-scroll");
      if (!target) {
        return;
      }
      setMenuState(false);
      if (activeModal) {
        closeModal();
      }
      scrollToTarget(target);
    });
  });

  const photoPool = [
    "/assets/hero-5.jpeg",
    "/assets/hero-4.jpeg",
    "/assets/hero-3.jpeg",
    "/assets/hero-2.jpeg",
    "/assets/hero-1.jpeg"
  ];
  const networkInfo =
    typeof navigator === "object"
      ? navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
      : null;
  const connectionType =
    networkInfo && typeof networkInfo.effectiveType === "string"
      ? networkInfo.effectiveType.toLowerCase()
      : "";
  const isSlowNetwork =
    connectionType === "slow-2g" ||
    connectionType.includes("2g") ||
    connectionType.includes("3g");
  const savesData = Boolean(networkInfo && networkInfo.saveData);
  const isTouchLikeDevice =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isLiteMode = savesData || isSlowNetwork || isTouchLikeDevice;
  const allowAutoVideoPlayback = !(savesData || isSlowNetwork || isTouchLikeDevice);
  const loadedHeroSlideIndexes = new Set();
  let queuedHeroWarmup = false;

  function normalizeHeroIndex(index) {
    const size = heroSlides.length;
    if (!size) {
      return 0;
    }
    return ((index % size) + size) % size;
  }

  function paintHeroSlide(index) {
    if (!heroSlides.length) {
      return;
    }

    const safeIndex = normalizeHeroIndex(index);
    if (loadedHeroSlideIndexes.has(safeIndex)) {
      return;
    }

    const image = photoPool[safeIndex % photoPool.length];
    heroSlides[safeIndex].style.backgroundImage = "url('" + image + "')";
    loadedHeroSlideIndexes.add(safeIndex);
  }

  function warmupHeroSlides() {
    if (queuedHeroWarmup || heroSlides.length < 2) {
      return;
    }

    queuedHeroWarmup = true;
    const warmup = function () {
      if (isLiteMode) {
        paintHeroSlide(heroIndex + 1);
        paintHeroSlide(heroIndex + 2);
        return;
      }

      heroSlides.forEach(function (_, index) {
        paintHeroSlide(index);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warmup, { timeout: 1500 });
      return;
    }

    setTimeout(warmup, 420);
  }

  function initHeroBackgrounds() {
    if (!heroSlides.length) {
      return;
    }

    paintHeroSlide(0);
    paintHeroSlide(1);
    window.addEventListener("load", warmupHeroSlides, { once: true });
  }

  function renderHeroDots() {
    heroDotsWrap.innerHTML = "";
    heroSlides.forEach(function (_, index) {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", "Перейти к слайду " + (index + 1));
      dot.addEventListener("click", function () {
        goToSlide(index);
        restartHeroTimer();
      });
      heroDotsWrap.appendChild(dot);
    });
  }

  function goToSlide(nextIndex) {
    heroIndex = normalizeHeroIndex(nextIndex);

    paintHeroSlide(heroIndex);
    paintHeroSlide(heroIndex + 1);

    heroSlides.forEach(function (slide, index) {
      slide.classList.toggle("is-active", index === heroIndex);
    });

    $$("button", heroDotsWrap).forEach(function (dot, index) {
      dot.classList.toggle("is-active", index === heroIndex);
    });
  }

  function startHeroTimer() {
    if (heroTimer) {
      return;
    }
    heroTimer = setInterval(function () {
      if (!isHeroPaused) {
        goToSlide(heroIndex + 1);
      }
    }, 6000);
  }

  function stopHeroTimer() {
    if (!heroTimer) {
      return;
    }
    clearInterval(heroTimer);
    heroTimer = null;
  }

  function restartHeroTimer() {
    stopHeroTimer();
    startHeroTimer();
  }

  prevSlideBtn.addEventListener("click", function () {
    goToSlide(heroIndex - 1);
    restartHeroTimer();
  });

  nextSlideBtn.addEventListener("click", function () {
    goToSlide(heroIndex + 1);
    restartHeroTimer();
  });

  function setHeroPause(paused) {
    isHeroPaused = paused;
    if (paused) {
      stopHeroTimer();
    } else {
      startHeroTimer();
    }
  }

  [prevSlideBtn, nextSlideBtn, heroDotsWrap].forEach(function (target) {
    if (!target) {
      return;
    }
    target.addEventListener("mouseenter", function () {
      setHeroPause(true);
    });
    target.addEventListener("mouseleave", function () {
      setHeroPause(false);
    });
  });

  function applyCommonDrumState(activeIndex, collapsed) {
    if (!commonDrumStage || !commonDrumItems.length) {
      return;
    }

    const collapsedOffsets = [0, 92, 184, 276];
    commonDrumStage.classList.toggle("is-collapsed", collapsed);

    const compactHeight = 76;
    const activeHeight = 184;
    const compactGap = 16;
    const activeGap = 14;
    let cursor = 0;

    commonDrumItems.forEach(function (item, itemIndex) {
      item.classList.remove("is-active", "is-before", "is-after");

      let offsetY = 0;
      let scale = 0.96;

      if (collapsed) {
        offsetY = typeof collapsedOffsets[itemIndex] === "number" ? collapsedOffsets[itemIndex] : 24 + itemIndex * 84;
        scale = 0.96;
      } else {
        const isActive = itemIndex === activeIndex;
        offsetY = cursor;
        scale = isActive ? 1 : 0.96;
        cursor += (isActive ? activeHeight : compactHeight) + (isActive ? activeGap : compactGap);

        if (isActive) {
          item.classList.add("is-active");
        } else if (itemIndex > activeIndex) {
          item.classList.add("is-after");
        } else {
          item.classList.add("is-before");
        }
      }

      item.style.setProperty("--offset-y", String(offsetY) + "px");
      item.style.setProperty("--scale", String(scale));
    });
  }

  function setCommonArrowProgress(progress) {
    if (!commonDrumArrow || !commonDrumStage) {
      return;
    }
    const safeProgress = Math.min(Math.max(progress, 0), 1);
    commonDrumArrow.style.setProperty("--arrow-progress", safeProgress.toFixed(4));
    commonDrumStage.classList.toggle("is-arrow-phase", safeProgress > 0.001);
  }

  function setCommonMenProgress(progress) {
    if (!commonSection) {
      return;
    }
    const safeProgress = Math.min(Math.max(progress, 0), 1);
    commonSection.style.setProperty("--common-men-progress", safeProgress.toFixed(4));
    commonSection.classList.toggle("is-men-phase", safeProgress > 0.001);
  }

  function updateCommonDrum() {
    if (!commonDrumStage || !commonDrumItems.length || !commonSection) {
      return;
    }

    if (window.matchMedia("(max-width: 900px)").matches) {
      commonDrumStage.classList.remove("is-collapsed");
      setCommonArrowProgress(0);
      setCommonMenProgress(0);
      commonDrumItems.forEach(function (item, itemIndex) {
        item.style.removeProperty("--offset-y");
        item.style.removeProperty("--scale");
        item.classList.remove("is-before", "is-after");
        item.classList.toggle("is-active", itemIndex === 0);
      });
      return;
    }

    const headerOffset = siteHeader ? siteHeader.offsetHeight : 0;
    const viewportForDrum = window.innerHeight - headerOffset;
    const scrollRange = commonDrumStage.offsetHeight - viewportForDrum;
    if (scrollRange <= 0) {
      applyCommonDrumState(0, true);
      setCommonArrowProgress(0);
      setCommonMenProgress(0);
      return;
    }

    const anchorRect = commonSection.getBoundingClientRect();
    const traveled = Math.min(Math.max(headerOffset - anchorRect.top, 0), scrollRange);
    const progress = traveled / scrollRange;
    const drumPhaseCount = commonDrumItems.length + 1;
    const arrowPhaseCount = 1;
    const menPhaseCount = 1;
    const totalPhaseCount = drumPhaseCount + arrowPhaseCount + menPhaseCount;
    const phaseFloat = progress * totalPhaseCount;
    const phase = Math.min(totalPhaseCount - 1, Math.floor(phaseFloat));

    if (phase < drumPhaseCount) {
      const isCollapsed = phase === 0;
      const activeIndex = Math.min(commonDrumItems.length - 1, Math.max(0, phase - 1));
      applyCommonDrumState(activeIndex, isCollapsed);
      setCommonArrowProgress(0);
      setCommonMenProgress(0);
      return;
    }

    if (phaseFloat < drumPhaseCount + arrowPhaseCount) {
      applyCommonDrumState(commonDrumItems.length - 1, true);
      setCommonArrowProgress(phaseFloat - drumPhaseCount);
      setCommonMenProgress(0);
      return;
    }

    applyCommonDrumState(commonDrumItems.length - 1, true);
    setCommonArrowProgress(1);
    setCommonMenProgress(phaseFloat - drumPhaseCount - arrowPhaseCount);
  }

  function handleCommonDrumScroll() {
    if (commonDrumTicking) {
      return;
    }
    commonDrumTicking = true;
    requestAnimationFrame(function () {
      commonDrumTicking = false;
      updateCommonDrum();
    });
  }

  if (commonDrumStage && commonDrumItems.length) {
    commonDrumStage.style.setProperty("--common-drum-steps", String(commonDrumItems.length + 3));
    window.addEventListener("scroll", handleCommonDrumScroll, { passive: true });
    window.addEventListener("resize", handleCommonDrumScroll);
    updateCommonDrum();
  }

  function updateMsPinStage() {
    if (!msPinShell || !videoWrap) {
      return;
    }

    if (window.matchMedia("(max-width: 900px)").matches) {
      videoWrap.style.setProperty("--ms-video-shift", "0px");
      videoWrap.style.setProperty("--ms-video-scale", "1");
      videoWrap.style.setProperty("--ms-video-radius", "0px");
      videoWrap.classList.remove("is-label-visible");
      if (msVideoHeadline) {
        msVideoHeadline.setAttribute("aria-hidden", "true");
      }
      return;
    }

    const headerOffset = siteHeader ? siteHeader.offsetHeight : 0;
    const viewport = window.innerHeight - headerOffset;
    const shellHeight = msPinShell.offsetHeight;
    const scrollRange = shellHeight - viewport;

    if (scrollRange <= 0) {
      videoWrap.style.setProperty("--ms-video-shift", "0px");
      videoWrap.style.setProperty("--ms-video-scale", "1");
      videoWrap.style.setProperty("--ms-video-radius", "0px");
      videoWrap.classList.add("is-label-visible");
      if (msVideoHeadline) {
        msVideoHeadline.setAttribute("aria-hidden", "false");
      }
      return;
    }

    const shellRect = msPinShell.getBoundingClientRect();
    const traveled = Math.min(Math.max(headerOffset - shellRect.top, 0), scrollRange);
    const progress = traveled / scrollRange;
    const pinPhase = Math.min(Math.max((progress - 0.06) / 0.56, 0), 1);
    const eased = 1 - Math.pow(1 - pinPhase, 2.15);

    const shift = (1 - eased) * 56;
    const scale = 0.92 + eased * 0.08;
    const radius = (1 - eased) * 24;

    videoWrap.style.setProperty("--ms-video-shift", shift.toFixed(2) + "px");
    videoWrap.style.setProperty("--ms-video-scale", scale.toFixed(4));
    videoWrap.style.setProperty("--ms-video-radius", radius.toFixed(2) + "px");
    videoWrap.classList.toggle("is-label-visible", progress > 0.5);
    if (msVideoHeadline) {
      msVideoHeadline.setAttribute("aria-hidden", String(!(progress > 0.5)));
    }
  }

  function handleMsPinScroll() {
    if (msPinTicking) {
      return;
    }

    msPinTicking = true;
    requestAnimationFrame(function () {
      msPinTicking = false;
      updateMsPinStage();
    });
  }

  if (msPinShell && videoWrap) {
    window.addEventListener("scroll", handleMsPinScroll, { passive: true });
    window.addEventListener("resize", handleMsPinScroll);
    updateMsPinStage();
  }

  function hasVideoSource(video) {
    if (!video) {
      return false;
    }
    const source = $("source", video);
    const sourceSrc = source ? source.getAttribute("src") || source.dataset.src : "";
    const videoSrc = video.getAttribute("src") || video.dataset.src || "";
    return Boolean(video.currentSrc || videoSrc || sourceSrc);
  }

  function hydrateVideoSource(video) {
    if (!video) {
      return false;
    }

    const source = $("source", video);
    let changed = false;

    if (source && !source.getAttribute("src") && source.dataset.src) {
      source.setAttribute("src", source.dataset.src);
      changed = true;
    }

    if (!source && !video.getAttribute("src") && video.dataset.src) {
      video.setAttribute("src", video.dataset.src);
      changed = true;
    }

    if (changed) {
      video.load();
    }

    return hasVideoSource(video);
  }

  function setVideoPlaceholderMessage(message) {
    if (!videoPlaceholder) {
      return;
    }
    const hint = $("p", videoPlaceholder);
    if (hint) {
      hint.textContent = message;
    }
  }

  function showVideoPlaceholder(message) {
    if (!videoPlaceholder) {
      return;
    }
    if (msVideo && (!msVideo.paused || msVideo.currentTime > 0.02)) {
      hideVideoPlaceholder();
      return;
    }
    if (message) {
      setVideoPlaceholderMessage(message);
    }
    if (videoWrap) {
      videoWrap.classList.remove("is-video-ready");
    }
    videoPlaceholder.style.display = "grid";
    videoPlaceholder.setAttribute("aria-hidden", "false");
  }

  function hideVideoPlaceholder() {
    if (!videoPlaceholder) {
      return;
    }
    if (videoWrap) {
      videoWrap.classList.add("is-video-ready");
    }
    videoPlaceholder.style.display = "none";
    videoPlaceholder.setAttribute("aria-hidden", "true");
  }

  function tryPlayVideo() {
    if (!msVideo) {
      return;
    }

    const hasSource = hydrateVideoSource(msVideo);
    if (!hasSource) {
      setVideoPlaceholderMessage("Видео не найдено. Загрузите файл на сервер по пути /assets/gimn-ed-zy9mar-lite.mp4 и укажите этот путь в теге <video>.");
      return;
    }

    msVideo.muted = true;
    msVideo.playsInline = true;
    const currentAttempt = ++videoPlayAttemptId;
    const attempt = msVideo.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(function () {
        if (currentAttempt !== videoPlayAttemptId) {
          return;
        }
        hideVideoPlaceholder();
      });
    }
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () {
        if (currentAttempt !== videoPlayAttemptId) {
          return;
        }
        if (!msVideo.paused || msVideo.currentTime > 0.02) {
          hideVideoPlaceholder();
          return;
        }
        msVideo.removeAttribute("controls");
        showVideoPlaceholder("Текущий браузер не смог автоматически воспроизвести видео.");
      });
    }
  }

  function pauseVideo() {
    if (!msVideo) {
      return;
    }
    msVideo.pause();
  }

  if (videoPlayBtn) {
    videoPlayBtn.addEventListener("click", function () {
      if (!hydrateVideoSource(msVideo)) {
        setVideoPlaceholderMessage("Видео не найдено. Загрузите файл на сервер по пути /assets/gimn-ed-zy9mar-lite.mp4 и укажите этот путь в теге <video>.");
        return;
      }
      tryPlayVideo();
      msVideo.setAttribute("controls", "");
    });
  }

  if (msVideo) {
    function syncVideoPlaceholderState() {
      if (msVideo.currentTime <= 0.02 && msVideo.paused && msVideo.readyState < 2) {
        return;
      }
      hideVideoPlaceholder();
    }

    msVideo.addEventListener("play", syncVideoPlaceholderState);
    msVideo.addEventListener("playing", syncVideoPlaceholderState);
    msVideo.addEventListener("loadeddata", syncVideoPlaceholderState);
    msVideo.addEventListener("canplay", syncVideoPlaceholderState);
    msVideo.addEventListener("timeupdate", syncVideoPlaceholderState);

    msVideo.addEventListener("error", function () {
      showVideoPlaceholder("Формат не поддержан браузером. Конвертируйте ролик в MP4 (H.264/AAC).");
    });
  }

  const revealItems = $$("[data-reveal]");
  revealItems.forEach(function (item, index) {
    const siblings = item.parentElement
      ? Array.from(item.parentElement.children).filter(function (node) {
        return node.matches("[data-reveal]");
      })
      : [];

    const siblingIndex = siblings.indexOf(item);
    const order = siblingIndex >= 0 ? siblingIndex : index;
    const delayStep = item.classList.contains("pain-card") ? 72 : 96;

    item.style.transitionDelay = String(Math.min(order, 8) * delayStep) + "ms";
  });

  const revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  revealItems.forEach(function (item) {
    revealObserver.observe(item);
  });

  function formatCounter(value, decimals, suffix) {
    const safe = Number.isFinite(value) ? value : 0;
    const formatted = safe.toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return String(formatted) + (suffix || "");
  }

  function animateCounter(element) {
    if (!element || element.dataset.animated === "true") {
      return;
    }

    const target = Number.parseFloat(element.dataset.counter || "0");
    const raw = element.dataset.counter || "0";
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const suffix = element.dataset.suffix || "";

    element.dataset.animated = "true";

    const duration = 1450;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const value = target * progress;
      element.textContent = formatCounter(value, decimals, suffix);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.textContent = formatCounter(target, decimals, suffix);
      }
    }

    requestAnimationFrame(frame);
  }

  function animateBars(root) {
    $$(".bar i[data-value]", root || document).forEach(function (bar) {
      if (bar.dataset.animated === "true") {
        return;
      }
      bar.dataset.animated = "true";
      requestAnimationFrame(function () {
        bar.style.width = String(bar.dataset.value || 0) + "%";
      });
    });

    $$(".ring-progress[data-value]", root || document).forEach(function (ring) {
      if (ring.dataset.animated === "true") {
        return;
      }

      ring.dataset.animated = "true";
      const radius = Number.parseFloat(ring.getAttribute("r") || "46");
      const circumference = 2 * Math.PI * radius;
      const raw = Number.parseFloat(ring.dataset.value || "0");
      const value = Math.max(0, Math.min(100, raw));
      const targetOffset = circumference * (1 - value / 100);

      ring.style.strokeDasharray = String(circumference);
      ring.style.strokeDashoffset = String(circumference);

      requestAnimationFrame(function () {
        ring.style.strokeDashoffset = String(targetOffset);
      });
    });
  }

  const counterObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.45 });

  $$("[data-counter]").forEach(function (counter) {
    counterObserver.observe(counter);
  });

  const barsObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }
      animateBars(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.3 });

  const loyaltyBars = $("#loyaltyBars");
  if (loyaltyBars) {
    barsObserver.observe(loyaltyBars);
  }

  const videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        if (allowAutoVideoPlayback) {
          tryPlayVideo();
        }
      } else {
        pauseVideo();
      }
    });
  }, { threshold: 0.55 });

  if (videoWrap) {
    videoObserver.observe(videoWrap);
  }

  const diamondObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  if (diamondChart) {
    diamondObserver.observe(diamondChart);
  }

  const diamondConfig = [
    { key: "Организация", city: "2,2", avg: "1,4", cityX: 627, cityY: 319, avgX: 627, avgY: 431 },
    { key: "Компетенции", city: "2,6", avg: "1,7", cityX: 991, cityY: 627, avgX: 865, avgY: 627 },
    { key: "Контент", city: "1,8", avg: "1,2", cityX: 627, cityY: 879, avgX: 627, avgY: 795 },
    { key: "Охват", city: "1,9", avg: "1,3", cityX: 361, cityY: 627, avgX: 445, avgY: 627 }
  ];

  function setAxisActive(key) {
    iksAxisItems.forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.key === key);
    });
  }

  function setDiamondReadout(entry) {
    if (!diamondReadout || !entry) {
      return;
    }

    diamondReadout.innerHTML = "<strong>" + entry.key + "</strong><span>Город: " + entry.city + " · Среднее: " + entry.avg + "</span>";
  }

  function positionDiamondTooltip(target) {
    if (!diamondTooltip || !diamondChart || !target) {
      return;
    }

    const chartRect = diamondChart.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const tooltipWidth = Math.min(194, Math.max(158, chartRect.width * 0.44));
    const centerX = targetRect.left + targetRect.width / 2 - chartRect.left;
    const topY = targetRect.top - chartRect.top;

    const x = Math.max(8, Math.min(centerX - tooltipWidth / 2, chartRect.width - tooltipWidth - 8));
    const y = Math.max(8, topY - 68);

    diamondTooltip.style.width = String(tooltipWidth) + "px";
    diamondTooltip.style.left = String(x) + "px";
    diamondTooltip.style.top = String(y) + "px";
  }

  function showDiamondTooltip(entry) {
    if (!diamondTooltip || !entry) {
      return;
    }

    if (diamondTooltipTimer) {
      clearTimeout(diamondTooltipTimer);
      diamondTooltipTimer = null;
    }

    diamondTooltip.innerHTML = "<strong>" + entry.key + "</strong><br>Город: " + entry.city + "<br>Среднее: " + entry.avg;
    positionDiamondTooltip(entry.hit);
    diamondTooltip.hidden = false;

    requestAnimationFrame(function () {
      diamondTooltip.classList.add("is-open");
    });
  }

  function hideDiamondTooltip() {
    if (!diamondTooltip) {
      return;
    }

    diamondTooltip.classList.remove("is-open");
    diamondTooltipTimer = setTimeout(function () {
      diamondTooltip.hidden = true;
    }, 140);
  }

  function activateDiamondEntry(entry, withTooltip) {
    if (!entry) {
      return;
    }

    activeDiamondPoint = entry.hit;
    setDiamondReadout(entry);
    setAxisActive(entry.key);

    diamondPointEntries.forEach(function (item) {
      const isActive = item.key === entry.key;
      item.hit.classList.toggle("is-active", isActive);
      item.cityCircle.classList.toggle("is-active", isActive);
      item.avgCircle.classList.toggle("is-active", isActive);
      item.cityCircle.setAttribute("r", String(isActive ? item.baseCityRadius + 1.6 : item.baseCityRadius));
      item.avgCircle.setAttribute("r", String(isActive ? item.baseAvgRadius + 1.2 : item.baseAvgRadius));
    });

    if (withTooltip) {
      showDiamondTooltip(entry);
    }
  }

  function activateDiamondByKey(key, withTooltip) {
    const entry = diamondPointEntries.find(function (item) {
      return item.key === key;
    });
    if (entry) {
      activateDiamondEntry(entry, withTooltip);
    }
  }

  function findCircleByCoords(svgRoot, x, y) {
    return $$("circle", svgRoot).find(function (circle) {
      const cx = Number.parseFloat(circle.getAttribute("cx") || "0");
      const cy = Number.parseFloat(circle.getAttribute("cy") || "0");
      return Math.abs(cx - x) < 0.8 && Math.abs(cy - y) < 0.8;
    });
  }

  function cleanupDiamondSvg(svgRoot) {
    const backgroundRect = $("rect[fill='#FFFFFF']", svgRoot);
    if (backgroundRect) {
      backgroundRect.remove();
    }

    svgRoot.removeAttribute("width");
    svgRoot.removeAttribute("height");
    svgRoot.classList.add("diamond-map");

    $$("line", svgRoot).forEach(function (line) {
      const y = Number.parseFloat(line.getAttribute("y1") || "-1");
      if (Math.abs(y - 72) < 0.5 || Math.abs(y - 117) < 0.5) {
        line.remove();
      }
    });

    $$("text", svgRoot).forEach(function (textNode) {
      const text = (textNode.textContent || "").trim();
      if (text === "Город (пример)" || text === "Среднее по всем городам") {
        textNode.remove();
      }
    });

    const cityShape = $("polygon[fill='#2F80ED'][fill-opacity='0.08']", svgRoot);
    const avgShape = $("polygon[stroke='#6B7280'][stroke-dasharray='12 10']", svgRoot);

    if (cityShape) {
      cityShape.classList.add("diamond-city-shape", "diamond-animated");
    }
    if (avgShape) {
      avgShape.classList.add("diamond-avg-shape", "diamond-animated");
    }
  }

  function createDiamondHotspots(svgRoot) {
    const ns = "http://www.w3.org/2000/svg";
    const hotspotLayer = document.createElementNS(ns, "g");
    hotspotLayer.setAttribute("class", "diamond-hotspot-layer");
    svgRoot.appendChild(hotspotLayer);

    diamondPointEntries = [];

    diamondConfig.forEach(function (config) {
      const cityCircle = findCircleByCoords(svgRoot, config.cityX, config.cityY);
      const avgCircle = findCircleByCoords(svgRoot, config.avgX, config.avgY);

      if (!cityCircle || !avgCircle) {
        return;
      }

      cityCircle.classList.add("diamond-city-point");
      avgCircle.classList.add("diamond-avg-point");

      const hit = document.createElementNS(ns, "circle");
      hit.setAttribute("cx", String(config.cityX));
      hit.setAttribute("cy", String(config.cityY));
      hit.setAttribute("r", "34");
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", config.key + ": город " + config.city + ", среднее " + config.avg);
      hit.classList.add("diamond-hotspot");
      hotspotLayer.appendChild(hit);

      const entry = {
        key: config.key,
        city: config.city,
        avg: config.avg,
        hit: hit,
        cityCircle: cityCircle,
        avgCircle: avgCircle,
        baseCityRadius: Number.parseFloat(cityCircle.getAttribute("r") || "0"),
        baseAvgRadius: Number.parseFloat(avgCircle.getAttribute("r") || "0")
      };

      hit.addEventListener("mouseenter", function () {
        activateDiamondEntry(entry, true);
      });

      hit.addEventListener("mouseleave", function () {
        hideDiamondTooltip();
      });

      hit.addEventListener("focus", function () {
        activateDiamondEntry(entry, true);
      });

      hit.addEventListener("blur", function () {
        hideDiamondTooltip();
      });

      hit.addEventListener("click", function () {
        activateDiamondEntry(entry, true);
      });

      diamondPointEntries.push(entry);
    });
  }

  function initDiamondChart() {
    if (diamondChartInitialized || !diamondChart || !diamondSvgHost) {
      return;
    }
    diamondChartInitialized = true;

    try {
      diamondSvgHost.innerHTML = diamondChartSvg;
      const svgRoot = $("svg", diamondSvgHost);
      if (!svgRoot) {
        throw new Error("SVG диаграммы не найден в шаблоне");
      }

      cleanupDiamondSvg(svgRoot);
      createDiamondHotspots(svgRoot);

      if (diamondPointEntries.length) {
        activateDiamondEntry(diamondPointEntries[0], false);
      }
    } catch (_) {
      diamondSvgHost.innerHTML = "<img src='/assets/chart.svg' alt='Диаграмма ИКС'>";
    }

    iksAxisItems.forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        const key = item.dataset.key || "";
        activateDiamondByKey(key, true);
      });

      item.addEventListener("focus", function () {
        const key = item.dataset.key || "";
        activateDiamondByKey(key, true);
      });

      item.addEventListener("click", function () {
        const key = item.dataset.key || "";
        activateDiamondByKey(key, true);
      });

      item.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        const key = item.dataset.key || "";
        activateDiamondByKey(key, true);
      });
    });

    window.addEventListener("scroll", hideDiamondTooltip, { passive: true });
    window.addEventListener("resize", function () {
      if (activeDiamondPoint && diamondTooltip && !diamondTooltip.hidden) {
        positionDiamondTooltip(activeDiamondPoint);
      }
    });

    document.addEventListener("pointerdown", function (event) {
      if (!diamondChart.contains(event.target) && diamondTooltip && !diamondTooltip.hidden) {
        hideDiamondTooltip();
      }
    });
  }

  function queueDiamondChartInit() {
    if (!diamondChart || diamondChartInitialized) {
      return;
    }

    if (typeof window.IntersectionObserver !== "function") {
      initDiamondChart();
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        const isVisible = entries.some(function (entry) {
          return entry.isIntersecting;
        });
        if (!isVisible) {
          return;
        }
        initDiamondChart();
        observer.disconnect();
      },
      { root: null, rootMargin: "320px 0px", threshold: 0.01 }
    );

    observer.observe(diamondChart);
  }

  const expertPhotos = [
    "/assets/expert-1.jpg",
    "/assets/expert-2.jpg",
    "/assets/expert-3.jpg",
    "/assets/expert-4.jpg"
  ];

  let activeExpertPhotoIndex = 0;
  const EXPERT_AUTOPLAY_DELAY = 6000;
  let expertGalleryReady = false;
  const preloadedExpertSources = new Set();

  function normalizeExpertIndex(index) {
    const size = expertPhotos.length;
    if (!size) {
      return 0;
    }
    return ((index % size) + size) % size;
  }

  function preloadExpertPhoto(index) {
    const safeIndex = normalizeExpertIndex(index);
    const source = expertPhotos[safeIndex];
    if (!source || preloadedExpertSources.has(source)) {
      return;
    }

    const img = new Image();
    img.decoding = "async";
    img.src = source;
    preloadedExpertSources.add(source);
  }

  function paintExpertThumbs(activeIndex) {
    if (!expertThumbs.length) {
      return;
    }

    const hasVisibleThumbs = expertThumbs.some(function (thumb) {
      return window.getComputedStyle(thumb).display !== "none";
    });

    expertThumbs.forEach(function (thumb, thumbIndex) {
      thumb.classList.toggle("is-active", thumbIndex === activeIndex);
      if (hasVisibleThumbs && !thumb.style.backgroundImage) {
        thumb.style.backgroundImage = "url('" + expertPhotos[thumbIndex] + "')";
      }
    });
  }

  function setExpertPhoto(index) {
    if (!expertMainPhoto || !expertPhotos.length) {
      return;
    }

    const safeIndex = normalizeExpertIndex(index);
    activeExpertPhotoIndex = safeIndex;

    expertMainPhoto.style.opacity = "0";
    setTimeout(function () {
      expertMainPhoto.style.backgroundImage = "url('" + expertPhotos[safeIndex] + "')";
      expertMainPhoto.style.opacity = "1";
    }, 120);

    paintExpertThumbs(safeIndex);
    preloadExpertPhoto(safeIndex + 1);
    preloadExpertPhoto(safeIndex - 1);

    if (expertPhotoCurrent) {
      expertPhotoCurrent.textContent = String(safeIndex + 1).padStart(2, "0");
    }
  }

  function stopExpertAutoTimer() {
    if (!expertAutoTimer) {
      return;
    }
    clearInterval(expertAutoTimer);
    expertAutoTimer = null;
  }

  function startExpertAutoTimer() {
    if (!expertGalleryReady || !expertMainPhoto || expertPhotos.length < 2 || expertAutoTimer) {
      return;
    }

    expertAutoTimer = setInterval(function () {
      if (document.hidden) {
        return;
      }
      setExpertPhoto(activeExpertPhotoIndex + 1);
    }, EXPERT_AUTOPLAY_DELAY);
  }

  function restartExpertAutoTimer() {
    stopExpertAutoTimer();
    startExpertAutoTimer();
  }

  expertThumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      const index = Number.parseInt(thumb.dataset.index || "0", 10);
      setExpertPhoto(index);
      restartExpertAutoTimer();
    });
  });

  if (expertPrevBtn) {
    expertPrevBtn.addEventListener("click", function () {
      setExpertPhoto(activeExpertPhotoIndex - 1);
      restartExpertAutoTimer();
    });
  }

  if (expertNextBtn) {
    expertNextBtn.addEventListener("click", function () {
      setExpertPhoto(activeExpertPhotoIndex + 1);
      restartExpertAutoTimer();
    });
  }

  if (expertMainPhoto) {
    expertMainPhoto.addEventListener("mouseenter", stopExpertAutoTimer);
    expertMainPhoto.addEventListener("mouseleave", startExpertAutoTimer);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopExpertAutoTimer();
      return;
    }
    startExpertAutoTimer();
  });

  function initExpertGallery() {
    if (expertGalleryReady || !expertMainPhoto || !expertPhotos.length) {
      return;
    }

    expertGalleryReady = true;
    setExpertPhoto(0);
    startExpertAutoTimer();
  }

  if (expertSection && typeof window.IntersectionObserver === "function") {
    const expertObserver = new IntersectionObserver(
      function (entries) {
        const isVisible = entries.some(function (entry) {
          return entry.isIntersecting;
        });

        if (!isVisible) {
          return;
        }

        initExpertGallery();
        expertObserver.disconnect();
      },
      { root: null, rootMargin: "300px 0px", threshold: 0.01 }
    );

    expertObserver.observe(expertSection);
  } else {
    initExpertGallery();
  }

  const expertMobileFlowQuery = window.matchMedia("(max-width: 600px)");
  const expertMediaOriginalParent = expertResetMedia ? expertResetMedia.parentElement : null;
  const expertMediaOriginalNext = expertResetMedia ? expertResetMedia.nextElementSibling : null;

  function syncExpertMobileFlow() {
    if (!expertReset || !expertResetMedia || !expertCopyCore || !expertMediaOriginalParent) {
      return;
    }

    if (expertMobileFlowQuery.matches) {
      if (expertResetMedia.parentElement !== expertCopyCore) {
        if (expertBrief && expertBrief.parentElement === expertCopyCore) {
          expertCopyCore.insertBefore(expertResetMedia, expertBrief);
        } else {
          expertCopyCore.appendChild(expertResetMedia);
        }
      }
      expertReset.classList.add("is-mobile-flow");
      return;
    }

    if (expertResetMedia.parentElement !== expertMediaOriginalParent) {
      if (expertMediaOriginalNext && expertMediaOriginalNext.parentElement === expertMediaOriginalParent) {
        expertMediaOriginalParent.insertBefore(expertResetMedia, expertMediaOriginalNext);
      } else {
        expertMediaOriginalParent.appendChild(expertResetMedia);
      }
    }
    expertReset.classList.remove("is-mobile-flow");
  }

  syncExpertMobileFlow();

  if (typeof expertMobileFlowQuery.addEventListener === "function") {
    expertMobileFlowQuery.addEventListener("change", syncExpertMobileFlow);
  } else if (typeof expertMobileFlowQuery.addListener === "function") {
    expertMobileFlowQuery.addListener(syncExpertMobileFlow);
  }

  function openModal(modalId) {
    const targetModal = $(".modal[data-modal-id='" + modalId + "']");
    if (!targetModal) {
      return;
    }

    setMenuState(false);

    modals.forEach(function (modal) {
      modal.hidden = true;
      modal.classList.remove("is-open");
    });

    modalLayer.classList.add("is-open");
    modalLayer.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    targetModal.hidden = false;
    requestAnimationFrame(function () {
      targetModal.classList.add("is-open");
      const closeButton = $(".modal-close", targetModal);
      if (closeButton) {
        closeButton.focus();
      }
    });

    activeModal = targetModal;
    syncHeaderVisualState();

    if (modalId === "test") {
      initTest();
    }

    animateBars(targetModal);
  }

  function closeModal() {
    if (!activeModal) {
      return;
    }

    const closingModal = activeModal;
    closingModal.classList.remove("is-open");

    setTimeout(function () {
      closingModal.hidden = true;
    }, 350);

    activeModal = null;
    modalLayer.classList.remove("is-open");
    modalLayer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    syncHeaderVisualState();
  }

  $$("[data-modal]").forEach(function (opener) {
    opener.addEventListener("click", function (event) {
      event.preventDefault();
      const modalId = opener.getAttribute("data-modal");
      if (modalId) {
        openModal(modalId);
      }
    });
  });

  $$(".modal-close").forEach(function (closeButton) {
    closeButton.addEventListener("click", closeModal);
  });

  modalOverlay.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    if (activeModal) {
      closeModal();
      return;
    }

    if (menuDrawer.classList.contains("is-open")) {
      setMenuState(false);
    }
  });

  const testQuestions = [
    {
      title: "Где чаще всего возникают разрывы?",
      options: [
        { text: "Между руководителями и командами", score: 3 },
        { text: "Между подразделениями", score: 2 },
        { text: "Внутри одной команды", score: 1 },
        { text: "Разрывов почти нет", score: 0 }
      ]
    },
    {
      title: "Как быстро решения доходят до исполнения?",
      options: [
        { text: "Слишком долго", score: 3 },
        { text: "С переменным успехом", score: 2 },
        { text: "Обычно в срок", score: 1 },
        { text: "Почти сразу", score: 0 }
      ]
    },
    {
      title: "Как команда реагирует на новые инициативы?",
      options: [
        { text: "Сопротивление и усталость", score: 3 },
        { text: "Поддержка частично", score: 2 },
        { text: "Скорее поддержка", score: 1 },
        { text: "Высокая вовлеченность", score: 0 }
      ]
    },
    {
      title: "Насколько системно вы управляете коммуникациями?",
      options: [
        { text: "Стихийно и по ситуации", score: 3 },
        { text: "Есть отдельные элементы", score: 2 },
        { text: "Есть рабочая модель", score: 1 },
        { text: "Есть зрелая система", score: 0 }
      ]
    }
  ];

  const testState = {
    index: 0,
    answers: []
  };

  function renderTestQuestion() {
    const question = testQuestions[testState.index];
    const selected = testState.answers[testState.index];

    const progress = ((testState.index + 1) / testQuestions.length) * 100;
    testProgressBar.style.width = String(progress) + "%";

    testQuestionWrap.innerHTML = "";

    const title = document.createElement("p");
    title.className = "test-question";
    title.textContent = question.title;

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "test-options";

    question.options.forEach(function (option, optionIndex) {
      const optionButton = document.createElement("button");
      optionButton.className = "test-option" + (selected === optionIndex ? " is-selected" : "");
      optionButton.textContent = option.text;
      optionButton.type = "button";
      optionButton.addEventListener("click", function () {
        testState.answers[testState.index] = optionIndex;
        renderTestQuestion();
      });
      optionsWrap.appendChild(optionButton);
    });

    testQuestionWrap.appendChild(title);
    testQuestionWrap.appendChild(optionsWrap);

    testBackBtn.disabled = testState.index === 0;
    testNextBtn.disabled = typeof selected !== "number";
    testNextBtn.textContent = testState.index === testQuestions.length - 1 ? "Показать результат" : "Далее";
  }

  function renderTestResult() {
    const totalScore = testState.answers.reduce(function (sum, optionIndex, questionIndex) {
      const score = testQuestions[questionIndex].options[optionIndex].score;
      return sum + score;
    }, 0);

    let recommendation = "Управленческая сессия (2–4 часа)";
    if (totalScore >= 5 && totalScore <= 8) {
      recommendation = "Форсайт-сессия (1–2 дня)";
    }
    if (totalScore > 8) {
      recommendation = "Акселерация (1–12 месяцев)";
    }

    testQuestionWrap.hidden = true;
    testResult.hidden = false;
    testResult.innerHTML = "<h4>Результат готов</h4><p>Рекомендуемый формат: <strong>" + recommendation + "</strong></p><p>Итоговый балл: " + totalScore + " из 12.</p>";

    const cta = document.createElement("button");
    cta.className = "btn btn-primary";
    cta.textContent = "Обсудить сессию";
    cta.type = "button";
    cta.addEventListener("click", function () {
      closeModal();
      setTimeout(function () {
        scrollToTarget("#contacts");
      }, 220);
    });

    testResult.appendChild(cta);
    testBackBtn.style.display = "none";
    testNextBtn.style.display = "none";
  }

  function initTest() {
    testState.index = 0;
    testState.answers = [];

    testQuestionWrap.hidden = false;
    testResult.hidden = true;
    testResult.innerHTML = "";

    testBackBtn.style.display = "inline-flex";
    testNextBtn.style.display = "inline-flex";

    renderTestQuestion();
  }

  testBackBtn.addEventListener("click", function () {
    if (testState.index <= 0) {
      return;
    }
    testState.index -= 1;
    renderTestQuestion();
  });

  testNextBtn.addEventListener("click", function () {
    const selected = testState.answers[testState.index];
    if (typeof selected !== "number") {
      return;
    }

    if (testState.index === testQuestions.length - 1) {
      renderTestResult();
      return;
    }

    testState.index += 1;
    renderTestQuestion();
  });

  function initTrustedNetwork() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    if (!trustedNetwork || !trustedNetworkCanvas || !trustedNetworkNodes.length) {
      return;
    }

    const context = trustedNetworkCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let rafId = 0;
    let nodes = [];

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function readNodes() {
      nodes = trustedNetworkNodes.map(function (node, index) {
        const rawX = Number.parseFloat(node.dataset.x || "");
        const rawY = Number.parseFloat(node.dataset.y || "");
        const rawRange = Number.parseFloat(node.dataset.range || "36");
        return {
          el: node,
          anchorX: Number.isFinite(rawX) ? rawX / 100 : (index + 1) / (trustedNetworkNodes.length + 1),
          anchorY: Number.isFinite(rawY) ? rawY / 100 : 0.5,
          range: Number.isFinite(rawRange) ? rawRange : 36,
          speedX: 0.25 + Math.random() * 0.32,
          speedY: 0.21 + Math.random() * 0.29,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          wobbleX: 0.85 + Math.random() * 0.5,
          wobbleY: 0.8 + Math.random() * 0.5,
          x: 0,
          y: 0
        };
      });
    }

    function resizeCanvas() {
      const rect = trustedNetwork.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      trustedNetworkCanvas.width = Math.round(width * dpr);
      trustedNetworkCanvas.height = Math.round(height * dpr);
      trustedNetworkCanvas.style.width = Math.round(width) + "px";
      trustedNetworkCanvas.style.height = Math.round(height) + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function updateNodePositions(now, staticMode) {
      const time = now / 1000;
      const padX = Math.max(34, width * 0.05);
      const padY = Math.max(30, height * 0.07);

      nodes.forEach(function (node) {
        const baseX = node.anchorX * width;
        const baseY = node.anchorY * height;
        const range = staticMode ? 0 : node.range;
        const waveX =
          Math.sin(time * node.speedX + node.phaseX) * range * node.wobbleX +
          Math.sin(time * (node.speedX * 0.47) + node.phaseY) * range * 0.34;
        const waveY =
          Math.cos(time * node.speedY + node.phaseY) * range * node.wobbleY +
          Math.sin(time * (node.speedY * 0.6) + node.phaseX) * range * 0.3;

        node.x = clamp(baseX + waveX, padX, width - padX);
        node.y = clamp(baseY + waveY, padY, height - padY);
        node.el.style.transform = "translate(" + node.x.toFixed(2) + "px, " + node.y.toFixed(2) + "px) translate(-50%, -50%)";
      });
    }

    function drawNetwork() {
      context.clearRect(0, 0, width, height);

      if (nodes.length < 2) {
        return;
      }

      const maxDist = Math.max(152, Math.min(248, Math.min(width, height) * 0.64));

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const source = nodes[i];
          const target = nodes[j];
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.hypot(dx, dy);
          if (dist > maxDist) {
            continue;
          }

          const ratio = 1 - dist / maxDist;
          const alpha = 0.12 + Math.pow(ratio, 1.45) * 0.38;

          context.beginPath();
          context.moveTo(source.x, source.y);
          context.lineTo(target.x, target.y);
          context.lineWidth = 0.8 + ratio * 0.9;
          context.strokeStyle = "rgba(151, 196, 250, " + alpha.toFixed(4) + ")";
          context.stroke();
        }
      }

      nodes.forEach(function (node) {
        context.beginPath();
        context.arc(node.x, node.y, 2.4, 0, Math.PI * 2);
        context.fillStyle = "rgba(174, 221, 255, 0.72)";
        context.fill();

        context.beginPath();
        context.arc(node.x, node.y, 6.8, 0, Math.PI * 2);
        context.fillStyle = "rgba(174, 221, 255, 0.09)";
        context.fill();
      });
    }

    function stopAnimation() {
      if (!rafId) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function animateFrame(now) {
      updateNodePositions(now, false);
      drawNetwork();
      rafId = requestAnimationFrame(animateFrame);
    }

    function renderStatic() {
      updateNodePositions(performance.now(), true);
      drawNetwork();
    }

    function startAnimation() {
      stopAnimation();
      if (reducedMotionQuery.matches) {
        renderStatic();
        return;
      }
      rafId = requestAnimationFrame(animateFrame);
    }

    function refreshNetwork() {
      resizeCanvas();
      readNodes();
      startAnimation();
    }

    refreshNetwork();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(refreshNetwork);
      observer.observe(trustedNetwork);
    } else {
      window.addEventListener("resize", refreshNetwork);
    }

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", startAnimation);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(startAnimation);
    }
  }

  function queueTrustedNetworkInit() {
    if (trustedNetworkInitialized) {
      return;
    }

    const shouldSkipObserver =
      !trustedNetwork ||
      typeof window.IntersectionObserver !== "function" ||
      window.matchMedia("(max-width: 900px)").matches;

    if (shouldSkipObserver) {
      trustedNetworkInitialized = true;
      initTrustedNetwork();
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        const isVisible = entries.some(function (entry) {
          return entry.isIntersecting;
        });
        if (!isVisible) {
          return;
        }
        trustedNetworkInitialized = true;
        initTrustedNetwork();
        observer.disconnect();
      },
      { root: null, rootMargin: "360px 0px", threshold: 0.01 }
    );

    observer.observe(trustedNetwork);
  }

  const contactForm = $("#contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const submitBtn = $("button[type='submit']", contactForm);
      submitBtn.textContent = "Отправлено";
      submitBtn.disabled = true;
      setTimeout(function () {
        submitBtn.textContent = "Отправить";
        submitBtn.disabled = false;
        contactForm.reset();
      }, 1600);
    });
  }

  initHeroBackgrounds();
  renderHeroDots();
  goToSlide(0);
  startHeroTimer();
  warmupHeroSlides();
  queueDiamondChartInit();
  queueTrustedNetworkInit();
  syncHeaderVisualState();
}
