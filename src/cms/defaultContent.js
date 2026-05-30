export const CMS_VERSION = 1;

export const ROLE_ADMIN = "administrator";
export const ROLE_EDITOR = "editor";
export const ROLE_VIEWER = "viewer";

export const ROLE_LABELS = {
  [ROLE_ADMIN]: "Администратор",
  [ROLE_EDITOR]: "Редактор",
  [ROLE_VIEWER]: "Наблюдатель"
};

export const DEFAULT_USERS = [
  {
    id: "admin-1",
    name: "Системный администратор",
    login: "admin",
    role: ROLE_ADMIN,
    createdAt: "2026-05-26T09:00:00.000Z"
  },
  {
    id: "editor-1",
    name: "Контент-редактор",
    login: "editor",
    role: ROLE_EDITOR,
    createdAt: "2026-05-26T09:00:00.000Z"
  },
  {
    id: "viewer-1",
    name: "Наблюдатель",
    login: "viewer",
    role: ROLE_VIEWER,
    createdAt: "2026-05-26T09:00:00.000Z"
  }
];

export const DEFAULT_CONTENT = {
  home: {
    hero: {
      kicker: "Институт «АртКомм»",
      title: "Повышаем управляемость команд через коммуникации",
      quote: "«Проблема не в людях, а в связях между ними»",
      actions: [
        { id: "hero-action-1", label: "Пройти тест", type: "scroll", target: "#commin", variant: "primary", isPublished: true },
        { id: "hero-action-2", label: "О проектах", type: "scroll", target: "#ms", variant: "secondary", isPublished: true },
        { id: "hero-action-3", label: "Обсудить сессию", type: "scroll", target: "#contacts", variant: "secondary", isPublished: true }
      ],
      trustLine: [
        { id: "trust-1", value: "20+ лет", caption: "практики", isPublished: true },
        { id: "trust-2", value: "40+ городов", caption: "в проектах", isPublished: true },
        { id: "trust-3", value: "1000+ участников", caption: "управленческих команд", isPublished: true }
      ]
    },
    slides: [
      { id: "slide-1", image: "/assets/hero-5.jpeg", alt: "Фоновое фото института", isPublished: true },
      { id: "slide-2", image: "/assets/hero-4.jpeg", alt: "Фоновое фото проекта", isPublished: true },
      { id: "slide-3", image: "/assets/hero-3.jpeg", alt: "Фоновое фото команды", isPublished: true },
      { id: "slide-4", image: "/assets/hero-2.jpeg", alt: "Фоновое фото сессии", isPublished: true },
      { id: "slide-5", image: "/assets/hero-1.jpeg", alt: "Фоновое фото аудитории", isPublished: true }
    ],
    mediaStation: {
      kicker: "Флагманский проект",
      title: "«МедиаСтанция»",
      subtitle: "Практика, где коммуникация становится рабочим инструментом управления командами.",
      caption: "«Сенсация» — о форматах работы, от онлайна к офлайну.",
      videoDesktop: "/assets/gimn-ed-zy9mar.mp4",
      videoMobile: "/assets/gimn-ed-zy9mar.mp4",
      videoFallback: "/assets/gimn-ed-zy9mar.mp4",
      storyTitle: "Ускоряем рабочие договорённости внутри больших распределённых команд",
      storyText: "Собираем единый коммуникационный ритм для людей из разных городов и контуров управления.",
      metricValue: "82,4",
      metricSuffix: "%",
      metricCaption: "готовы назвать себя амбассадорами Росатома",
      stats: [
        { id: "ms-stat-1", value: "996", suffix: "", label: "участников", isPublished: true },
        { id: "ms-stat-2", value: "30", suffix: "", label: "городов", isPublished: true },
        { id: "ms-stat-3", value: "11", suffix: "", label: "часовых поясов", isPublished: true },
        { id: "ms-stat-4", value: "20", suffix: " млн", label: "просмотров", isPublished: true },
        { id: "ms-stat-5", value: "5200", suffix: "", label: "медиапродуктов", isPublished: true },
        { id: "ms-stat-6", value: "76,9", suffix: "%", label: "вовлечённости", isPublished: true }
      ],
      loyalty: [
        { id: "ms-loyalty-1", value: "82", label: "Называю себя амбассадором", isPublished: true },
        { id: "ms-loyalty-2", value: "86", label: "Стал увереннее размещать контент", isPublished: true },
        { id: "ms-loyalty-3", value: "92", label: "Увеличилось кол-во связей", isPublished: true },
        { id: "ms-loyalty-4", value: "93", label: "Быстрее договариваться", isPublished: true },
        { id: "ms-loyalty-5", value: "95", label: "Проще решать проблемы", isPublished: true },
        { id: "ms-loyalty-6", value: "96", label: "Ощущаем себя как команда", isPublished: true }
      ],
      actions: [
        { id: "ms-action-1", label: "Результаты проекта", type: "modal", target: "ms-results", variant: "primary", isPublished: true },
        { id: "ms-action-2", label: "Отзывы участников", type: "modal", target: "ms-participants", variant: "secondary", isPublished: true },
        { id: "ms-action-3", label: "Комментарий замминистра", type: "modal", target: "ms-minister", variant: "secondary", isPublished: true }
      ]
    },
    contacts: {
      scheduleLabel: "Режим работы",
      scheduleValue: "пн-пт 9:00-18:00",
      phone: "+7 (916) 692-07-75",
      phoneHref: "tel:+79166920775",
      email: "info@artcommrf.ru",
      emailHref: "mailto:info@artcommrf.ru",
      telegramLabel: "Написать в Telegram",
      telegramUrl: "https://t.me",
      maxLabel: "Написать в Max",
      maxUrl: "https://max.ru"
    },
    trustedPartners: [
      { id: "trusted-1", name: "Росатом", logo: "/assets/logos/rosatom.png", x: 13, y: 16, range: 42, isPublished: true },
      { id: "trusted-2", name: "Знание", logo: "/assets/logos/znanie.png", x: 34, y: 14, range: 40, isPublished: true },
      { id: "trusted-3", name: "Сенеж", logo: "/assets/logos/senezh.png", x: 56, y: 22, range: 38, isPublished: true },
      { id: "trusted-4", name: "АСИ", logo: "/assets/logos/asi.png", x: 79, y: 18, range: 44, isPublished: true },
      { id: "trusted-5", name: "ВКонтакте", logo: "/assets/logos/vk.png", x: 20, y: 52, range: 36, isPublished: true },
      { id: "trusted-6", name: "МГУ", logo: "/assets/logos/mgu.png", x: 45, y: 58, range: 40, isPublished: true },
      { id: "trusted-7", name: "ЦИРКОН", logo: "/assets/logos/cirkon.png", x: 72, y: 56, range: 42, isPublished: true }
    ],
    common: {
      kicker: "Ты из корпорации или органа власти?",
      title: "Знакомо? Болит? Тревожит?",
      pains: [
        { id: "pain-1", title: "Сильная команда — слабая управляемость", text: "Решения есть, но теряются на стыках подразделений.", isPublished: true },
        { id: "pain-2", title: "Разрывы во взаимодействии", text: "Информация передаётся медленно и искажается по пути.", isPublished: true },
        { id: "pain-3", title: "Руководителя слушают, но не слышат", text: "Сигнал сверху не превращается в действия на местах.", isPublished: true },
        { id: "pain-4", title: "Есть идеи — мало системных проектов", text: "Потенциал сотрудников не превращается в устойчивый результат.", isPublished: true }
      ],
      cta: {
        kicker: "Системный подход",
        titleLine1: "Переведём коммуникации",
        titleLine2: "в управляемую систему",
        textLine1: "Покажем, где команда теряет скорость,",
        textLine2: "и соберём рабочую архитектуру взаимодействия.",
        primaryLabel: "Подробнее о проектах",
        primaryTarget: "#ms",
        secondaryLabel: "Обсудить сессию",
        secondaryTarget: "#contacts"
      }
    },
    iks: {
      kicker: "Методология",
      title: "Индекс коммуникационной состоятельности",
      description: "Переводим коммуникации из «ощущений» в управляемую систему, чтобы команда видела сильные стороны и точки ускорения решений.",
      pillars: [
        { id: "pillar-1", key: "Организация", title: "Организация", text: "Насколько чётко распределены процессы, ответственность и ритм решений.", isPublished: true },
        { id: "pillar-2", key: "Компетенции", title: "Компетенции", text: "Готовность ролей к диалогу, фасилитации и управлению сложными стыками.", isPublished: true },
        { id: "pillar-3", key: "Контент", title: "Контент", text: "Качество смыслов и единый язык, который доходит до исполнения.", isPublished: true },
        { id: "pillar-4", key: "Охват", title: "Охват", text: "Плотность каналов и глубина включения команды в общий контур коммуникаций.", isPublished: true }
      ],
      actions: [
        { id: "iks-action-1", label: "Что такое алмаз", type: "modal", target: "diamond", variant: "primary", isPublished: true },
        { id: "iks-action-2", label: "Суверенитет РФ", type: "modal", target: "sovereignty", variant: "secondary", isPublished: true },
        { id: "iks-action-3", label: "Форматы работы", type: "modal", target: "formats", variant: "secondary", isPublished: true }
      ]
    },
    expert: {
      kicker: "Кто ведёт сессию",
      title: "Роман Скудняков",
      quote: "«Управляемость команды начинается с того, как она разговаривает и как принимает решения».",
      brief: "Стратегический коммуникатор и модератор управленческих команд в сложных распределённых структурах.",
      photos: [
        { id: "expert-photo-1", image: "/assets/expert-1.jpg", alt: "Эксперт проекта Роман Скудняков", isPublished: true },
        { id: "expert-photo-2", image: "/assets/expert-2.jpg", alt: "Роман Скудняков на выступлении", isPublished: true },
        { id: "expert-photo-3", image: "/assets/expert-3.jpg", alt: "Рабочая встреча с экспертом", isPublished: true },
        { id: "expert-photo-4", image: "/assets/expert-4.jpg", alt: "Портрет эксперта", isPublished: true }
      ],
      positions: [
        { id: "expert-pos-1", text: "Ведёт стратегические и форсайт-сессии для руководителей и проектных офисов.", isPublished: true },
        { id: "expert-pos-2", text: "Собирает единый контур договорённостей между подразделениями.", isPublished: true },
        { id: "expert-pos-3", text: "Сопровождает команды от диагностики до внедрения решений.", isPublished: true }
      ],
      impactPrimaryValue: "20+",
      impactPrimaryLabel: "лет",
      impactSecondaryText: "1000+ проектов",
      actions: [
        { id: "expert-action-1", label: "Команда Арткомм", type: "modal", target: "team", variant: "primary", isPublished: true },
        { id: "expert-action-2", label: "Профессиональные награды", type: "modal", target: "awards", variant: "secondary", isPublished: true },
        { id: "expert-action-3", label: "Факты и достижения", type: "modal", target: "achievements", variant: "secondary", isPublished: true }
      ]
    },
    contactsSection: {
      kicker: "Обратная связь",
      titleLine1: "Управление командой",
      titleLine2: "начинается с коммуникации",
      cardTitle: "Контакты",
      formTitle: "Написать нам",
      formLead: "Если у вас остались вопросы, оставьте свои контакты и мы свяжемся с вами.",
      policyPrefix: "Я согласен с условиями обработки",
      policyLinkLabel: "персональных данных",
      policyLink: "/privacy",
      newsPrefix: "Я соглашаюсь получать",
      newsLinkLabel: "рекламную рассылку",
      newsLink: "/privacy#marketing-consent",
      submitLabel: "Отправить",
      trustedTitle: "Нам доверяют"
    }
  },
  modals: [
    {
      id: "test",
      title: "Тест на проблематику",
      bodyHtml: "",
      isPublished: true
    },
    {
      id: "ms-results",
      title: "Результаты МедиаСтанции",
      bodyHtml:
        '<div class="modal-grid numbers-12"><span>996 участников</span><span>30 городов</span><span>11 часовых поясов</span><span>20 млн просмотров</span><span>5200 медиапродуктов</span><span>76,9% вовлечённости</span><span>82% амбассадоры</span><span>86% уверенность</span><span>92% рост связей</span><span>93% быстрее договорённости</span><span>95% проще решать</span><span>96% командность</span></div><div class="bars modal-bars"><div class="bar-item"><span>Лояльность</span><strong>86%</strong><div class="bar"><i data-value="86"></i></div></div><div class="bar-item"><span>Инициативность</span><strong>90%</strong><div class="bar"><i data-value="90"></i></div></div><div class="bar-item"><span>Синхронность</span><strong>96%</strong><div class="bar"><i data-value="96"></i></div></div></div>',
      isPublished: true
    },
    {
      id: "ms-participants",
      title: "Участники о проекте",
      bodyHtml:
        "<blockquote>«Я увидела, как командные договорённости становятся реальными действиями уже в первые недели.» — Елена Светлова, Озёрск</blockquote><blockquote>«Проект дал нам язык, на котором можно обсуждать сложные задачи без конфликтов.» — Ульяна Реброва, Полярные Зори</blockquote>",
      isPublished: true
    },
    {
      id: "ms-minister",
      title: "Комментарий замминистра науки РФ",
      bodyHtml:
        "<p>«Формат МедиаСтанции показал, что работа с коммуникациями напрямую влияет на скорость реализации решений и качество командного взаимодействия.»</p><p class='modal-note'>Ольга Петрова, заместитель министра науки РФ</p>",
      isPublished: true
    },
    {
      id: "diamond",
      title: "Коммуникационный алмаз",
      bodyHtml:
        "<p>Алмаз показывает состояние системы по четырём осям: организация, компетенции, контент и охват. ИКС рассчитывается как суммарная оценка показателей: <strong>ИКС = ∑P[j]</strong>.</p><p>Сравнение линии города со средним значением позволяет увидеть сильные стороны и зоны развития.</p>",
      isPublished: true
    },
    {
      id: "sovereignty",
      title: "Суверенитет РФ",
      bodyHtml:
        "<p>Коммуникационный суверенитет — это способность страны и регионов формировать устойчивые смыслы, процессы и каналы без критической внешней зависимости.</p><ul><li>Уровень 1: инфраструктура каналов и данных.</li><li>Уровень 2: управленческие компетенции и роли.</li><li>Уровень 3: культурная устойчивость смыслов.</li></ul><p class='modal-note'>Цитаты экспертов уточняются с заказчиком.</p>",
      isPublished: true
    },
    {
      id: "formats",
      title: "Форматы работы",
      bodyHtml:
        '<div class="modal-grid format-cards"><article><h4>Управленческая сессия</h4><p>2–4 часа</p><p class="tags">#диагностика #синхронизация #решения</p></article><article><h4>Форсайт-сессия</h4><p>1–2 дня</p><p class="tags">#сценарии #стратегия #приоритеты</p></article><article><h4>Акселерация</h4><p>1–12 месяцев</p><p class="tags">#внедрение #сопровождение #ростИКС</p></article></div>',
      isPublished: true
    },
    {
      id: "methodology",
      title: "Методология 5 шагов",
      bodyHtml:
        "<ol class='timeline'><li>Диагностика</li><li>Выявление разрывов</li><li>Пересборка контуров взаимодействия</li><li>Единый язык команды</li><li>Фиксация результата</li></ol>",
      isPublished: true
    },
    {
      id: "team",
      title: "Команда Арткомм",
      bodyHtml:
        '<div class="modal-grid team-grid"><article><i>РС</i><span>Роман Скудняков</span><small>Руководитель проекта</small></article><article><i>ОР</i><span>Ольга Рыхлова</span><small>Учредитель</small></article><article><i>АМ</i><span>Анна М.</span><small>Аналитик</small></article><article><i>ДС</i><span>Дмитрий С.</span><small>Методолог</small></article><article><i>ЕК</i><span>Екатерина К.</span><small>Продюсер программ</small></article><article><i>ПЛ</i><span>Павел Л.</span><small>Фасилитатор</small></article><article><i>ЮТ</i><span>Юлия Т.</span><small>Коммуникации</small></article><article><i>МГ</i><span>Михаил Г.</span><small>Координатор</small></article></div>',
      isPublished: true
    },
    {
      id: "awards",
      title: "Профессиональные награды",
      bodyHtml:
        "<ul><li>Серебряный лучник, 2024</li><li>Знак Росатома, 2025</li><li>Премия НН, 2022</li><li>Благодарности регионов</li><li>ТВ «Без галстука»</li></ul>",
      isPublished: true
    },
    {
      id: "achievements",
      title: "Факты и достижения",
      bodyHtml:
        '<div class="modal-grid achievements-grid"><article><strong>20+ лет</strong><span>практики</span></article><article><strong>31 город</strong><span>на постоянной основе</span></article><article><strong>1000+ участников</strong><span>проектных программ</span></article><article><strong>+30% ИКС</strong><span>средний прирост</span></article></div><p>Разработки: ИКС, коммуникационный алмаз, методология 5 шагов, сценарии форсайт-сессий.</p>',
      isPublished: true
    }
  ],
  about: {
    hero: {
      kicker: "Официальный раздел",
      title: "Сведения об организации",
      description:
        "Раздел подготовлен в соответствии с требованиями законодательства и техническим заданием на сайт АНО Институт «АртКомм»."
    },
    basicFacts: [
      { id: "fact-1", label: "Полное название", value: "Автономная некоммерческая организация Институт креативных индустрий и социального проектирования «АртКоммуникации»", isPublished: true },
      { id: "fact-2", label: "Международное название", value: "ArtCommunications Institute for Creative Industries & Social Design", isPublished: true },
      { id: "fact-3", label: "Сокращённое название", value: "АНО Институт «АртКомм»", isPublished: true },
      { id: "fact-4", label: "Дата создания", value: "22 января 2026", isPublished: true },
      { id: "fact-5", label: "Учредитель", value: "Рыхлова Ольга Николаевна", isPublished: true },
      { id: "fact-6", label: "Адрес", value: "603000, Нижегородская обл., г.о. Нижний Новгород, г. Нижний Новгород, ул. Сергиевская, д. 8.", isPublished: true },
      { id: "fact-7", label: "График работы", value: "Пн-Чт 9:00-18:00, Пт 9:00-17:00, Сб-Вс — по расписанию", isPublished: true },
      { id: "fact-8", label: "Телефон", value: "+7 (950) 354-55-58", link: "tel:+79503545558", isPublished: true },
      { id: "fact-9", label: "Сайт", value: "artcomminstitute.ru", link: "https://artcomminstitute.ru", isPublished: true },
      { id: "fact-10", label: "E-mail", value: "info@artcommrf.ru", link: "mailto:info@artcommrf.ru", isPublished: true }
    ],
    documentsBasic: [
      { id: "doc-basic-1", title: "Регистрационная карточка организации", url: "/assets/registracionnaya-kartochka-srv.pdf", isPublished: true },
      { id: "doc-basic-2", title: "Информация о лицензии на образовательную деятельность", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-basic-3", title: "Проверить лицензию в реестре Рособрнадзора", url: "https://islod.obrnadzor.gov.ru/", isPublished: true }
    ],
    documentsMain: [
      { id: "doc-main-1", title: "Устав организации", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-2", title: "Программа образования", url: "/assets/program-obrazovaniya-artkomm.pdf", isPublished: true },
      { id: "doc-main-3", title: "Выписка ЕГРЮЛ", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-4", title: "Свидетельство ИНН", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-5", title: "Свидетельство ОГРН", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-6", title: "Правила внутреннего распорядка обучающихся", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-7", title: "Правила внутреннего трудового распорядка", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-8", title: "Локальные нормативные акты", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-9", title: "Отчёт о самообследовании", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true },
      { id: "doc-main-10", title: "Предписания надзорных органов (при наличии)", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true }
    ],
    education: {
      note: "Раздел заполнен на основании утверждённой дополнительной профессиональной программы повышения квалификации.",
      links: [
        { id: "edu-link-1", title: "Программа образования (PDF)", url: "/assets/program-obrazovaniya-artkomm.pdf", isPublished: true }
      ],
      headers: [
        "Вид программы",
        "Наименование программы",
        "Целевая аудитория",
        "Форма обучения",
        "Формат реализации",
        "Трудоёмкость, ч",
        "Контактная работа, ч",
        "Самостоятельная работа, ч",
        "Срок освоения",
        "Формы аттестации",
        "Документ по итогам"
      ],
      rows: [
        [
          "Дополнительная профессиональная программа (повышение квалификации)",
          "«Социальная архитектура и развитие городских сообществ: проектные и коммуникационные компетенции»",
          "Лица с высшим или средним специальным образованием",
          "С применением дистанционных технологий",
          "Платформа Getcourse, онлайн-сессии и групповые занятия (Zoom/Webinar)",
          "285",
          "75",
          "215",
          "14 недель",
          "Промежуточная аттестация: проверка проектной работы; итоговая аттестация: тестирование",
          "Удостоверение о повышении квалификации установленного образца"
        ]
      ]
    },
    management: {
      headers: ["ФИО", "Должность", "Телефон", "E-mail"],
      rows: [["Скудняков Роман Владимирович", "Директор", "+7 (967) 711-35-82", "n.gus.ur@mail.ru"]]
    },
    financial: {
      note: "Показатели заполняются ежегодно.",
      headers: ["Период", "Доходы", "Расходы"],
      rows: [
        ["2026", "—", "—"],
        ["2027", "—", "—"]
      ]
    },
    extra: {
      pedagogy: [
        { id: "pedagogy-1", title: "Скачать сведения о педагогическом составе", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true }
      ],
      paidServices: [
        { id: "paid-1", title: "Положение об оказании платных услуг", url: "/assets/dogovor-artkomm.pdf", isPublished: true },
        { id: "paid-2", title: "Образец договора", url: "/assets/dogovor-artkomm.pdf", isPublished: true },
        { id: "paid-3", title: "Утверждённая стоимость обучения", url: "/assets/dogovor-artkomm.pdf", isPublished: true }
      ],
      standards: [
        { id: "std-1", title: "Федеральный закон №273-ФЗ «Об образовании в РФ»", url: "https://www.kremlin.ru/acts/bank/39206", isPublished: true },
        { id: "std-2", title: "Нормативные правовые акты", url: "/assets/ustav-artkommunikacii.pdf", isPublished: true }
      ],
      license: {
        placeholder: "",
        registryLabel: "Оригинал в федеральном реестре",
        registryUrl: "https://islod.obrnadzor.gov.ru/"
      },
      programs: [
        { id: "program-1", title: "Программа образования (повышение квалификации)", url: "/assets/program-obrazovaniya-artkomm.pdf", isPublished: true }
      ]
    }
  }
};

export function cloneDeep(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
