(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const siteHeader = $("#siteHeader");
  const menuToggle = $("#menuToggle");
  const menuClose = $("#menuClose");
  const menuDrawer = $("#menuDrawer");
  const drawerOverlay = $("#drawerOverlay");

  const heroSection = $("#hero");
  const heroSlides = $$(".hero-slide");
  const heroDotsWrap = $("#heroDots");
  const prevSlideBtn = $("#prevSlide");
  const nextSlideBtn = $("#nextSlide");

  const toggleCasesBtn = $("#toggleCases");
  const casesGrid = $("#casesGrid");

  const videoWrap = $("#videoWrap");
  const msVideo = $("#msVideo");
  const videoPlaceholder = $("#videoPlaceholder");
  const videoPlayBtn = $("#videoPlay");

  const modalLayer = $("#modalLayer");
  const modalOverlay = $("#modalOverlay");
  const modals = $$(".modal");

  const expertMainPhoto = $("#expertMainPhoto");
  const expertThumbs = $$(".thumb", $("#expertThumbs"));

  const diamondChart = $("#diamondChart");
  const diamondPoints = $$(".point", diamondChart || document);
  const diamondTooltip = $("#diamondTooltip");

  const testQuestionWrap = $("#testQuestionWrap");
  const testProgressBar = $("#testProgressBar");
  const testNextBtn = $("#testNext");
  const testBackBtn = $("#testBack");
  const testResult = $("#testResult");

  let activeModal = null;
  let heroIndex = 0;
  let heroTimer = null;
  let isHeroPaused = false;

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
  }

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
    "https://picsum.photos/seed/artcomm-1/1920/1200",
    "https://picsum.photos/seed/artcomm-2/1920/1200",
    "https://picsum.photos/seed/artcomm-3/1920/1200",
    "https://picsum.photos/seed/artcomm-4/1920/1200",
    "https://picsum.photos/seed/artcomm-5/1920/1200",
    "https://picsum.photos/seed/artcomm-6/1920/1200",
    "https://picsum.photos/seed/artcomm-7/1920/1200"
  ];

  function pickRandom(except) {
    let pick = photoPool[Math.floor(Math.random() * photoPool.length)];
    if (except && photoPool.length > 1) {
      while (pick === except) {
        pick = photoPool[Math.floor(Math.random() * photoPool.length)];
      }
    }
    return pick;
  }

  function initHeroBackgrounds() {
    if (!heroSlides.length) {
      return;
    }

    const firstImage = pickRandom();
    const thirdImage = pickRandom(firstImage);

    heroSlides[0].style.backgroundImage = "url('" + firstImage + "')";
    heroSlides[1].style.backgroundImage = "url('https://picsum.photos/seed/artcomm-main/1920/1200')";
    heroSlides[2].style.backgroundImage = "url('" + thirdImage + "')";
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
    heroIndex = (nextIndex + heroSlides.length) % heroSlides.length;

    heroSlides.forEach(function (slide, index) {
      slide.classList.toggle("is-active", index === heroIndex);
    });

    $$("button", heroDotsWrap).forEach(function (dot, index) {
      dot.classList.toggle("is-active", index === heroIndex);
    });
  }

  function startHeroTimer() {
    if (heroTimer || isHeroPaused) {
      return;
    }
    heroTimer = setInterval(function () {
      goToSlide(heroIndex + 1);
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

  heroSection.addEventListener("mouseenter", function () {
    isHeroPaused = true;
    stopHeroTimer();
  });

  heroSection.addEventListener("mouseleave", function () {
    isHeroPaused = false;
    startHeroTimer();
  });

  if (toggleCasesBtn && casesGrid) {
    toggleCasesBtn.addEventListener("click", function () {
      const isHidden = casesGrid.hasAttribute("hidden");
      if (isHidden) {
        casesGrid.removeAttribute("hidden");
      } else {
        casesGrid.setAttribute("hidden", "");
      }
    });
  }

  function hasVideoSource(video) {
    if (!video) {
      return false;
    }
    return Boolean(video.currentSrc || video.src || $("source", video));
  }

  function tryPlayVideo() {
    if (!msVideo || !hasVideoSource(msVideo)) {
      return;
    }

    msVideo.muted = true;
    msVideo.playsInline = true;
    const attempt = msVideo.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () {
        // Автоплей может быть заблокирован браузером
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
      if (!hasVideoSource(msVideo)) {
        videoPlaceholder.querySelector("p").textContent = "Добавьте видеофайл заказчика в тег <video>, чтобы включить показ.";
        return;
      }
      tryPlayVideo();
      videoPlaceholder.style.display = "none";
      msVideo.setAttribute("controls", "");
    });
  }

  if (msVideo) {
    msVideo.addEventListener("playing", function () {
      videoPlaceholder.style.display = "none";
    });
  }

  const revealItems = $$("[data-reveal]");
  revealItems.forEach(function (item, index) {
    item.style.transitionDelay = String((index % 8) * 100) + "ms";
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

    const duration = 1000;
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
        tryPlayVideo();
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

  function showDiamondTooltip(point, event) {
    if (!diamondTooltip || !diamondChart) {
      return;
    }

    const key = point.dataset.key || "Параметр";
    const city = point.dataset.city || "0";
    const avg = point.dataset.avg || "0";
    diamondTooltip.innerHTML = "<strong>" + key + "</strong><br>Город: " + city + "<br>Среднее: " + avg;

    const cardRect = diamondChart.getBoundingClientRect();
    const x = event.clientX - cardRect.left + 12;
    const y = event.clientY - cardRect.top + 12;

    diamondTooltip.style.left = String(Math.min(x, cardRect.width - 190)) + "px";
    diamondTooltip.style.top = String(Math.min(y, cardRect.height - 88)) + "px";
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
    setTimeout(function () {
      diamondTooltip.hidden = true;
    }, 160);
  }

  diamondPoints.forEach(function (point) {
    point.addEventListener("mouseenter", function (event) {
      point.classList.add("is-hover");
      showDiamondTooltip(point, event);
    });

    point.addEventListener("mousemove", function (event) {
      showDiamondTooltip(point, event);
    });

    point.addEventListener("mouseleave", function () {
      point.classList.remove("is-hover");
      hideDiamondTooltip();
    });
  });

  const expertPhotos = [
    "https://picsum.photos/seed/roman-main/900/1200",
    "https://picsum.photos/seed/roman-2/900/1200",
    "https://picsum.photos/seed/roman-3/900/1200",
    "https://picsum.photos/seed/roman-4/900/1200"
  ];

  function setExpertPhoto(index) {
    const safeIndex = Math.max(0, Math.min(expertPhotos.length - 1, index));

    expertMainPhoto.style.opacity = "0";
    setTimeout(function () {
      expertMainPhoto.style.backgroundImage = "url('" + expertPhotos[safeIndex] + "')";
      expertMainPhoto.style.opacity = "1";
    }, 120);

    expertThumbs.forEach(function (thumb, thumbIndex) {
      thumb.classList.toggle("is-active", thumbIndex === safeIndex);
      thumb.style.backgroundImage = "url('" + expertPhotos[thumbIndex] + "')";
    });
  }

  expertThumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      const index = Number.parseInt(thumb.dataset.index || "0", 10);
      setExpertPhoto(index);
    });
  });

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
  setExpertPhoto(0);
})();
