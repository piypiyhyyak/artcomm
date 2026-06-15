const testMarkup = String.raw`
  <a class="skip-link" href="#testMain">Перейти к тесту</a>

  <header class="site-header is-solid site-header-static test-page-header">
    <div class="container header-inner">
      <a href="/" class="logo" aria-label="На главную">
        <img class="logo-mark" src="/assets/logo-mark.png" alt="" aria-hidden="true">
        <div class="logo-copy">
          <span>ИНСТИТУТ КРЕАТИВНЫХ ИНДУСТРИЙ</span>
          <span>И СОЦИАЛЬНОГО ПРОЕКТИРОВАНИЯ «АРТКОММ»</span>
        </div>
      </a>
      <div class="header-actions">
        <a class="btn btn-primary" href="/">На главную</a>
      </div>
    </div>
  </header>

  <main id="testMain" class="test-page">
    <section class="test-shell">
      <div class="container test-shell-inner">
        <div class="test-intro">
          <h1>Короткий тест для<br>управленческой команды</h1>
          <p class="test-hero-lead">
            Два шага помогут быстро понять, какой формат работы АртКомм подойдёт вашей команде прямо сейчас.
          </p>
        </div>

        <section class="test-stage" aria-live="polite">
          <div class="test-stage-head">
            <p class="test-step-meta" id="testStepMeta">Шаг 1 из 2</p>
            <div class="test-progress" aria-hidden="true"><i id="testProgressBar"></i></div>
          </div>

          <div id="testQuestionWrap"></div>
          <div id="testResult" hidden></div>

          <div class="test-actions">
            <button class="btn btn-secondary" id="testBack" disabled>Назад</button>
            <button class="btn btn-primary" id="testNext" disabled>Далее</button>
          </div>
        </section>
      </div>
    </section>
  </main>
`;

export default testMarkup;
