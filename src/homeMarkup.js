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
      <button data-scroll="#hero">Об институте</button>
      <button data-modal="test">Тест</button>
      <button data-scroll="#ms">Наши проекты</button>
      <button data-scroll="#iks">Методология</button>
      <button data-scroll="#expert">Наши эксперты</button>
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
          <div class="hero-actions">
            <button class="btn btn-primary" data-scroll="#commin">Пройти тест</button>
            <button class="btn btn-secondary" data-scroll="#ms">О проектах</button>
            <button class="btn btn-secondary" data-scroll="#contacts">Обсудить сессию</button>
          </div>
          <ul class="trust-line">
            <li><strong>20+ лет</strong><span>практики</span></li>
            <li><strong>40+ городов</strong><span>в проектах</span></li>
            <li><strong>1000+ участников</strong><span>управленческих команд</span></li>
          </ul>
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
              <div class="stack-actions">
                <button class="btn btn-primary" data-scroll="#ms">Подробнее о проектах</button>
                <button class="btn btn-secondary" data-scroll="#contacts">Обсудить сессию</button>
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
          <video id="msVideo" playsinline webkit-playsinline muted loop autoplay preload="metadata" poster="" aria-label="Видео о формате МедиаСтанции">
            <source data-src="/assets/gimn-ed-zy9mar.mp4" data-local-src="/assets/gimn-ed-zy9mar-fast.mp4" data-fallback-src="/assets/gimn-ed-zy9mar.mp4" type="video/mp4">
          </video>
          <div class="video-placeholder" id="videoPlaceholder">
            <button class="play-btn" id="videoPlay" aria-label="Запустить видео">▶</button>
            <p>Нажмите Play, если автозапуск не сработал.</p>
          </div>
          <div class="ms-video-headline" id="msVideoHeadline" aria-hidden="true">
            <span>Флагманский проект</span>
            <strong>«МедиаСтанция»</strong>
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
            <article><strong data-counter="996">996</strong><span>участников</span></article>
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
            <button class="btn btn-primary" data-modal="ms-results">Результаты проекта</button>
            <button class="btn btn-secondary" data-modal="ms-participants">Отзывы участников</button>
            <button class="btn btn-secondary" data-modal="ms-minister">Комментарий замминистра</button>
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
              <li data-key="Организация" tabindex="0">
                <span class="iks-pill-icon" aria-hidden="true"></span>
                <div>
                  <strong>Организация</strong>
                  <p>Насколько чётко распределены процессы, ответственность и ритм решений.</p>
                </div>
              </li>
              <li data-key="Компетенции" tabindex="0">
                <span class="iks-pill-icon" aria-hidden="true"></span>
                <div>
                  <strong>Компетенции</strong>
                  <p>Готовность ролей к диалогу, фасилитации и управлению сложными стыками.</p>
                </div>
              </li>
              <li data-key="Контент" tabindex="0">
                <span class="iks-pill-icon" aria-hidden="true"></span>
                <div>
                  <strong>Контент</strong>
                  <p>Качество смыслов и единый язык, который доходит до исполнения.</p>
                </div>
              </li>
              <li data-key="Охват" tabindex="0">
                <span class="iks-pill-icon" aria-hidden="true"></span>
                <div>
                  <strong>Охват</strong>
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
          <button class="btn btn-primary" data-modal="diamond">Что такое алмаз</button>
          <button class="btn btn-secondary" data-modal="sovereignty">Суверенитет РФ</button>
          <button class="btn btn-secondary" data-modal="formats">Форматы работы</button>
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
            <p class="section-kicker">Кто ведёт сессию</p>
            <h2>Роман Скудняков</h2>
            <p class="expert-lead-quote">«Управляемость команды начинается с того, как она разговаривает и как принимает решения».</p>
            <p class="expert-brief">Стратегический коммуникатор и модератор управленческих команд в сложных распределённых структурах.</p>

            <ul class="positions">
              <li>Ведёт стратегические и форсайт-сессии для руководителей и проектных офисов.</li>
              <li>Собирает единый контур договорённостей между подразделениями.</li>
              <li>Сопровождает команды от диагностики до внедрения решений.</li>
            </ul>
          </div>

          <div class="expert-impact">
            <article class="expert-impact-item expert-impact-item-primary">
              <span class="expert-impact-badge"><strong>20+</strong></span>
              <p>лет</p>
            </article>
            <article class="expert-impact-item expert-impact-item-outline">
              <strong>1000+ проектов</strong>
            </article>
          </div>

          <div class="stack-actions horizontal expert-actions">
            <button class="btn btn-primary" data-modal="achievements">Факты и достижения</button>
            <button class="btn btn-secondary" data-modal="team">Команда Арткомм</button>
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
                <input type="text" name="contact" placeholder="Email" required>
              </label>
              <label class="contact-field">
                <textarea name="message" rows="1" placeholder="Ваш вопрос" required></textarea>
              </label>

              <label class="contact-check">
                <input type="checkbox" name="policy" checked required>
                <span>Я согласен с условиями обработки <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">персональных данных</a></span>
              </label>

              <label class="contact-check">
                <input type="checkbox" name="newsletter">
                <span>Я соглашаюсь получать <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">рекламную рассылку</a>.</span>
              </label>

              <button class="btn contact-form-submit" type="submit">Отправить</button>
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
              <a href="#ms" data-scroll="#ms">МедиаСтанция</a>
              <a href="#iks" data-scroll="#iks">Методология</a>
              <a href="#expert" data-scroll="#expert">Эксперт</a>
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

    <article class="modal" data-modal-id="test" role="dialog" aria-modal="true" aria-labelledby="testTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="testTitle">Тест на проблематику</h3>
      <div class="test-progress"><i id="testProgressBar"></i></div>
      <div id="testQuestionWrap"></div>
      <div class="test-actions">
        <button class="btn btn-secondary" id="testBack" disabled>Назад</button>
        <button class="btn btn-primary" id="testNext" disabled>Далее</button>
      </div>
      <div id="testResult" hidden></div>
    </article>

    <article class="modal" data-modal-id="ms-results" role="dialog" aria-modal="true" aria-labelledby="msResultsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="msResultsTitle">Результаты МедиаСтанции</h3>
      <div class="modal-grid numbers-12">
        <span>996 участников</span><span>30 городов</span><span>11 часовых поясов</span><span>20 млн просмотров</span>
        <span>5200 медиапродуктов</span><span>76,9% вовлечённости</span><span>82% амбассадоры</span><span>86% уверенность</span>
        <span>92% рост связей</span><span>93% быстрее договорённости</span><span>95% проще решать</span><span>96% командность</span>
      </div>
      <div class="bars modal-bars">
        <div class="bar-item"><span>Лояльность</span><strong>86%</strong><div class="bar"><i data-value="86"></i></div></div>
        <div class="bar-item"><span>Инициативность</span><strong>90%</strong><div class="bar"><i data-value="90"></i></div></div>
        <div class="bar-item"><span>Синхронность</span><strong>96%</strong><div class="bar"><i data-value="96"></i></div></div>
      </div>
    </article>

    <article class="modal" data-modal-id="ms-participants" role="dialog" aria-modal="true" aria-labelledby="msParticipantsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="msParticipantsTitle">Участники о проекте</h3>
      <blockquote>«Я увидела, как командные договорённости становятся реальными действиями уже в первые недели.» — Елена Светлова, Озёрск</blockquote>
      <blockquote>«Проект дал нам язык, на котором можно обсуждать сложные задачи без конфликтов.» — Ульяна Реброва, Полярные Зори</blockquote>
    </article>

    <article class="modal" data-modal-id="ms-minister" role="dialog" aria-modal="true" aria-labelledby="msMinisterTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="msMinisterTitle">Комментарий замминистра науки РФ</h3>
      <p>«Формат МедиаСтанции показал, что работа с коммуникациями напрямую влияет на скорость реализации решений и качество командного взаимодействия.»</p>
      <p class="modal-note">Ольга Петрова, заместитель министра науки РФ</p>
    </article>

    <article class="modal" data-modal-id="diamond" role="dialog" aria-modal="true" aria-labelledby="diamondTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="diamondTitle">Коммуникационный алмаз</h3>
      <p>Алмаз показывает состояние системы по четырём осям: организация, компетенции, контент и охват. ИКС рассчитывается как суммарная оценка показателей: <strong>ИКС = ∑P[j]</strong>.</p>
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
      <h3 id="formatsTitle">Форматы работы</h3>
      <div class="modal-grid format-cards">
        <article>
          <h4>Управленческая сессия</h4>
          <p>2–4 часа</p>
          <p class="tags">#диагностика #синхронизация #решения</p>
        </article>
        <article>
          <h4>Форсайт-сессия</h4>
          <p>1–2 дня</p>
          <p class="tags">#сценарии #стратегия #приоритеты</p>
        </article>
        <article>
          <h4>Акселерация</h4>
          <p>1–12 месяцев</p>
          <p class="tags">#внедрение #сопровождение #ростИКС</p>
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
        <article><i>РС</i><span>Роман Скудняков</span><small>Руководитель проекта</small></article>
        <article><i>ОР</i><span>Ольга Рыхлова</span><small>Учредитель</small></article>
        <article><i>АМ</i><span>Анна М.</span><small>Аналитик</small></article>
        <article><i>ДС</i><span>Дмитрий С.</span><small>Методолог</small></article>
        <article><i>ЕК</i><span>Екатерина К.</span><small>Продюсер программ</small></article>
        <article><i>ПЛ</i><span>Павел Л.</span><small>Фасилитатор</small></article>
        <article><i>ЮТ</i><span>Юлия Т.</span><small>Коммуникации</small></article>
        <article><i>МГ</i><span>Михаил Г.</span><small>Координатор</small></article>
      </div>
    </article>

    <article class="modal" data-modal-id="awards" role="dialog" aria-modal="true" aria-labelledby="awardsTitle" hidden>
      <button class="modal-close" aria-label="Закрыть">×</button>
      <h3 id="awardsTitle">Профессиональные награды</h3>
      <ul>
        <li>Серебряный лучник, 2024</li>
        <li>Знак Росатома, 2025</li>
        <li>Премия НН, 2022</li>
        <li>Благодарности регионов</li>
        <li>ТВ «Без галстука»</li>
      </ul>
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
