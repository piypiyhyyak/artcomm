import { mountProblemTest } from "./testEngine";

export default function initTestPage() {
  mountProblemTest({
    questionWrap: document.getElementById("testQuestionWrap"),
    stepMeta: document.getElementById("testStepMeta"),
    progressBar: document.getElementById("testProgressBar"),
    nextButton: document.getElementById("testNext"),
    backButton: document.getElementById("testBack"),
    resultNode: document.getElementById("testResult"),
    onShowFormat: ({ recommendation }) => {
      const key = encodeURIComponent(recommendation?.key || "session");
      window.location.href = `/?modal=formats&recommendation=${key}`;
    }
  });
}
