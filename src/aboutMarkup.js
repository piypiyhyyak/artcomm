const aboutMarkup = String.raw`
  <a class="skip-link" href="#aboutMainContent">Перейти к содержанию</a>

  <header class="site-header about-header is-solid" id="aboutHeader">
    <div class="container header-inner about-header-inner">
      <a href="/" class="logo" aria-label="На главную страницу">
        <img class="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true">
        <div class="logo-copy">
          <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
          <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
        </div>
      </a>
      <div class="header-actions about-header-actions">
        <a class="btn btn-secondary" href="/">На главную</a>
        <a class="btn btn-primary" href="/#contacts">Связаться</a>
      </div>
    </div>
  </header>

  <main class="about-page" id="aboutMainContent">
    <section class="about-hero section-deep">
      <div class="container about-hero-inner">
        <p class="section-kicker">Официальный раздел</p>
        <h1>Сведения об организации</h1>
        <p class="about-hero-text">Раздел подготовлен в соответствии с требованиями законодательства и техническим заданием на сайт АНО Институт «АртКомм».</p>
        <div class="about-hero-actions">
          <a class="btn btn-primary" href="#about-basic">Основные сведения</a>
          <a class="btn btn-secondary" href="#about-docs">Документы</a>
        </div>
      </div>
    </section>

    <nav class="about-anchor-nav container" aria-label="Навигация по странице сведений">
      <a href="#about-basic">Основные сведения</a>
      <a href="#about-docs">Документы</a>
      <a href="#about-education">Образование</a>
      <a href="#about-management">Руководство</a>
      <a href="#about-extra">Дополнительные разделы</a>
    </nav>

    <section class="about-section section-light" id="about-basic">
      <div class="container about-section-shell">
        <header class="about-section-head">
          <p class="section-kicker">Раздел 1</p>
          <h2>Основные сведения</h2>
        </header>
        <div class="about-grid">
          <article class="about-card">
            <dl class="about-facts">
              <div><dt>Полное название</dt><dd>АНО Институт «АртКоммуникации»</dd></div>
              <div><dt>Международное название</dt><dd>ArtCommunications Institute for Creative Industries &amp; Social Design</dd></div>
              <div><dt>Сокращённое название</dt><dd>АНО Институт «АртКомм»</dd></div>
              <div><dt>Дата создания</dt><dd>22 января 2026</dd></div>
              <div><dt>Учредитель</dt><dd>Рыхлова Ольга Николаевна</dd></div>
              <div><dt>Адрес</dt><dd>Нижегородская обл., г. Нижний Новгород, ул. Сергиевская, д. 8, 603000</dd></div>
              <div><dt>График работы</dt><dd>Пн-Чт 9:00-18:00, Пт 9:00-17:00, Сб-Вс — по расписанию</dd></div>
              <div><dt>Телефон</dt><dd><a href="tel:+79503545558">+7 (950) 354-55-58</a></dd></div>
              <div><dt>Сайт</dt><dd><a href="https://artcomminstitute.ru" target="_blank" rel="noopener noreferrer">artcomminstitute.ru</a></dd></div>
              <div><dt>E-mail</dt><dd><a href="mailto:info@artcommrf.ru">info@artcommrf.ru</a></dd></div>
            </dl>
          </article>

          <article class="about-card">
            <h3>Документы по основным сведениям</h3>
            <div class="about-links-list">
              <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Регистрационная карточка организации</a>
              <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Информация о лицензии на образовательную деятельность</a>
              <a href="https://islod.obrnadzor.gov.ru/" target="_blank" rel="noopener noreferrer">Проверить лицензию в реестре Рособрнадзора</a>
            </div>
            <p class="about-note">Файлы и реквизиты будут обновлены после передачи финального пакета документов заказчиком.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="about-section section-pale" id="about-docs">
      <div class="container about-section-shell">
        <header class="about-section-head">
          <p class="section-kicker">Раздел 2</p>
          <h2>Документы</h2>
        </header>
        <article class="about-card">
          <ul class="about-doc-list">
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Устав организации</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Выписка ЕГРЮЛ</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Свидетельство ИНН</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Свидетельство ОГРН</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Правила внутреннего распорядка обучающихся</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Правила внутреннего трудового распорядка</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Локальные нормативные акты</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Отчёт о самообследовании</a></li>
            <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Предписания надзорных органов (при наличии)</a></li>
          </ul>
        </article>
      </div>
    </section>

    <section class="about-section section-light" id="about-education">
      <div class="container about-section-shell">
        <header class="about-section-head">
          <p class="section-kicker">Раздел 3</p>
          <h2>Образование</h2>
        </header>
        <article class="about-card">
          <p class="about-note">Описание образовательных программ будет уточнено заказчиком. Ниже размещена обязательная таблица с 11 столбцами.</p>
          <div class="about-table-wrap">
            <table class="about-table about-table-wide">
              <thead>
                <tr>
                  <th>Колонка 1</th>
                  <th>Колонка 2</th>
                  <th>Колонка 3</th>
                  <th>Колонка 4</th>
                  <th>Колонка 5</th>
                  <th>Колонка 6</th>
                  <th>Колонка 7</th>
                  <th>Колонка 8</th>
                  <th>Колонка 9</th>
                  <th>Колонка 10</th>
                  <th>Колонка 11</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>

    <section class="about-section section-pale" id="about-management">
      <div class="container about-section-shell">
        <header class="about-section-head">
          <p class="section-kicker">Раздел 4</p>
          <h2>Руководство</h2>
        </header>
        <article class="about-card">
          <div class="about-table-wrap">
            <table class="about-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Телефон</th>
                  <th>E-mail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Заполняется заказчиком</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>

    <section class="about-section section-light" id="about-extra">
      <div class="container about-section-shell">
        <header class="about-section-head">
          <p class="section-kicker">Раздел 5</p>
          <h2>Дополнительные разделы</h2>
        </header>

        <div class="about-extra-grid">
          <article class="about-card">
            <h3>Педагогический состав</h3>
            <div class="about-links-list">
              <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Скачать сведения о педагогическом составе</a>
            </div>
          </article>

          <article class="about-card">
            <h3>Платные образовательные услуги</h3>
            <div class="about-links-list">
              <a href="/assets/dogovor-artkomm.pdf" target="_blank" rel="noopener noreferrer">Положение об оказании платных услуг</a>
              <a href="/assets/dogovor-artkomm.pdf" target="_blank" rel="noopener noreferrer">Образец договора</a>
              <a href="/assets/dogovor-artkomm.pdf" target="_blank" rel="noopener noreferrer">Утверждённая стоимость обучения</a>
            </div>
          </article>

          <article class="about-card">
            <h3>Финансово-хозяйственная деятельность</h3>
            <p class="about-note">Показатели заполняются ежегодно.</p>
            <div class="about-table-wrap">
              <table class="about-table">
                <thead>
                  <tr><th>Период</th><th>Доходы</th><th>Расходы</th></tr>
                </thead>
                <tbody>
                  <tr><td>2026</td><td>—</td><td>—</td></tr>
                  <tr><td>2027</td><td>—</td><td>—</td></tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="about-card">
            <h3>Образовательные стандарты</h3>
            <div class="about-links-list">
              <a href="http://www.kremlin.ru/acts/bank/39206" target="_blank" rel="noopener noreferrer">Федеральный закон №273-ФЗ «Об образовании в РФ»</a>
              <a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Нормативные правовые акты (список уточняется)</a>
            </div>
          </article>

          <article class="about-card">
            <h3>Лицензия</h3>
            <div class="about-license-placeholder">Скан лицензии будет размещён после передачи документа.</div>
            <div class="about-links-list">
              <a href="https://islod.obrnadzor.gov.ru/" target="_blank" rel="noopener noreferrer">Оригинал в федеральном реестре</a>
            </div>
          </article>

          <article class="about-card">
            <h3>Образовательные программы</h3>
            <ul class="about-program-list">
              <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Программа 1 (заглушка)</a></li>
              <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Программа 2 (заглушка)</a></li>
              <li><a href="/assets/ustav-artkommunikacii.pdf" target="_blank" rel="noopener noreferrer">Программа 3 (заглушка)</a></li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <footer class="site-footer about-footer">
      <div class="container footer-shell">
        <div class="footer-grid about-footer-grid">
          <section class="footer-col footer-col-main">
            <a href="/" class="footer-brand" aria-label="На главную страницу">
              <div class="footer-brand-row">
                <img class="footer-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true">
                <strong>Институт «АртКомм»</strong>
              </div>
              <span>Сведения об организации и обязательные документы в одном разделе.</span>
            </a>
          </section>

          <section class="footer-col">
            <h3 class="footer-title">Разделы страницы</h3>
            <nav class="footer-links" aria-label="Навигация по разделам">
              <a href="#about-basic">Основные сведения</a>
              <a href="#about-docs">Документы</a>
              <a href="#about-education">Образование</a>
              <a href="#about-management">Руководство</a>
              <a href="#about-extra">Дополнительные разделы</a>
            </nav>
          </section>

          <section class="footer-col footer-col-docs">
            <h3 class="footer-title">Контакты</h3>
            <div class="footer-links footer-links-contacts">
              <a href="mailto:info@artcommrf.ru">info@artcommrf.ru</a>
              <a href="tel:+79503545558">+7 (950) 354-55-58</a>
              <a href="https://t.me" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>
              <a href="https://max.ru" target="_blank" rel="noopener noreferrer">Написать в Max</a>
              <a href="/">Вернуться на главную</a>
            </div>
          </section>
        </div>
        <p class="footer-copy">© 2026 АНО «АртКомм». Все права защищены.</p>
      </div>
    </footer>
  </main>
`;

export default aboutMarkup;
