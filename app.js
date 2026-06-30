const STORAGE_KEY = "english-review-cards:v1";

const view = {
  mode: "study",
  filter: "all",
  testType: "mixed",
  index: 0,
  revealed: false,
  selected: null,
  typedAnswer: "",
};

const els = {};
let payload = null;
let cards = [];
let testItems = [];
let cardById = new Map();
let state = loadState();

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();

  try {
    const response = await fetch("./data/cards.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
    cards = payload.cards;
    cardById = new Map(cards.map((card) => [card.id, card]));
    testItems = buildTestItems(cards);
    populateFilters();
    render();
    registerServiceWorker();
  } catch (error) {
    renderFatalError(error);
  }
}

function bindElements() {
  els.dataSummary = document.querySelector("#dataSummary");
  els.filterSelect = document.querySelector("#filterSelect");
  els.testTypeSelect = document.querySelector("#testTypeSelect");
  els.testTypeField = document.querySelector("#testTypeField");
  els.starButton = document.querySelector("#starButton");
  els.positionText = document.querySelector("#positionText");
  els.resultText = document.querySelector("#resultText");
  els.cardHost = document.querySelector("#cardHost");
  els.prevButton = document.querySelector("#prevButton");
  els.nextButton = document.querySelector("#nextButton");
  els.randomButton = document.querySelector("#randomButton");
  els.modeTabs = Array.from(document.querySelectorAll("[data-mode]"));
}

function bindEvents() {
  els.modeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      view.mode = button.dataset.mode;
      resetPosition();
      render();
    });
  });

  els.filterSelect.addEventListener("change", () => {
    view.filter = els.filterSelect.value;
    resetPosition();
    render();
  });

  els.testTypeSelect.addEventListener("change", () => {
    view.testType = els.testTypeSelect.value;
    resetPosition();
    render();
  });

  els.starButton.addEventListener("click", () => {
    const card = getCurrentCard();
    if (!card) return;
    toggleStar(card.id);
    render();
  });

  els.prevButton.addEventListener("click", () => move(-1));
  els.nextButton.addEventListener("click", () => move(1));
  els.randomButton.addEventListener("click", randomCard);

  els.cardHost.addEventListener("input", (event) => {
    if (event.target.id === "attemptInput") {
      view.typedAnswer = event.target.value;
    }
  });

  els.cardHost.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    handleCardAction(actionButton);
  });
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      starred: stored.starred || {},
      itemStats: stored.itemStats || {},
    };
  } catch {
    return { starred: {}, itemStats: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function populateFilters() {
  const options = [
    ["all", "全部"],
    ["type:rewrite", "组合句 Ex1-3"],
    ["type:correction", "Ex4 正误"],
    ["type:quiz", "雨课堂"],
    ["section:Exercise 1", "Exercise 1"],
    ["section:Exercise 2", "Exercise 2"],
    ["section:Exercise 3", "Exercise 3"],
    ["section:Exercise 4", "Exercise 4"],
    ["section:雨课堂1", "雨课堂1"],
    ["section:雨课堂2", "雨课堂2"],
    ["section:雨课堂3", "雨课堂3"],
    ["section:雨课堂4", "雨课堂4"],
    ["section:雨课堂5", "雨课堂5"],
    ["section:雨课堂6", "雨课堂6"],
  ];

  els.filterSelect.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
}

function buildTestItems(sourceCards) {
  const items = [];

  for (const card of sourceCards) {
    if (card.type === "rewrite") {
      items.push({
        id: `combine:${card.id}`,
        type: "combine",
        cardId: card.id,
        title: `${card.title} 组合`,
        section: card.section,
      });
    }

    if (card.type === "correction") {
      items.push({
        id: `judge:${card.id}:original`,
        type: "judge",
        cardId: card.id,
        title: `${card.title} 原句判断`,
        presented: card.original,
        isCorrect: false,
        section: card.section,
      });
      items.push({
        id: `judge:${card.id}:answer`,
        type: "judge",
        cardId: card.id,
        title: `${card.title} 改正句判断`,
        presented: card.answer,
        isCorrect: true,
        section: card.section,
      });
    }

    if (card.type === "quiz") {
      for (const option of card.options) {
        items.push({
          id: `quiz-judge:${card.id}:${option.label}`,
          type: "quizJudge",
          cardId: card.id,
          title: `${card.title} ${option.label} 判断`,
          option,
          isCorrect: option.label === card.answer,
          section: card.section,
        });
      }

      items.push({
        id: `quiz-choice:${card.id}`,
        type: "quizChoice",
        cardId: card.id,
        title: `${card.title} 四选一`,
        section: card.section,
      });
    }
  }

  return items;
}

function render() {
  if (!payload) return;

  els.dataSummary.textContent = `${payload.summary.total} 张卡 · ${testItems.length} 个测试项`;
  els.modeTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === view.mode);
  });
  els.testTypeField.classList.toggle("is-hidden", view.mode === "study" || view.mode === "starred");

  const list = getCurrentList();
  clampIndex(list.length);
  updateProgress(list);
  updateStarButton();

  if (!list.length) {
    renderEmpty();
    return;
  }

  if (view.mode === "study" || view.mode === "starred") {
    els.cardHost.innerHTML = renderStudyCard(list[view.index]);
  } else {
    els.cardHost.innerHTML = renderTestItem(list[view.index]);
  }
}

function getCurrentList() {
  if (view.mode === "study") {
    return cards.filter(matchesCardFilter);
  }

  if (view.mode === "starred") {
    return cards.filter((card) => state.starred[card.id] && matchesCardFilter(card));
  }

  if (view.mode === "wrong") {
    return testItems.filter((item) => {
      const stat = state.itemStats[item.id];
      return stat?.lastResult === "wrong" && matchesItemFilter(item) && matchesTestType(item);
    });
  }

  return testItems.filter((item) => matchesItemFilter(item) && matchesTestType(item));
}

function matchesCardFilter(card) {
  if (view.filter === "all") return true;
  if (view.filter.startsWith("type:")) return card.type === view.filter.slice(5);
  if (view.filter.startsWith("section:")) return card.section === view.filter.slice(8);
  return true;
}

function matchesItemFilter(item) {
  const card = cardById.get(item.cardId);
  return card ? matchesCardFilter(card) : false;
}

function matchesTestType(item) {
  if (view.testType === "mixed") {
    return item.type === "combine" || item.type === "judge" || item.type === "quizJudge";
  }
  if (view.testType === "combine") return item.type === "combine";
  if (view.testType === "judge") return item.type === "judge";
  if (view.testType === "quizJudge") return item.type === "quizJudge";
  if (view.testType === "quizChoice") return item.type === "quizChoice";
  return true;
}

function getCurrentCard() {
  const list = getCurrentList();
  const current = list[view.index];
  if (!current) return null;
  return current.cardId ? cardById.get(current.cardId) : current;
}

function updateProgress(list) {
  els.positionText.textContent = list.length ? `${view.index + 1} / ${list.length}` : "0 / 0";

  const current = list[view.index];
  if (!current) {
    els.resultText.textContent = "暂无内容";
    return;
  }

  if (current.cardId) {
    const stat = state.itemStats[current.id];
    els.resultText.textContent = stat
      ? `已练 ${stat.attempts} 次 · 对 ${stat.correct} · 错 ${stat.wrong}`
      : "还没练过";
    return;
  }

  const labelMap = { rewrite: "组合句对照", correction: "改错对照", quiz: "雨课堂对照" };
  els.resultText.textContent = labelMap[current.type] || "学习";
}

function updateStarButton() {
  const card = getCurrentCard();
  const starred = card ? Boolean(state.starred[card.id]) : false;
  els.starButton.disabled = !card;
  els.starButton.textContent = starred ? "★" : "☆";
  els.starButton.classList.toggle("is-starred", starred);
}

function renderEmpty() {
  const message =
    view.mode === "wrong"
      ? "现在没有错题。做几道测试后，这里会自动收集最近答错或标记不会的题。"
      : "当前筛选下没有卡片。";
  els.cardHost.innerHTML = `
    <article class="empty-state">
      <h2>空空如也</h2>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

function renderFatalError(error) {
  els.positionText.textContent = "0 / 0";
  els.resultText.textContent = "数据载入失败";
  els.cardHost.innerHTML = `
    <article class="empty-state">
      <h2>没有读到卡片数据</h2>
      <p>请用本地服务器打开 memory-cards/index.html，而不是直接双击 HTML 文件。</p>
      <p>${escapeHtml(error.message)}</p>
    </article>
  `;
}

function renderStudyCard(card) {
  const tags = renderTags([card.source, card.section, card.promptKind]);
  if (card.type === "rewrite") {
    return `
      <article class="study-surface">
        ${renderSurfaceHead(card.title, tags)}
        <div class="compare-stack two-column">
          ${renderPane("正文", card.original.en, card.original.zh)}
          ${renderPane("改写", card.answer.en, card.answer.zh, "answer")}
        </div>
        ${renderAlternatives(card.alternatives)}
      </article>
    `;
  }

  if (card.type === "correction") {
    return `
      <article class="study-surface">
        ${renderSurfaceHead(card.title, tags)}
        <div class="compare-stack two-column">
          ${renderPane("原句", card.original.en, card.original.zh, "warning")}
          ${renderPane("改正", card.answer.en, card.answer.zh, "answer")}
        </div>
      </article>
    `;
  }

  return `
    <article class="study-surface">
      ${renderSurfaceHead(card.title, tags)}
      ${renderQuizPrompt(card)}
      ${renderOptions(card.options, card.answer)}
      <p class="answer-note">答案：${escapeHtml(card.answer)}</p>
    </article>
  `;
}

function renderTestItem(item) {
  const card = cardById.get(item.cardId);
  if (!card) return "";

  if (item.type === "combine") return renderCombineTest(item, card);
  if (item.type === "judge") return renderJudgeTest(item, card);
  if (item.type === "quizJudge") return renderQuizJudgeTest(item, card);
  if (item.type === "quizChoice") return renderQuizChoiceTest(item, card);
  return "";
}

function renderCombineTest(item, card) {
  const tags = renderTags(["测试", card.section, "组合句"]);
  const attempt = view.typedAnswer.trim();
  return `
    <article class="study-surface">
      ${renderSurfaceHead(item.title, tags)}
      ${renderPane("请组合这些句子", card.original.en, card.original.zh)}
      <div class="attempt-box">
        <label class="label" for="attemptInput">你的组合句</label>
        <textarea id="attemptInput" placeholder="可以在这里写，也可以只在心里默写。">${escapeHtml(view.typedAnswer)}</textarea>
      </div>
      ${
        view.revealed
          ? `
            ${attempt ? `<p class="answer-note">你的答案：${escapeHtml(attempt)}</p>` : ""}
            ${renderPane("参考答案", card.answer.en, card.answer.zh, "answer")}
            ${renderAlternatives(card.alternatives)}
            <div class="self-grade">
              <button class="primary-action" type="button" data-action="grade" data-value="correct">会</button>
              <button class="danger-action" type="button" data-action="grade" data-value="wrong">不会</button>
            </div>
          `
          : `
            <div class="test-actions">
              <button class="primary-action" type="button" data-action="reveal">看参考答案</button>
              <button type="button" data-action="grade" data-value="wrong">先标不会</button>
            </div>
          `
      }
    </article>
  `;
}

function renderJudgeTest(item, card) {
  const tags = renderTags(["测试", "正误判断", card.section]);
  const selected = view.selected;
  const answered = view.revealed;
  const correctText = item.isCorrect ? "正确" : "错误";
  return `
    <article class="study-surface">
      ${renderSurfaceHead(item.title, tags)}
      ${renderPane("判断这句话是否正确", item.presented.en, item.presented.zh, item.isCorrect ? "answer" : "warning")}
      ${
        answered
          ? `
            <p class="feedback">${selected === item.isCorrect ? "判断正确。" : "这题判断错了。"} 正确答案：${correctText}。</p>
            ${renderPane("对照改正", card.answer.en, card.answer.zh, "answer")}
          `
          : `
            <div class="test-actions">
              <button class="primary-action" type="button" data-action="judge" data-value="true">正确</button>
              <button class="danger-action" type="button" data-action="judge" data-value="false">错误</button>
            </div>
          `
      }
    </article>
  `;
}

function renderQuizJudgeTest(item, card) {
  const tags = renderTags(["测试", card.section, "选项判断"]);
  const answered = view.revealed;
  const selected = view.selected;
  const correctText = item.isCorrect ? "是" : "不是";
  return `
    <article class="study-surface">
      ${renderSurfaceHead(item.title, tags)}
      ${renderQuizPrompt(card)}
      ${renderPane(`选项 ${item.option.label}`, item.option.text, item.option.zh)}
      ${
        answered
          ? `
            <p class="feedback">${selected === item.isCorrect ? "判断正确。" : "这题判断错了。"} 这个选项${correctText}本题答案；本题答案：${escapeHtml(card.answer)}。</p>
            ${renderOptions(card.options, card.answer)}
          `
          : `
            <div class="test-actions">
              <button class="primary-action" type="button" data-action="judge" data-value="true">是本题答案</button>
              <button class="danger-action" type="button" data-action="judge" data-value="false">不是</button>
            </div>
          `
      }
    </article>
  `;
}

function renderQuizChoiceTest(item, card) {
  const tags = renderTags(["测试", card.section, "四选一"]);
  const answered = view.revealed;
  return `
    <article class="study-surface">
      ${renderSurfaceHead(item.title, tags)}
      ${renderQuizPrompt(card)}
      <div class="choice-grid">
        ${card.options
          .map((option) => {
            const picked = view.selected === option.label;
            const resultClass = answered && option.label === card.answer ? " correct" : "";
            const pickedClass = picked ? " is-picked" : "";
            return `
              <button class="choice-button${pickedClass}${resultClass}" type="button" data-action="quiz-choice" data-value="${escapeHtml(option.label)}">
                <span class="option-letter">${escapeHtml(option.label)}</span>
                <span>${escapeHtml(option.text)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      ${
        answered
          ? `<p class="feedback">${view.selected === card.answer ? "选择正确。" : "这题选错了。"} 正确答案：${escapeHtml(card.answer)}。</p>${renderOptions(card.options, card.answer)}`
          : ""
      }
    </article>
  `;
}

function renderSurfaceHead(title, tags) {
  return `
    <div class="surface-head">
      <div class="title-block">
        <h2>${escapeHtml(title)}</h2>
        ${tags}
      </div>
    </div>
  `;
}

function renderPane(label, english, chinese, tone = "") {
  const toneClass = tone ? ` ${tone}` : "";
  return `
    <section class="pane${toneClass}">
      <span class="label">${escapeHtml(label)}</span>
      <p class="english">${escapeHtml(english)}</p>
      ${chinese ? `<p class="chinese">${escapeHtml(chinese)}</p>` : ""}
    </section>
  `;
}

function renderAlternatives(alternatives = []) {
  if (!alternatives.length) return "";
  return `
    <div class="compare-stack">
      ${alternatives.map((alt) => renderPane("另一种改法", alt.en, alt.zh, "answer")).join("")}
    </div>
  `;
}

function renderQuizPrompt(card) {
  return `
    ${renderPane("题干", card.question, card.questionZh)}
    ${card.context ? renderPane("段落", card.context.en, card.context.zh) : ""}
  `;
}

function renderOptions(options, answer) {
  return `
    <ul class="option-list">
      ${options
        .map((option) => {
          const tone = option.label === answer ? " correct" : "";
          return `
            <li class="option${tone}">
              <span class="option-letter">${escapeHtml(option.label)}</span>
              <div>
                <p class="english">${escapeHtml(option.text)}</p>
                ${option.zh ? `<p class="chinese">${escapeHtml(option.zh)}</p>` : ""}
              </div>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderTags(tags) {
  return `<div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function handleCardAction(button) {
  const item = getCurrentList()[view.index];
  if (!item) return;

  if (button.dataset.action === "reveal") {
    const input = document.querySelector("#attemptInput");
    view.typedAnswer = input ? input.value : view.typedAnswer;
    view.revealed = true;
    render();
    return;
  }

  if (button.dataset.action === "grade") {
    const input = document.querySelector("#attemptInput");
    view.typedAnswer = input ? input.value : view.typedAnswer;
    recordResult(item.id, button.dataset.value === "correct");
    view.revealed = true;
    render();
    return;
  }

  if (button.dataset.action === "judge") {
    const selected = button.dataset.value === "true";
    view.selected = selected;
    view.revealed = true;
    recordResult(item.id, selected === item.isCorrect);
    render();
    return;
  }

  if (button.dataset.action === "quiz-choice") {
    const card = cardById.get(item.cardId);
    view.selected = button.dataset.value;
    view.revealed = true;
    recordResult(item.id, view.selected === card.answer);
    render();
  }
}

function recordResult(itemId, isCorrect) {
  const stat = state.itemStats[itemId] || {
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastResult: null,
    updatedAt: null,
  };

  stat.attempts += 1;
  if (isCorrect) {
    stat.correct += 1;
    stat.lastResult = "correct";
  } else {
    stat.wrong += 1;
    stat.lastResult = "wrong";
  }
  stat.updatedAt = new Date().toISOString();
  state.itemStats[itemId] = stat;
  saveState();
}

function toggleStar(cardId) {
  if (state.starred[cardId]) {
    delete state.starred[cardId];
  } else {
    state.starred[cardId] = true;
  }
  saveState();
}

function move(offset) {
  const list = getCurrentList();
  if (!list.length) return;
  view.index = (view.index + offset + list.length) % list.length;
  resetAnswerState();
  render();
}

function randomCard() {
  const list = getCurrentList();
  if (!list.length) return;
  if (list.length === 1) {
    view.index = 0;
  } else {
    let next = view.index;
    while (next === view.index) {
      next = Math.floor(Math.random() * list.length);
    }
    view.index = next;
  }
  resetAnswerState();
  render();
}

function resetPosition() {
  view.index = 0;
  resetAnswerState();
}

function resetAnswerState() {
  view.revealed = false;
  view.selected = null;
  view.typedAnswer = "";
}

function clampIndex(length) {
  if (length === 0) {
    view.index = 0;
    return;
  }
  if (view.index >= length) view.index = length - 1;
  if (view.index < 0) view.index = 0;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function registerServiceWorker() {
  const canRegister =
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");
  if (!canRegister) return;

  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The app still works online if PWA caching is unavailable.
  });
}
