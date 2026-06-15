const homeMarkup = String.raw`
  <a class="skip-link" href="#mainContent">Перейти к содержанию</a>

  <header class="site-header" id="siteHeader">
    <div class="container header-inner">
      <a href="#hero" class="logo" aria-label="На главный экран">
        <img class="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true">
        <div class="logo-copy">
          <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
          <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
        </div>
      </a>
      <div class="header-actions">
        <button class="btn btn-primary" data-scroll="#contacts">Связаться</button>
        <button class="icon-btn menu-toggle" id="menuToggle" aria-label="Открыть меню" aria-expanded="false" aria-controls="menuDrawer">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <line x1="4" y1="7" x2="20" y2="7"></line>
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="17" x2="20" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <div class="drawer-overlay" id="drawerOverlay"></div>
  <aside class="menu-drawer" id="menuDrawer" aria-hidden="true">
    <div class="drawer-head">
      <strong>Меню</strong>
      <button class="icon-btn" id="menuClose" aria-label="Закрыть меню">×</button>
    </div>
    <nav class="drawer-nav">
      <a href="/">Главная страница</a>
      <a href="/test">Тест</a>
      <a href="#ms" data-scroll="#ms">Наши проекты</a>
      <a href="/?modal=formats" data-modal="formats">Форматы работы</a>
      <a href="#expert" data-scroll="#expert">Наши эксперты</a>
      <button data-scroll="#contacts">Контакты</button>
      <a href="/about">Сведения об организации</a>
    </nav>
  </aside>

  <main id="mainContent">
    <section id="hero" class="hero">
      <div class="hero-slides" id="heroSlides">
        <div class="hero-slide is-active" data-slide="0" role="img" aria-label="Фоновое фото института"></div>
        <div class="hero-slide" data-slide="1" role="img" aria-label="Фоновое фото проекта"></div>
        <div class="hero-slide" data-slide="2" role="img" aria-label="Фоновое фото команды"></div>
        <div class="hero-slide" data-slide="3" role="img" aria-label="Фоновое фото сессии"></div>
        <div class="hero-slide" data-slide="4" role="img" aria-label="Фоновое фото аудитории"></div>
      </div>

      <button class="hero-arrow prev" id="prevSlide" aria-label="Предыдущий слайд">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.5 5.5L8 12l6.5 6.5"></path>
        </svg>
      </button>
      <button class="hero-arrow next" id="nextSlide" aria-label="Следующий слайд">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.5 5.5L16 12l-6.5 6.5"></path>
        </svg>
      </button>

      <div class="container hero-content" data-reveal>
        <div class="hero-main">
          <p class="hero-kicker">Институт «АртКомм»</p>
          <h1>Повышаем управляемость команд через коммуникации</h1>
          <p class="hero-quote">«Проблема не в людях, а в связях между ними»</p>
        </div>
      </div>

      <div class="hero-dots" id="heroDots" aria-label="Индикаторы слайдов"></div>
    </section>

    <section class="common section-pale" id="common">
      <div id="commin" aria-hidden="true"></div>
      <div class="container common-redo">
        <div class="common-redo-grid">
          <div class="common-redo-left">
            <div class="common-drum-stage" id="commonDrumStage" aria-label="Проблематика управленческих команд">
              <div class="common-drum-sticky">
                <header class="section-head common-redo-head" data-reveal>
                  <p class="section-kicker">Ты из корпорации или органа власти?</p>
                  <h2>Знакомо? Болит? Тревожит?</h2>
                </header>

                <div class="common-drum-stack" id="commonDrumStack">
                  <article class="common-drum-item pain-redo" data-drum-index="0">
                    <span class="pain-redo-icon" aria-hidden="true">›</span>
                    <div class="pain-redo-copy">
                      <h3>Сильная команда — слабая управляемость</h3>
                      <p>Решения есть, но теряются на стыках подразделений.</p>
                    </div>
                  </article>
                  <article class="common-drum-item pain-redo" data-drum-index="1">
                    <span class="pain-redo-icon" aria-hidden="true">›</span>
                    <div class="pain-redo-copy">
                      <h3>Разрывы во взаимодействии</h3>
                      <p>Информация передаётся медленно и искажается по пути.</p>
                    </div>
                  </article>
                  <article class="common-drum-item pain-redo" data-drum-index="2">
                    <span class="pain-redo-icon" aria-hidden="true">›</span>
                    <div class="pain-redo-copy">
                      <h3>Руководителя слушают, но не слышат</h3>
                      <p>Сигнал сверху не превращается в действия на местах.</p>
                    </div>
                  </article>
                  <article class="common-drum-item pain-redo" data-drum-index="3">
                    <span class="pain-redo-icon" aria-hidden="true">›</span>
                    <div class="pain-redo-copy">
                      <h3>Есть идеи — мало системных проектов</h3>
                      <p>Потенциал сотрудников не превращается в устойчивый результат.</p>
                    </div>
                  </article>
                </div>

                <div class="common-drum-arrow" id="commonDrumArrow" aria-hidden="true">
                  <img class="common-drum-arrow-base" src="/assets/Group%2089.svg" alt="">
                  <div class="common-drum-arrow-fill">
                    <img src="/assets/Group%2089.svg" alt="">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside class="common-redo-cta">
            <svg class="common-redo-divider" viewBox="-2 0 262 1000" preserveAspectRatio="none" aria-hidden="true">
              <path d="M-2 0 H250 C156 94 130 226 182 344 C236 468 236 532 182 656 C130 774 156 906 250 1000 H-2 Z"></path>
            </svg>
            <div class="common-redo-cta-inner">
              <div class="common-redo-cta-copy">
                <p class="common-redo-kicker">Системный подход</p>
                <h3 class="common-redo-title">
                  <span>Переведём коммуникации</span>
                  <span>в управляемую систему</span>
                </h3>
                <p class="common-redo-cta-text">
                  <span>Покажем, где команда теряет скорость,</span>
                  <span>и соберём рабочую архитектуру взаимодействия.</span>
                </p>
              </div>
              <div class="common-cta-men" id="commonCtaMen" aria-hidden="true">
                <img src="/assets/Group.svg" alt="">
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="ms section-deep" id="ms">
      <div class="container ms-intro" data-reveal>
        <p class="section-kicker">Флагманский проект</p>
        <h2>«МедиаСтанция»</h2>
        <p class="section-sub">Практика, где коммуникация становится рабочим инструментом управления командами.</p>
      </div>

      <div class="ms-pin-shell" id="msPinShell">
        <article class="ms-video-stage" id="videoWrap">
          <div class="ms-video-toolbar">
            <span>Видео проекта</span>
            <button class="btn btn-secondary ms-sound-toggle" id="msSoundToggle" type="button">Включить звук</button>
          </div>
          <video id="msVideo" playsinline webkit-playsinline muted loop autoplay preload="metadata" poster="/assets/ms-video-poster.jpg" aria-label="Видео о формате МедиаСтанции">
            <source data-src="/assets/gimn-ed-zy9mar.mp4" data-local-src="/assets/gimn-ed-zy9mar.mp4" data-fallback-src="/assets/gimn-ed-zy9mar.mp4" type="video/mp4">
          </video>
          <div class="video-placeholder" id="videoPlaceholder">
            <button class="play-btn" id="videoPlay" aria-label="Запустить видео">▶</button>
            <p>Нажмите Play, если автозапуск не сработал.</p>
          </div>
          <p class="ms-video-caption">«Сенсация» — о форматах работы, от онлайна к офлайну.</p>
        </article>
      </div>

      <div class="container ms-story">
        <article class="ms-story-lead" data-reveal>
          <h3>Ускоряем рабочие договорённости внутри больших распределённых команд</h3>
          <p>Собираем единый коммуникационный ритм для людей из разных городов и контуров управления.</p>
        </article>

        <section class="ms-metric-line" data-reveal>
          <div class="ms-metric-main">
            <span class="metric-value" data-counter="82.4" data-suffix="%">82,4%</span>
            <p>готовы назвать себя амбассадорами Росатома</p>
          </div>

          <div class="ms-stats-list">
            <article><strong data-counter="969">969</strong><span>участников</span></article>
            <article><strong data-counter="30">30</strong><span>городов</span></article>
            <article><strong data-counter="11">11</strong><span>часовых поясов</span></article>
            <article><strong data-counter="20" data-suffix=" млн">20 млн</strong><span>просмотров</span></article>
            <article><strong data-counter="5200">5 200</strong><span>медиапродуктов</span></article>
            <article><strong data-counter="76.9" data-suffix="%">76,9%</strong><span>вовлечённости</span></article>
          </div>
        </section>

        <section class="ms-loyalty-line" data-reveal>
          <p class="ms-loyalty-title">Динамика лояльности и командного контура</p>
          <div class="loyalty-grid" id="loyaltyBars">
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="82"></circle>
                </svg>
                <strong>82%</strong>
              </div>
              <p>Называю себя амбассадором</p>
            </article>
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="86"></circle>
                </svg>
                <strong>86%</strong>
              </div>
              <p>Стал увереннее размещать контент</p>
            </article>
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="92"></circle>
                </svg>
                <strong>92%</strong>
              </div>
              <p>Увеличилось кол-во связей</p>
            </article>
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="93"></circle>
                </svg>
                <strong>93%</strong>
              </div>
              <p>Быстрее договариваться</p>
            </article>
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="95"></circle>
                </svg>
                <strong>95%</strong>
              </div>
              <p>Проще решать проблемы</p>
            </article>
            <article class="loyalty-cell">
              <div class="loyalty-ring-wrap">
                <svg class="loyalty-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="ring-track" cx="60" cy="60" r="46"></circle>
                  <circle class="ring-progress" cx="60" cy="60" r="46" data-value="96"></circle>
                </svg>
                <strong>96%</strong>
              </div>
              <p>Ощущаем себя как команда</p>
            </article>
          </div>
        </section>

        <div class="ms-tail-minimal" data-reveal>
          <div class="stack-actions horizontal iks-actions ms-tail-actions">
            <button class="btn btn-primary" data-modal="ms-participants">Отзывы о МедиаСтанции</button>
          </div>
        </div>
      </div>
    </section>

    <section class="iks section-light" id="iks">
      <div class="container iks-reset">
        <header class="iks-reset-head" data-reveal>
          <p class="section-kicker">Методология</p>
          <h2>Индекс коммуникационной состоятельности</h2>
          <p>Переводим коммуникации из «ощущений» в управляемую систему, чтобы команда видела сильные стороны и точки ускорения решений.</p>
        </header>

        <div class="iks-reset-stage">
          <article class="iks-reset-axis" data-reveal>
            <ul class="iks-axis-list iks-pillars">
              <li data-key="Организация и процессы" tabindex="0">
                <div>
                  <strong>Организация и процессы</strong>
                  <p>Насколько чётко распределены процессы, ответственность и ритм решений.</p>
                </div>
              </li>
              <li data-key="Компетенции и роли" tabindex="0">
                <div>
                  <strong>Компетенции и роли</strong>
                  <p>Готовность ролей к диалогу, фасилитации и управлению сложными стыками.</p>
                </div>
              </li>
              <li data-key="Контент и производство" tabindex="0">
                <div>
                  <strong>Контент и производство</strong>
                  <p>Качество смыслов и единый язык, который доходит до исполнения.</p>
                </div>
              </li>
              <li data-key="Охват и каналы" tabindex="0">
                <div>
                  <strong>Охват и каналы</strong>
                  <p>Плотность каналов и глубина включения команды в общий контур коммуникаций.</p>
                </div>
              </li>
            </ul>

          </article>

          <article class="iks-reset-chart" id="diamondChart" data-reveal>
            <div class="diamond-tooltip" id="diamondTooltip" role="status" aria-live="polite" hidden></div>
            <div class="diamond-svg-host" id="diamondSvgHost" aria-label="Диаграмма ИКС: коммуникационный алмаз"></div>
            <div class="iks-chart-meta">
              <div class="iks-chart-legend" aria-hidden="true">
                <span><i class="city-line"></i>Город (пример)</span>
                <span><i class="avg-line"></i>Среднее по городам</span>
              </div>
            </div>
          </article>
        </div>

        <div class="stack-actions horizontal iks-actions" data-reveal>
          <a class="btn btn-primary" href="/?modal=formats" data-modal="formats">Форматы работы</a>
          <a class="btn btn-secondary" href="/?modal=methodology" data-modal="methodology">Узнать методологию</a>
        </div>
      </div>
    </section>

    <section class="expert section-pale" id="expert">
      <div class="container expert-reset">
        <div class="expert-reset-media" data-reveal>
          <div class="gallery-main" id="expertMainPhoto" role="img" aria-label="Фото Романа Скуднякова">
            <div class="expert-photo-overlay">
              <p>Эксперт проекта</p>
              <strong>Роман Скудняков</strong>
            </div>
            <button class="expert-photo-arrow prev" id="expertPrev" aria-label="Предыдущее фото">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M14.5 5.5L8 12l6.5 6.5"></path>
              </svg>
            </button>
            <button class="expert-photo-arrow next" id="expertNext" aria-label="Следующее фото">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9.5 5.5L16 12l-6.5 6.5"></path>
              </svg>
            </button>
          </div>
          <div class="expert-photo-controls">
            <span class="expert-photo-caption">Фотогалерея эксперта</span>
            <span class="expert-photo-counter"><strong id="expertPhotoCurrent">01</strong><small>/ 04</small></span>
          </div>
          <div class="gallery-thumbs" id="expertThumbs" aria-hidden="true" hidden>
            <button class="thumb is-active" data-index="0" tabindex="-1"></button>
            <button class="thumb" data-index="1" tabindex="-1"></button>
            <button class="thumb" data-index="2" tabindex="-1"></button>
            <button class="thumb" data-index="3" tabindex="-1"></button>
          </div>
        </div>

        <article class="expert-reset-content" data-reveal>
          <div class="expert-copy-core">
            <p class="section-kicker">Наши эксперты</p>
            <h2>Роман Скудняков</h2>
            <p class="expert-lead-quote">«Управляемость команды начинается с того, как она разговаривает и как принимает решения».</p>
            <p class="expert-brief">Стратегический коммуникатор и модератор управленческих команд в сложных распределённых структурах.</p>

            <ul class="positions">
              <li>Ведёт стратегические и форсайт-сессии для руководителей и проектных офисов.</li>
              <li>Собирает единый контур договорённостей между подразделениями.</li>
              <li>Сопровождает команды от диагностики до внедрения решений.</li>
            </ul>
          </div>

          <div class="stack-actions horizontal expert-actions">
            <button class="btn btn-primary" data-modal="team">Команда Арткомм</button>
            <button class="btn btn-secondary" data-modal="awards">Профессиональные награды</button>
          </div>
        </article>
      </div>
    </section>

    <section class="contacts section-deep" id="contacts">
      <div class="container contacts-reset">
        <header class="contacts-head" data-reveal>
          <p class="section-kicker">Обратная связь</p>
          <h2>
            <span>Управление командой</span>
            <span>начинается с коммуникации</span>
          </h2>
        </header>

        <div class="contacts-stage">
          <article class="contacts-brief-card" data-reveal>
            <h3>Контакты</h3>
            <p class="contacts-brief-schedule-label">Режим работы</p>
            <p class="contacts-brief-schedule-value">пн-пт 9:00-18:00</p>
            <a class="contacts-brief-phone" href="tel:+79166920775">+7 (916) 692-07-75</a>
            <a class="contacts-brief-mail" href="mailto:info@artcommrf.ru">info@artcommrf.ru</a>
            <a class="contacts-brief-telegram" href="https://t.me" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>
            <a class="contacts-brief-telegram" href="https://max.ru" target="_blank" rel="noopener noreferrer">Написать в Max</a>
          </article>

          <article class="contacts-info-card" data-reveal>
            <article class="trusted-network-card is-standalone">
              <h3>Нам доверяют</h3>
              <p class="trusted-network-sub">Работаем более чем в 40 городах — от распределённых команд до отраслевых управленческих контуров.</p>

              <div class="trusted-network" id="trustedNetwork" aria-label="Партнёрская сеть">
                <canvas class="trusted-network-canvas" id="trustedNetworkCanvas" aria-hidden="true"></canvas>

                <span class="trusted-node node-rosatom" data-node data-x="13" data-y="16" data-range="42">
                  <img src="/assets/logos/rosatom.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">Росатом</span>
                </span>
                <span class="trusted-node node-znanie" data-node data-x="34" data-y="14" data-range="40">
                  <img src="/assets/logos/znanie.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">Знание</span>
                </span>
                <span class="trusted-node node-senezh" data-node data-x="56" data-y="22" data-range="38">
                  <img src="/assets/logos/senezh.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">Сенеж</span>
                </span>
                <span class="trusted-node node-asi" data-node data-x="79" data-y="18" data-range="44">
                  <img src="/assets/logos/asi.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">АСИ</span>
                </span>
                <span class="trusted-node node-vk" data-node data-x="20" data-y="52" data-range="36">
                  <img src="/assets/logos/vk.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">ВКонтакте</span>
                </span>
                <span class="trusted-node node-mgu" data-node data-x="45" data-y="58" data-range="40">
                  <img src="/assets/logos/mgu.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">МГУ</span>
                </span>
                <span class="trusted-node node-cirkon" data-node data-x="72" data-y="56" data-range="42">
                  <img src="/assets/logos/cirkon.png" alt="" aria-hidden="true" loading="lazy">
                  <span class="trusted-node-name">ЦИРКОН</span>
                </span>
              </div>

            </article>
          </article>

          <div class="contacts-reset-right" data-reveal>
            <form class="contact-form" id="contactForm">
              <h3>Написать нам</h3>
              <p class="contact-form-lead">Если у вас остались вопросы, оставьте свои контакты и мы свяжемся с вами.</p>

              <label class="contact-field">
                <input type="text" name="name" placeholder="Имя" required>
              </label>
              <label class="contact-field">
                <input type="email" name="contact" placeholder="Email" required autocomplete="email">
              </label>
              <label class="contact-field">
                <textarea name="message" rows="1" placeholder="Ваш вопрос" required></textarea>
              </label>
              <label class="contact-field contact-field-hp" aria-hidden="true">
                <input type="text" name="website" tabindex="-1" autocomplete="off">
              </label>

              <label class="contact-check">
                <input type="checkbox" name="policy" checked required>
                <span>Я согласен с условиями обработки <a href="/privacy" target="_blank" rel="noopener noreferrer">персональных данных</a></span>
              </label>

              <label class="contact-check">
                <input type="checkbox" name="newsletter">
                <span>Я соглашаюсь получать <a href="/privacy#marketing-consent" target="_blank" rel="noopener noreferrer">рекламную рассылку</a>.</span>
              </label>

              <button class="btn contact-form-submit" type="submit">Отправить</button>
              <p class="contact-form-status" id="contactFormStatus" role="status" aria-live="polite"></p>
            </form>
          </div>
        </div>
      </div>
    </section>

    <footer class="site-footer" id="siteFooter">
      <div class="container footer-shell">
        <div class="footer-grid" data-reveal>
          <section class="footer-col footer-col-main">
            <a href="#hero" class="footer-brand" aria-label="На главный экран">
              <div class="footer-brand-row">
                <img class="footer-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true">
                <strong>Институт «АртКомм»</strong>
              </div>
              <span>Коммуникации как инструмент управляемости и роста команд.</span>
            </a>
          </section>

          <section class="footer-col footer-col-docs">
            <div class="footer-subsection">
              <h3 class="footer-title">Документы</h3>
              <nav class="footer-links" aria-label="Документы">
                <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Устав организации</a>
                <a href="/assets/program-obrazovaniya-artkomm.pdf" target="_blank" rel="noopener noreferrer">Программа образования</a>
              </nav>
            </div>
            <div class="footer-subsection">
              <h3 class="footer-title">Контакты</h3>
              <div class="footer-links footer-links-contacts">
                <a href="mailto:info@artcommrf.ru">info@artcommrf.ru</a>
                <a href="tel:+79166920775">+7 (916) 692-07-75</a>
                <a href="https://t.me" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>
                <a href="https://max.ru" target="_blank" rel="noopener noreferrer">Написать в Max</a>
              </div>
            </div>
          </section>

          <section class="footer-col">
            <h3 class="footer-title">Навигация</h3>
            <nav class="footer-links" aria-label="Навигация по сайту">
              <a href="#hero" data-scroll="#hero">Главный экран</a>
              <a href="#common" data-scroll="#common">Проблематика</a>
              <a href="#ms" data-scroll="#ms">Наши проекты</a>
              <a href="#iks" data-scroll="#iks">Методология</a>
              <a href="#expert" data-scroll="#expert">Наши эксперты</a>
              <a href="#contacts" data-scroll="#contacts">Обратная связь</a>
            </nav>
          </section>
        </div>

        <div class="footer-bottom" data-reveal>
          <a class="footer-top-link" href="#hero" data-scroll="#hero">Наверх ↑</a>
        </div>
        <p class="footer-copy" data-reveal>© 2026 АНО «АртКомм». Все права защищены.</p>
      </div>
    </footer>
  </main>

  <div class="modal-layer" id="modalLayer" aria-hidden="true">
    <div class="modal-overlay" id="modalOverlay"></div>

    <article class="modal" data-modal-id="ms-participants" role="dialog" aria-modal="true" aria-labelledby="msParticipantsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="msParticipantsTitle">Отзывы о МедиаСтанции</h3>
      <div class="modal-review-list">
        <article class="modal-review-card">
          <div class="modal-review-media">
            <div class="modal-review-avatar-empty" aria-hidden="true">ОП</div>
          </div>
          <div class="modal-review-copy">
            <h4>Ольга Петрова</h4>
            <p class="modal-review-meta">Заместитель министра науки РФ</p>
            <p class="modal-review-text">«Формат МедиаСтанции показал, что работа с коммуникациями напрямую влияет на скорость реализации решений и качество командного взаимодействия.»</p>
          </div>
        </article>
        <article class="modal-review-card">
          <div class="modal-review-media">
            <div class="modal-review-avatar-empty" aria-hidden="true">ЕС</div>
          </div>
          <div class="modal-review-copy">
            <h4>Елена Светлова</h4>
            <p class="modal-review-meta">Озёрск</p>
            <p class="modal-review-text">«Я увидела, как командные договорённости становятся реальными действиями уже в первые недели.»</p>
          </div>
        </article>
        <article class="modal-review-card">
          <div class="modal-review-media">
            <div class="modal-review-avatar-empty" aria-hidden="true">УР</div>
          </div>
          <div class="modal-review-copy">
            <h4>Ульяна Реброва</h4>
            <p class="modal-review-meta">Полярные Зори</p>
            <p class="modal-review-text">«Проект дал нам язык, на котором можно обсуждать сложные задачи без конфликтов.»</p>
          </div>
        </article>
      </div>
    </article>

    <article class="modal" data-modal-id="diamond" role="dialog" aria-modal="true" aria-labelledby="diamondTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="diamondTitle">Коммуникационный алмаз</h3>
      <p>Алмаз показывает состояние системы по четырём осям: организация и процессы, компетенции и роли, контент и производство, охват и каналы. ИКС рассчитывается как суммарная оценка показателей: <strong>ИКС = ∑P[j]</strong>.</p>
      <p>Сравнение линии города со средним значением позволяет увидеть сильные стороны и зоны развития.</p>
    </article>

    <article class="modal" data-modal-id="sovereignty" role="dialog" aria-modal="true" aria-labelledby="sovereigntyTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="sovereigntyTitle">Суверенитет РФ</h3>
      <p>Коммуникационный суверенитет — это способность страны и регионов формировать устойчивые смыслы, процессы и каналы без критической внешней зависимости.</p>
      <ul>
        <li>Уровень 1: инфраструктура каналов и данных.</li>
        <li>Уровень 2: управленческие компетенции и роли.</li>
        <li>Уровень 3: культурная устойчивость смыслов.</li>
      </ul>
      <p class="modal-note">Цитаты экспертов уточняются с заказчиком.</p>
    </article>

    <article class="modal" data-modal-id="formats" role="dialog" aria-modal="true" aria-labelledby="formatsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="formatsTitle">Три формата — под любую задачу</h3>
      <p class="formats-modal-lead">Выбирайте глубину погружения: от одной сессии до системной трансформации на год</p>
      <div class="modal-grid format-showcase">
        <article class="format-showcase-card">
          <div class="format-showcase-top">
            <span class="format-showcase-index">01</span>
            <span class="format-showcase-duration">2–4 часа</span>
          </div>
          <div class="format-showcase-body">
            <h4>Управленческая сессия</h4>
            <p class="format-showcase-text">Практическая сессия для команды или руководителя. Работаем с конкретными задачами прямо в зале.</p>
            <div class="format-showcase-group">
              <span class="format-showcase-label">Внутри формата</span>
              <ul class="format-showcase-features">
                <li>Управление влиянием</li>
                <li>Управление командой</li>
                <li>Влияние руководителя</li>
              </ul>
            </div>
            <div class="format-showcase-result">
              <span class="format-showcase-label">Результат</span>
              <p>Команда уходит с готовыми инструментами и договорённостями. Эффект — уже на следующий день.</p>
            </div>
          </div>
        </article>
        <article class="format-showcase-card">
          <div class="format-showcase-top">
            <span class="format-showcase-index">02</span>
            <span class="format-showcase-duration">1–2 дня</span>
          </div>
          <div class="format-showcase-body">
            <h4>Проектная форсайт-сессия</h4>
            <p class="format-showcase-text">Стратегическая работа с командой по методологии Rapid Foresight. Переводим идеи в системные проекты.</p>
            <div class="format-showcase-group">
              <span class="format-showcase-label">Внутри формата</span>
              <ul class="format-showcase-features">
                <li>Управление идеями</li>
                <li>Пересборка взаимодействия</li>
                <li>Стратегическое планирование</li>
              </ul>
            </div>
            <div class="format-showcase-result">
              <span class="format-showcase-label">Результат</span>
              <p>Из разрозненных идей — конкретные проекты с командами, дорожными картами и ответственными.</p>
            </div>
          </div>
        </article>
        <article class="format-showcase-card">
          <div class="format-showcase-top">
            <span class="format-showcase-index">03</span>
            <span class="format-showcase-duration">1–12 месяцев</span>
          </div>
          <div class="format-showcase-body">
            <h4>Акселерация управления</h4>
            <p class="format-showcase-text">Системная трансформация коммуникаций внутри организации. Измеримый рост управляемости.</p>
            <div class="format-showcase-group">
              <span class="format-showcase-label">Внутри формата</span>
              <ul class="format-showcase-features">
                <li>Управление изменениями</li>
                <li>Диагностика системы</li>
                <li>Единый язык команды</li>
              </ul>
            </div>
            <div class="format-showcase-result">
              <span class="format-showcase-label">Результат</span>
              <p>Коммуникации переходят из «ощущений» в управляемую систему. Рост показателей зафиксирован и измерен.</p>
            </div>
          </div>
        </article>
      </div>
    </article>

    <article class="modal" data-modal-id="methodology" role="dialog" aria-modal="true" aria-labelledby="methodologyTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="methodologyTitle">Методология 5 шагов</h3>
      <ol class="timeline">
        <li>Диагностика</li>
        <li>Выявление разрывов</li>
        <li>Пересборка контуров взаимодействия</li>
        <li>Единый язык команды</li>
        <li>Фиксация результата</li>
      </ol>
    </article>

    <article class="modal" data-modal-id="team" role="dialog" aria-modal="true" aria-labelledby="teamTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="teamTitle">Команда Арткомм</h3>
      <div class="modal-grid team-grid">
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">ОП</div></div><div class="team-card-copy"><span>Ольга Парле</span><small>креативный директор</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">АР</div></div><div class="team-card-copy"><span>Анна Романычева</span><small>директор по аналитике</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">АФ</div></div><div class="team-card-copy"><span>Анастасия Филимонова</span><small>операционный руководитель проектов</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">АХ</div></div><div class="team-card-copy"><span>Альрам Хайретдинов</span><small>руководитель визуальных коммуникаций</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">ТК</div></div><div class="team-card-copy"><span>Туйаара Кычкина</span><small>эксперт по наставничеству</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">ПС</div></div><div class="team-card-copy"><span>Павел Скудняков</span><small>менеджер проектов</small></div></article>
        <article class="team-card"><div class="team-card-media"><div class="team-card-avatar-empty" aria-hidden="true">МП</div></div><div class="team-card-copy"><span>Мария Первушкина</span><small>эксперт по SMM аналитике</small></div></article>
      </div>
    </article>

    <article class="modal" data-modal-id="awards" role="dialog" aria-modal="true" aria-labelledby="awardsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="awardsTitle">Профессиональные награды</h3>
      <div class="awards-sheet">
        <section class="awards-block" data-section="expert">
          <h4>Об эксперте</h4>
          <ul class="awards-list">
            <li>Кандидат политических наук</li>
            <li>Лектор Российского общества «Знание»</li>
            <li>Партнёр Мастерской управления «Сенеж»</li>
            <li>Эксперт по коммуникационному лидерству</li>
            <li>Архитектор управляемости команд через коммуникации</li>
            <li>20+ лет в управлении коммуникациями: губернаторы, мэры, 31 город Росатома</li>
            <li>Соавтор Индекса коммуникационной состоятельности, верифицированного ЦИРКОН</li>
            <li>Автор методики развития сообществ, апробированной на 1000+ участниках в 30 городах</li>
          </ul>
        </section>
        <section class="awards-block" data-section="awards">
          <h4>Профессиональные награды</h4>
          <ul class="awards-list">
            <li>Победитель национальной премии «Серебряный Лучник»</li>
            <li>Лауреат Премии Нижнего Новгорода (2022), телепроект «Без галстука» («ОТР», «Волга»)</li>
            <li>Почётная грамота Госкорпорации «Росатом», 2023 год</li>
            <li>Знак отличия Госкорпорации «Росатом» «За вклад в развитие атомной отрасли», II степени, 2025 год</li>
          </ul>
        </section>
        <section class="awards-block" data-section="letters">
          <h4>Благодарственные письма</h4>
          <ul class="awards-list">
            <li>Главы Республики Саха (Якутия) А. С. Николаева, 2023 год</li>
            <li>Губернатора Камчатского края В. В. Солодова, 2023 год</li>
            <li>ВРИО губернатора Чукотского автономного округа В. Г. Кузнецова, 2023 год</li>
            <li>Губернатора Сахалинской области В. И. Лимаренко, 2022 год</li>
          </ul>
        </section>
      </div>
    </article>

    <article class="modal" data-modal-id="achievements" role="dialog" aria-modal="true" aria-labelledby="achievementsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="achievementsTitle">Факты и достижения</h3>
      <div class="modal-grid achievements-grid">
        <article><strong>20+ лет</strong><span>практики</span></article>
        <article><strong>31 город</strong><span>на постоянной основе</span></article>
        <article><strong>1000+ участников</strong><span>проектных программ</span></article>
        <article><strong>+30% ИКС</strong><span>средний прирост</span></article>
      </div>
      <p>Разработки: ИКС, коммуникационный алмаз, методология 5 шагов, сценарии форсайт-сессий.</p>
    </article>
  </div>
`;

export default homeMarkup;
