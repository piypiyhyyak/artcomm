const TEST_STEPS = [
  {
    id: "profile",
    type: "single",
    title: "Вы из ...",
    options: [
      { text: "корпорации", value: "corporation" },
      { text: "органа власти", value: "government" }
    ]
  },
  {
    id: "problems",
    type: "multi",
    title: "Какие проблемы беспокоят?",
    options: [
      {
        text: "Сильная команда — слабая управляемость. Решения есть, но теряются на стыках подразделений.",
        value: "management"
      },
      {
        text: "Разрывы во взаимодействии. Информация передаётся медленно и искажается по пути.",
        value: "handoffs"
      },
      {
        text: "Руководителя слушают, но не слышат. Сигнал сверху не превращается в действия на местах.",
        value: "alignment"
      },
      {
        text: "Есть идеи — мало системных проектов. Потенциал сотрудников не превращается в устойчивый результат.",
        value: "projects"
      }
    ]
  }
];

const RECOMMENDATIONS = {
  session: {
    key: "session",
    title: "Управленческая сессия",
    duration: "2–4 часа",
    anchor: "format-session"
  },
  foresight: {
    key: "foresight",
    title: "Проектная форсайт-сессия",
    duration: "1–2 дня",
    anchor: "format-foresight"
  },
  acceleration: {
    key: "acceleration",
    title: "Акселерация",
    duration: "1–12 месяцев",
    anchor: "format-acceleration"
  }
};

function getRecommendation(problemCount) {
  if (problemCount >= 4) {
    return RECOMMENDATIONS.acceleration;
  }

  if (problemCount >= 2) {
    return RECOMMENDATIONS.foresight;
  }

  return RECOMMENDATIONS.session;
}

function createOptionButton({ text, selected, onClick }) {
  const optionButton = document.createElement("button");
  optionButton.type = "button";
  optionButton.className = `test-option${selected ? " is-selected" : ""}`;
  optionButton.setAttribute("aria-pressed", selected ? "true" : "false");

  const indicator = document.createElement("span");
  indicator.className = "test-option-indicator";
  indicator.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "test-option-label";
  label.textContent = text;

  optionButton.appendChild(indicator);
  optionButton.appendChild(label);
  optionButton.addEventListener("click", onClick);
  return optionButton;
}

export function mountProblemTest({ questionWrap, stepMeta, progressBar, nextButton, backButton, resultNode, onShowFormat }) {
  if (!questionWrap || !progressBar || !nextButton || !backButton || !resultNode) {
    return null;
  }

  const stageRoot = questionWrap.closest(".test-stage");
  const shellRoot = questionWrap.closest(".test-shell");

  const state = {
    index: 0,
    answers: {
      profile: "",
      problems: []
    }
  };

  function isCurrentStepValid() {
    const currentStep = TEST_STEPS[state.index];
    if (!currentStep) {
      return false;
    }

    if (currentStep.id === "profile") {
      return Boolean(state.answers.profile);
    }

    return state.answers.problems.length > 0;
  }

  function syncStepUi() {
    const progress = ((state.index + 1) / TEST_STEPS.length) * 100;
    progressBar.style.width = `${progress}%`;
    if (stepMeta) {
      stepMeta.textContent = `Шаг ${state.index + 1} из ${TEST_STEPS.length}`;
    }
    backButton.disabled = state.index === 0;
    nextButton.disabled = !isCurrentStepValid();
    nextButton.textContent = state.index === TEST_STEPS.length - 1 ? "Показать результат" : "Далее";
    backButton.hidden = false;
    nextButton.hidden = false;
  }

  function renderQuestion() {
    const step = TEST_STEPS[state.index];
    if (!step) {
      return;
    }

    questionWrap.hidden = false;
    resultNode.hidden = true;
    resultNode.innerHTML = "";
    questionWrap.innerHTML = "";
    stageRoot?.classList.remove("is-result-view");
    shellRoot?.classList.remove("is-result-view");

    const title = document.createElement("p");
    title.className = "test-question";
    title.textContent = step.title;

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "test-options";

    step.options.forEach((option) => {
      const isSelected =
        step.type === "single"
          ? state.answers.profile === option.value
          : state.answers.problems.includes(option.value);

      const button = createOptionButton({
        text: option.text,
        selected: isSelected,
        onClick: () => {
          if (step.type === "single") {
            state.answers.profile = option.value;
          } else if (isSelected) {
            state.answers.problems = state.answers.problems.filter((item) => item !== option.value);
          } else {
            state.answers.problems = [...state.answers.problems, option.value];
          }
          renderQuestion();
        }
      });

      optionsWrap.appendChild(button);
    });

    questionWrap.appendChild(title);
    questionWrap.appendChild(optionsWrap);
    syncStepUi();
  }

  function reset() {
    state.index = 0;
    state.answers = {
      profile: "",
      problems: []
    };
    renderQuestion();
  }

  function renderResult() {
    const recommendation = getRecommendation(state.answers.problems.length);
    const profileLabel = state.answers.profile === "government" ? "органа власти" : "корпорации";

    questionWrap.hidden = true;
    resultNode.hidden = false;
    resultNode.innerHTML = "";
    stageRoot?.classList.add("is-result-view");
    shellRoot?.classList.add("is-result-view");
    progressBar.style.width = "100%";
    if (stepMeta) {
      stepMeta.textContent = "Результат";
    }

    const kicker = document.createElement("p");
    kicker.className = "test-result-kicker";
    kicker.textContent = "Рекомендуемый формат";

    const title = document.createElement("h3");
    title.textContent = recommendation.title;

    const duration = document.createElement("p");
    duration.className = "test-result-meta";
    duration.textContent = `${recommendation.duration} · ${profileLabel}`;

    const summary = document.createElement("p");
    summary.className = "test-result-note";
    summary.textContent = "Сейчас этот формат лучше всего подходит под отмеченные вами запросы и поможет быстрее собрать команду в рабочий ритм.";

    const actions = document.createElement("div");
    actions.className = "test-result-actions";

    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.className = "btn btn-secondary";
    restartButton.textContent = "Пройти тест заново";
    restartButton.addEventListener("click", reset);

    const formatButton = document.createElement("button");
    formatButton.type = "button";
    formatButton.className = "btn btn-primary";
    formatButton.textContent = "Посмотреть формат";
    formatButton.addEventListener("click", () => {
      if (typeof onShowFormat === "function") {
        onShowFormat({
          profile: state.answers.profile,
          problems: [...state.answers.problems],
          recommendation
        });
      }
    });

    actions.appendChild(restartButton);
    actions.appendChild(formatButton);

    resultNode.className = "test-result";
    resultNode.appendChild(kicker);
    resultNode.appendChild(title);
    resultNode.appendChild(duration);
    resultNode.appendChild(summary);
    resultNode.appendChild(actions);

    backButton.hidden = true;
    nextButton.hidden = true;
  }

  backButton.addEventListener("click", () => {
    if (state.index === 0) {
      return;
    }

    state.index -= 1;
    renderQuestion();
  });

  nextButton.addEventListener("click", () => {
    if (!isCurrentStepValid()) {
      return;
    }

    if (state.index === TEST_STEPS.length - 1) {
      renderResult();
      return;
    }

    state.index += 1;
    renderQuestion();
  });

  reset();

  return { reset };
}
