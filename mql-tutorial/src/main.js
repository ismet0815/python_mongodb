import { lessons } from "./lessons.js";
import * as engine from "./engine.js";
import { celebrate } from "./confetti.js";
import { typeInto, typeIntoField, sleep } from "./typewriter.js";
import { createCountdown } from "./timer.js";
import carsData from "./data/cars.json";
import restaurantsData from "./data/restaurants.json";
import "./style.css";

const COLLECTIONS = { cars: carsData, restaurants: restaurantsData };
const PROGRESS_KEY = "mql-academy-progress";

const app = document.getElementById("app");

// --- Progress persistence (per-browser, purely local) ----------------------

function loadProgress() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveProgress(set) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable (private mode etc.) — progress just won't persist
  }
}

let completed = loadProgress();

// --- Small DOM/format helpers ----------------------------------------------

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatCell(value) {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number" && !Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}

function renderResultsTable(docs) {
  if (!docs || docs.length === 0) {
    return '<p class="empty-state">No documents matched — the result set is empty.</p>';
  }
  const keys = Object.keys(docs[0]);
  const capped = docs.slice(0, 30);
  const head = keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("");
  const rows = capped
    .map(
      (doc) =>
        `<tr>${keys.map((k) => `<td>${escapeHtml(formatCell(doc[k]))}</td>`).join("")}</tr>`
    )
    .join("");
  const more =
    docs.length > capped.length
      ? `<p class="muted">Showing ${capped.length} of ${docs.length} documents.</p>`
      : "";
  return `
    <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="result-count">${docs.length} document${docs.length === 1 ? "" : "s"}</p>
    ${more}
  `;
}

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mount(html) {
  app.innerHTML = `<div class="scene">${html}</div>`;
  return app.querySelector(".scene");
}

// --- Query engine glue -------------------------------------------------

function runLessonQuery(lesson, input) {
  const data = COLLECTIONS[lesson.collection];
  if (lesson.mode === "find") {
    return engine.find(data, input.filter || {}, {
      sort: input.sort,
      projection: input.projection,
      limit: input.limit,
    });
  }
  if (!Array.isArray(input)) {
    throw new Error("An aggregation pipeline must be a JSON array of stages.");
  }
  return engine.aggregate(data, input);
}

function gradeLesson(lesson, studentResults) {
  const expected = runLessonQuery(lesson, lesson.correctAnswer);
  return lesson.checkOrder
    ? engine.resultsMatchInOrder(studentResults, expected)
    : engine.resultsAreEquivalent(studentResults, expected);
}

// --- Scenes -----------------------------------------------------------

function renderStart() {
  const cards = lessons
    .map((lesson, i) => {
      const isDone = completed.has(lesson.id);
      const isUnlocked = i === 0 || completed.has(lessons[i - 1].id);
      const state = isDone ? "done" : isUnlocked ? "unlocked" : "locked";
      const icon = isDone ? "✓" : isUnlocked ? String(lesson.chapter) : "🔒";
      return `
        <button class="chapter-card ${state}" data-lesson-id="${lesson.id}" ${
        isUnlocked ? "" : "disabled"
      }>
          <span class="chapter-icon">${icon}</span>
          <span class="chapter-body">
            <span class="chapter-label">Chapter ${lesson.chapter}</span>
            <span class="chapter-title">${escapeHtml(lesson.title)}</span>
          </span>
        </button>`;
    })
    .join("");

  const allDone = lessons.every((l) => completed.has(l.id));

  const scene = mount(`
    <div class="start-screen">
      <p class="eyebrow">🍃 MongoDB Query Academy</p>
      <h1>Learn MQL by Doing</h1>
      <p class="subtitle">
        Six short chapters. Each one teaches a MongoDB query concept, then challenges
        you to write the real thing against sample data — cars for sale and Swiss
        restaurants. Beat the clock for full marks, or watch the replay if you get stuck.
      </p>
      ${allDone ? '<p class="all-done-banner">🎉 You\'ve completed every chapter — replay any of them below.</p>' : ""}
      <div class="chapter-grid">${cards}</div>
      <button class="link-btn" id="reset-progress">Reset progress</button>
    </div>
  `);

  scene.querySelectorAll(".chapter-card:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lesson = lessons.find((l) => l.id === btn.dataset.lessonId);
      playNarration(lesson);
    });
  });

  scene.querySelector("#reset-progress").addEventListener("click", () => {
    completed = new Set();
    saveProgress(completed);
    renderStart();
  });
}

async function playNarration(lesson) {
  const scene = mount(`
    <div class="cinema">
      <div class="letterbox top"></div>
      <div class="cinema-content">
        <p class="chapter-marker">Chapter ${lesson.chapter} · ${escapeHtml(lesson.title)}</p>
        <div class="narration-lines" id="narration-lines"></div>
        <div class="cinema-actions">
          <button class="ghost-btn" id="skip-narration">Skip ▶</button>
          <button class="primary-btn" id="begin-challenge" hidden>Begin Challenge →</button>
        </div>
      </div>
      <div class="letterbox bottom"></div>
    </div>
  `);

  const linesEl = scene.querySelector("#narration-lines");
  const skipBtn = scene.querySelector("#skip-narration");
  const beginBtn = scene.querySelector("#begin-challenge");
  const signal = { skip: false };
  skipBtn.addEventListener("click", () => {
    signal.skip = true;
  });

  for (const line of lesson.narration) {
    const p = document.createElement("p");
    p.className = "narration-line";
    linesEl.appendChild(p);
    await typeInto(p, line, { speed: 20, signal });
    await sleep(signal.skip ? 0 : 300);
  }

  skipBtn.hidden = true;
  beginBtn.hidden = false;
  beginBtn.addEventListener("click", () => renderChallenge(lesson));
}

function renderChallenge(lesson) {
  const scene = mount(`
    <div class="challenge">
      <div class="challenge-header">
        <p class="chapter-marker">Chapter ${lesson.chapter} · ${escapeHtml(lesson.title)}</p>
        <button class="ghost-btn small" id="back-to-map">← Chapters</button>
      </div>

      <div class="timer-row">
        <div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>
        <span class="timer-label" id="timer-label">${formatMMSS(lesson.timeLimitSeconds)}</span>
      </div>

      <p class="task-card">🎯 ${escapeHtml(lesson.task)}</p>

      <div class="editor-panel">
        <div class="editor-toolbar">
          <span class="collection-tag">db.${lesson.collection}.${
    lesson.mode === "find" ? "find" : "aggregate"
  }()</span>
          <button class="ghost-btn small" id="hint-btn">💡 Hint</button>
        </div>
        <textarea id="query-editor" spellcheck="false" class="query-editor">${lesson.starterTemplate}</textarea>
        <p class="hint-text" id="hint-text" hidden>${escapeHtml(lesson.hint)}</p>
      </div>

      <div class="challenge-actions">
        <button class="primary-btn" id="run-btn">▶ Run Query</button>
        <button class="ghost-btn" id="show-answer-btn">Show me the answer</button>
      </div>

      <div class="feedback" id="feedback"></div>
      <div class="results" id="results"></div>
    </div>
  `);

  scene.querySelector("#back-to-map").addEventListener("click", () => {
    countdown.stop();
    renderStart();
  });

  scene.querySelector("#hint-btn").addEventListener("click", () => {
    scene.querySelector("#hint-text").hidden = false;
  });

  const editor = scene.querySelector("#query-editor");
  const feedbackEl = scene.querySelector("#feedback");
  const resultsEl = scene.querySelector("#results");
  const timerFill = scene.querySelector("#timer-fill");
  const timerLabel = scene.querySelector("#timer-label");

  let solved = false;

  const countdown = createCountdown(lesson.timeLimitSeconds, {
    onTick(remaining, total) {
      timerLabel.textContent = formatMMSS(remaining);
      const pct = (remaining / total) * 100;
      timerFill.style.width = `${pct}%`;
      timerFill.classList.toggle("warn", pct <= 50 && pct > 20);
      timerFill.classList.toggle("danger", pct <= 20);
    },
    onExpire() {
      if (solved) return;
      playDemo(lesson, "timeout");
    },
  });
  countdown.start();

  scene.querySelector("#show-answer-btn").addEventListener("click", () => {
    if (solved) return;
    countdown.stop();
    playDemo(lesson, "skipped");
  });

  scene.querySelector("#run-btn").addEventListener("click", () => {
    if (solved) return;

    let parsed;
    try {
      parsed = JSON.parse(editor.value);
    } catch (err) {
      feedbackEl.innerHTML = `<p class="feedback-error">⚠ That's not valid JSON: ${escapeHtml(
        err.message
      )}</p>`;
      editor.classList.add("shake");
      setTimeout(() => editor.classList.remove("shake"), 400);
      return;
    }

    let results;
    try {
      results = runLessonQuery(lesson, parsed);
    } catch (err) {
      feedbackEl.innerHTML = `<p class="feedback-error">⚠ ${escapeHtml(err.message)}</p>`;
      return;
    }

    resultsEl.innerHTML = renderResultsTable(results);

    const isCorrect = gradeLesson(lesson, results);
    if (isCorrect) {
      solved = true;
      countdown.stop();
      completed.add(lesson.id);
      saveProgress(completed);
      celebrate();
      feedbackEl.innerHTML = `<p class="feedback-success">🎉 Hurra! That's correct!</p>`;
      resultsEl.classList.add("results-success");
      renderContinueBar(scene, lesson);
    } else {
      feedbackEl.innerHTML = `<p class="feedback-wrong">Not quite yet — you got ${results.length} document${
        results.length === 1 ? "" : "s"
      }. Check the task again and try once more.</p>`;
      editor.classList.add("shake");
      setTimeout(() => editor.classList.remove("shake"), 400);
    }
  });
}

function renderContinueBar(scene, lesson) {
  const actions = scene.querySelector(".challenge-actions");
  actions.innerHTML = `<button class="primary-btn" id="continue-btn">Continue →</button>`;
  scene.querySelector("#continue-btn").addEventListener("click", () => {
    goToNext(lesson);
  });
}

function goToNext(lesson) {
  const idx = lessons.findIndex((l) => l.id === lesson.id);
  const next = lessons[idx + 1];
  if (next) {
    playNarration(next);
  } else {
    renderFinale();
  }
}

async function playDemo(lesson, reason) {
  const scene = mount(`
    <div class="demo">
      <p class="chapter-marker">Chapter ${lesson.chapter} · ${escapeHtml(lesson.title)}</p>
      <p class="demo-banner">
        ${
          reason === "timeout"
            ? "⏳ Time's up! Let's walk through the answer together."
            : "👀 Let's walk through the answer together."
        }
      </p>
      <p class="task-card">🎯 ${escapeHtml(lesson.task)}</p>

      <div class="editor-panel">
        <div class="editor-toolbar">
          <span class="collection-tag">db.${lesson.collection}.${
    lesson.mode === "find" ? "find" : "aggregate"
  }()</span>
        </div>
        <textarea id="demo-editor" class="query-editor" readonly></textarea>
      </div>

      <div class="results" id="demo-results"></div>
      <div class="explanation" id="demo-explanation" hidden>
        <h3>Why this works</h3>
        <ul>${lesson.explanation.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
        <button class="primary-btn" id="demo-continue">Continue →</button>
      </div>
    </div>
  `);

  const editor = scene.querySelector("#demo-editor");
  const resultsEl = scene.querySelector("#demo-results");
  const explanationEl = scene.querySelector("#demo-explanation");

  const answerText = JSON.stringify(lesson.correctAnswer, null, 2);
  await sleep(600);
  await typeIntoField(editor, answerText, { speed: 12 });
  await sleep(300);

  const results = runLessonQuery(lesson, lesson.correctAnswer);
  resultsEl.innerHTML = renderResultsTable(results);
  resultsEl.classList.add("results-highlight");

  await sleep(400);
  explanationEl.hidden = false;

  scene.querySelector("#demo-continue").addEventListener("click", () => {
    completed.add(lesson.id);
    saveProgress(completed);
    goToNext(lesson);
  });
}

function renderFinale() {
  celebrate();
  mount(`
    <div class="finale">
      <p class="eyebrow">🍃 MongoDB Query Academy</p>
      <h1>🎓 Course Complete!</h1>
      <p class="subtitle">
        You've written filters, comparison operators, $in/$or, projections, sorts,
        and an aggregation pipeline — the same building blocks used in the
        <code>python_mongodb_cars.ipynb</code> and <code>python_mongodb_restaurants.ipynb</code>
        notebooks in this repository.
      </p>
      <button class="primary-btn" id="back-home">Back to Chapters</button>
    </div>
  `);
  document.getElementById("back-home").addEventListener("click", renderStart);
}

renderStart();
