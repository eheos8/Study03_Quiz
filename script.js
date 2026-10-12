/* ===== 순수 로직 (DOM과 무관) ===== */

const CATEGORIES = ["한국사", "세계지리", "과학", "예술과 문화"];
const ROUND_SIZE = 10;
const SPEED_SECONDS = 15;
const BOARD_LIMIT = 10;
const MODES = ["practice", "speed", "hint"];
const MODE_LABELS = { practice: "연습", speed: "스피드", hint: "힌트" };
const MODE_DESCRIPTIONS = {
  practice: "시간 제한·힌트 없음 · 순위표에 기록되지 않음",
  speed: "문항마다 15초",
  hint: "문항마다 힌트 1번",
};
const NO_RECORD_NOTICE = "순위표에 기록되지 않음";

// Fisher–Yates. 입력을 바꾸지 않고 새 배열을 돌려준다.
function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isFilled(value) {
  return typeof value === "string" && value.trim() !== "";
}

// 문항 하나하나의 형식을 검사한다. 오류 메시지 배열을 돌려주고, 비어 있으면 정상이다.
function validateQuestions(list) {
  const errors = [];
  const seen = new Set();
  for (const q of list) {
    const id = isFilled(q && q.id) ? q.id : "(id 없음)";
    const problems = [];
    if (id === "(id 없음)") problems.push("id가 비어 있음");
    else if (seen.has(id)) problems.push("id가 중복됨");
    seen.add(id);
    if (!CATEGORIES.includes(q.category)) problems.push(`알 수 없는 카테고리: ${q.category}`);
    if (!isFilled(q.question)) problems.push("문제가 비어 있음");
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      problems.push("보기는 정확히 4개여야 함");
    } else {
      if (!q.choices.every(isFilled)) problems.push("비어 있는 보기가 있음");
      if (new Set(q.choices).size !== q.choices.length) problems.push("보기가 서로 중복됨");
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push("answer는 0~3의 정수여야 함");
    if (!isFilled(q.explanation)) problems.push("해설이 비어 있음");
    if (!isFilled(q.source)) problems.push("출처(source)가 비어 있음");
    for (const p of problems) errors.push(`${id}: ${p}`);
  }
  return errors;
}

// 카테고리마다 정확히 ROUND_SIZE(10)개인지 검사한다.
function validateCounts(list) {
  const errors = [];
  for (const c of CATEGORIES) {
    const n = list.filter((q) => q.category === c).length;
    if (n !== ROUND_SIZE) errors.push(`${c}: ${ROUND_SIZE}개여야 하는데 ${n}개`);
  }
  return errors;
}

/* ----- 판 구성 ----- */

// RoundItem의 보기를 다시 섞는다. 정답 보기의 글자는 그대로이고 answerIndex만 새 위치로 맞춘다.
function shuffleItem(item, rng = Math.random) {
  const order = shuffle([0, 1, 2, 3], rng); // order[새 위치] = 옛 위치
  return {
    ...item,
    choices: order.map((oldIndex) => item.choices[oldIndex]),
    answerIndex: order.indexOf(item.answerIndex),
  };
}

// 카테고리에서 문항 10개를 무작위 순서로 뽑고 보기도 섞는다.
function buildRound(questions, category, rng = Math.random) {
  const pool = questions.filter((q) => q.category === category);
  if (pool.length < ROUND_SIZE) {
    throw new Error(`${category}: 문항이 ${ROUND_SIZE}개 미만입니다 (${pool.length}개)`);
  }
  return shuffle(pool, rng)
    .slice(0, ROUND_SIZE)
    .map((q) =>
      shuffleItem(
        {
          id: q.id,
          question: q.question,
          choices: q.choices,
          answerIndex: q.answer,
          explanation: q.explanation,
          source: q.source,
        },
        rng
      )
    );
}

/* ----- 점수와 판 상태 ----- */

function scoreFor(mode, correct, hintUsed) {
  if (mode !== "practice" && mode !== "speed" && mode !== "hint") throw new Error(`알 수 없는 모드: ${mode}`);
  if (!correct) return 0;
  return mode === "hint" && hintUsed ? 0.5 : 1;
}

function newGame(items, mode) {
  return {
    mode,
    items,
    index: 0,
    score: 0,
    wrong: [],
    answered: false,
    hintUsed: false,
    finished: false,
  };
}

// 현재 문항에 답한다. choiceIndex가 null이면 시간 초과(오답). 이미 답했거나 끝난 판이면 null을 돌려주고 아무것도 바꾸지 않는다.
function recordAnswer(state, choiceIndex) {
  if (state.finished || state.answered) return null;
  const item = state.items[state.index];
  const correct = choiceIndex === item.answerIndex;
  const points = scoreFor(state.mode, correct, state.hintUsed);
  state.answered = true;
  state.score += points;
  if (!correct) state.wrong.push(item);
  return { correct, points, answerIndex: item.answerIndex };
}

// 답한 뒤에만 다음 문항으로 간다. 답하기 전(연타 포함)이면 false.
function nextQuestion(state) {
  if (state.finished || !state.answered) return false;
  state.index += 1;
  state.answered = false;
  state.hintUsed = false;
  if (state.index >= state.items.length) state.finished = true;
  return true;
}

// 힌트를 쓴다. 힌트 모드에서 이번 문항에 아직 안 썼고 답하기 전일 때만, 지울 보기 인덱스 2개(오답)를 돌려준다.
function useHint(state, rng = Math.random) {
  if (state.mode !== "hint" || state.hintUsed || state.answered || state.finished) return null;
  const item = state.items[state.index];
  const wrongIndexes = [0, 1, 2, 3].filter((i) => i !== item.answerIndex);
  state.hintUsed = true;
  return shuffle(wrongIndexes, rng).slice(0, 2);
}

// 스피드 모드 남은 초. 시작 시각과 현재 시각의 차이로 계산해 탭이 백그라운드여도 어긋나지 않는다.
function secondsLeft(startMs, nowMs, limitSeconds = SPEED_SECONDS) {
  return Math.max(0, Math.ceil(limitSeconds - (nowMs - startMs) / 1000));
}

function formatScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/* ----- 틀린 문제 다시 풀기 (점수 없는 복습) ----- */

// 틀린 문항만 무작위 순서로 한 바퀴 돈다. 맞히면 빠지고 틀리면 다음 바퀴에 다시 나오며, 모두 맞히면 끝난다.
function createRetry(wrongItems, rng = Math.random) {
  const pass = shuffle(wrongItems, rng).map((item) => shuffleItem(item, rng));
  return { pass, pos: 0, missed: [], answered: false, done: pass.length === 0, rng };
}

function retryCurrent(retry) {
  return retry.done ? null : retry.pass[retry.pos];
}

// 이미 답했거나 끝났으면 null(이중 입력 방지).
function retryAnswer(retry, choiceIndex) {
  if (retry.done || retry.answered) return null;
  const item = retry.pass[retry.pos];
  const correct = choiceIndex === item.answerIndex;
  if (!correct) retry.missed.push(item);
  retry.answered = true;
  return { correct, answerIndex: item.answerIndex };
}

// 답한 뒤에만 다음으로 간다. 한 바퀴가 끝났을 때 틀린 것이 없으면 done, 있으면 그것들로 새 바퀴를 시작한다.
function retryNext(retry) {
  if (retry.done || !retry.answered) return false;
  retry.pos += 1;
  retry.answered = false;
  if (retry.pos >= retry.pass.length) {
    if (retry.missed.length === 0) {
      retry.done = true;
    } else {
      retry.pass = shuffle(retry.missed, retry.rng).map((item) => shuffleItem(item, retry.rng));
      retry.pos = 0;
      retry.missed = [];
    }
  }
  return true;
}

/* ----- 순위표 ----- */

// 표에 기록을 넣는다. 점수 높은 순이고 같은 점수면 새 기록이 위다. limit을 넘으면 맨 아래를 버린다.
// 새 기록이 들지 못하면 rank는 null이고 table은 그대로다. 입력 표는 바꾸지 않는다.
function addRecord(table, record, limit = BOARD_LIMIT) {
  const found = table.findIndex((r) => r.score <= record.score);
  const position = found === -1 ? table.length : found;
  if (position >= limit) return { table: table.slice(), rank: null };
  const next = [...table.slice(0, position), record, ...table.slice(position)].slice(0, limit);
  return { table: next, rank: position + 1 };
}

// 닉네임은 앞뒤 공백을 지운 뒤 1~12자(이모지 등도 한 글자로 셈)여야 한다. 아니면 null.
function normalizeNickname(input) {
  if (typeof input !== "string") return null;
  const name = input.trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= 12 ? name : null;
}

// 로컬 날짜를 YYYY-MM-DD로 쓴다.
function todayString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ----- 저장소 (localStorage) ----- */
// 모든 읽기·쓰기·JSON 해석은 try/catch로 감싼다. 저장소가 막혔거나 값이 깨져 있어도 앱이 멈추지 않는다.

const STORAGE_PREFIX = "quiz:v1:";
const NICKNAME_KEY = `${STORAGE_PREFIX}nickname`;

function boardKey(mode, category) {
  return `${STORAGE_PREFIX}board:${mode}:${category}`;
}

// 브라우저의 localStorage. 접근이 막혔거나 window가 없으면 null.
function getStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch (error) {
    return null;
  }
}

function isRecord(r) {
  return (
    r !== null &&
    typeof r === "object" &&
    typeof r.nickname === "string" &&
    typeof r.score === "number" &&
    Number.isFinite(r.score) &&
    typeof r.date === "string"
  );
}

// ok=false는 저장소를 읽을 수 없다는 뜻이다(이때 저장하면 기존 기록을 덮어쓸 수 있으니 저장하지 않는다).
// 값이 없거나 깨져 있으면 ok=true에 빈 표다.
function readBoard(storage, mode, category) {
  if (!storage) return { ok: false, table: [] };
  let raw;
  try {
    raw = storage.getItem(boardKey(mode, category));
  } catch (error) {
    return { ok: false, table: [] };
  }
  if (raw === null || raw === undefined) return { ok: true, table: [] };
  try {
    const data = JSON.parse(raw);
    return { ok: true, table: Array.isArray(data) ? data.filter(isRecord).slice(0, BOARD_LIMIT) : [] };
  } catch (error) {
    return { ok: true, table: [] };
  }
}

function loadBoard(storage, mode, category) {
  return readBoard(storage, mode, category).table;
}

function saveBoard(storage, mode, category, table) {
  if (!storage) return false;
  try {
    storage.setItem(boardKey(mode, category), JSON.stringify(table));
    return true;
  } catch (error) {
    return false;
  }
}

function loadNickname(storage) {
  if (!storage) return null;
  try {
    return normalizeNickname(storage.getItem(NICKNAME_KEY));
  } catch (error) {
    return null;
  }
}

function saveNickname(storage, name) {
  const nickname = normalizeNickname(name);
  if (!storage || nickname === null) return false;
  try {
    storage.setItem(NICKNAME_KEY, nickname);
    return true;
  } catch (error) {
    return false;
  }
}

// 기록을 표에 넣고 저장한다. 연습 모드는 기록하지 않으므로 Error.
// status: ranked(순위에 듦) | outside(상위 10건에 못 듦) | unavailable(저장소를 쓸 수 없음)
function recordResult(storage, mode, category, record) {
  if (mode === "practice") throw new Error("연습 모드는 순위표에 기록하지 않습니다");
  const current = readBoard(storage, mode, category);
  if (!current.ok) return { status: "unavailable", rank: null };
  const { table, rank } = addRecord(current.table, record);
  if (rank === null) return { status: "outside", rank: null };
  return saveBoard(storage, mode, category, table)
    ? { status: "ranked", rank }
    : { status: "unavailable", rank: null };
}

/* ===== 화면 (브라우저 전용) ===== */

const app = { mode: "practice", category: null, state: null, retry: null, nickname: null, recorded: false };

function showScreen(name) {
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== `screen-${name}`;
}

// 데이터 검사 오류를 화면에 보여 주고 퀴즈는 시작하지 않는다.
function showErrors(errors) {
  for (const el of document.querySelectorAll(".screen")) el.hidden = true;
  const banner = document.getElementById("error-banner");
  const list = document.createElement("ul");
  for (const message of errors) {
    const li = document.createElement("li");
    li.textContent = message;
    list.appendChild(li);
  }
  const title = document.createElement("strong");
  title.textContent = "문항 데이터에 문제가 있어 시작할 수 없습니다.";
  banner.replaceChildren(title, list);
  banner.hidden = false;
}

function renderCategories() {
  const container = document.getElementById("category-list");
  container.replaceChildren();
  for (const category of CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.addEventListener("click", () => chooseCategory(category));
    container.appendChild(button);
  }
}

/* ----- 스피드 모드 타이머 ----- */

const timer = { id: null, startMs: 0 };

function renderTimer(left) {
  const el = document.getElementById("timer");
  el.textContent = `남은 시간 ${left}초`;
  el.classList.toggle("is-low", left <= 5);
}

function stopTimer() {
  if (timer.id !== null) {
    clearInterval(timer.id);
    timer.id = null;
  }
}

// 남은 시간은 시작 시각과 지금 시각의 차이로 계산한다. 0초가 되면 시간 초과(null 선택)로 처리한다.
function tickTimer() {
  const left = secondsLeft(timer.startMs, Date.now());
  renderTimer(left);
  if (left === 0) {
    stopTimer();
    onChoose(null);
  }
}

function startTimer() {
  stopTimer();
  timer.startMs = Date.now();
  renderTimer(secondsLeft(timer.startMs, timer.startMs));
  timer.id = setInterval(tickTimer, 200);
}

function goHome() {
  stopTimer();
  app.state = null;
  app.retry = null;
  showScreen("categories");
}

function startRound(category) {
  app.category = category;
  app.retry = null;
  app.recorded = false;
  app.state = newGame(buildRound(QUESTIONS, category), app.mode);
  showScreen("quiz");
  renderQuestion();
}

const CHOICE_NUMBERS = ["①", "②", "③", "④"];

// 한 문항(문제와 보기 4개)을 그린다. 정상 판과 다시 풀기가 함께 쓴다.
function renderItem(item, progressText) {
  document.getElementById("progress").textContent = progressText;
  document.getElementById("question").textContent = item.question;
  const explanation = document.getElementById("explanation");
  explanation.hidden = true;
  explanation.replaceChildren();
  document.getElementById("btn-next").hidden = true;

  const container = document.getElementById("choices");
  container.replaceChildren();
  item.choices.forEach((text, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    const no = document.createElement("span");
    no.className = "choice-no";
    no.textContent = CHOICE_NUMBERS[i];
    const label = document.createElement("span");
    label.className = "choice-text";
    label.textContent = text;
    const mark = document.createElement("span");
    mark.className = "choice-mark";
    button.append(no, label, mark);
    button.addEventListener("click", () => onChoose(i));
    container.appendChild(button);
  });
}

function renderQuestion() {
  const state = app.state;
  renderItem(state.items[state.index], `${state.index + 1} / ${ROUND_SIZE}`);

  document.getElementById("quiz-notice").hidden = true;
  renderLiveScore();
  const hintButton = document.getElementById("btn-hint");
  hintButton.hidden = state.mode !== "hint";
  hintButton.disabled = false;
  document.getElementById("mode-label").textContent = `${MODE_LABELS[state.mode]} 모드`;
  const timerEl = document.getElementById("timer");
  if (state.mode === "speed") {
    timerEl.hidden = false;
    startTimer();
  } else {
    stopTimer();
    timerEl.hidden = true;
  }
}

// 문제 화면 위쪽의 누적 점수(힌트를 쓰고 맞히면 0.5씩 오르는 것이 바로 보인다).
function renderLiveScore() {
  const el = document.getElementById("live-score");
  el.hidden = false;
  el.textContent = `점수 ${formatScore(app.state.score)}`;
}

// 힌트를 쓰면 오답 보기 2개를 지운다(한 문항에 한 번, 답하기 전까지만).
function onHint() {
  if (!app.state || app.retry) return;
  const hidden = useHint(app.state);
  if (!hidden) return;
  const buttons = Array.from(document.getElementById("choices").children);
  for (const i of hidden) buttons[i].hidden = true;
  document.getElementById("btn-hint").disabled = true;
}

// 보기를 고른다. 이미 답한 문항이면 recordAnswer가 null을 돌려주므로 아무 일도 일어나지 않는다.
// index가 null이면 시간 초과다.
function onChoose(index) {
  if (app.retry) {
    onRetryChoose(index);
    return;
  }
  const state = app.state;
  const item = state.items[state.index];
  const result = recordAnswer(state, index);
  if (!result) return;
  stopTimer();
  renderLiveScore();
  showAnswerResult(item, result, index, {
    points: `획득 점수: ${formatScore(result.points)}점${state.hintUsed ? " (힌트 사용)" : ""}`,
    nextLabel: state.index === state.items.length - 1 ? "결과 보기" : "다음",
  });
}

// 정오 표시와 해설을 보여 준다. options.points가 있으면 획득 점수 줄을 넣는다(다시 풀기에서는 넣지 않는다).
function showAnswerResult(item, result, chosenIndex, options) {
  // 실제 DOM의 children은 HTMLCollection이라 forEach가 없으므로 배열로 바꿔서 순회한다.
  const buttons = Array.from(document.getElementById("choices").children);
  buttons.forEach((button, i) => {
    button.disabled = true;
    const mark = button.children[2];
    if (i === result.answerIndex) {
      button.classList.add("is-correct");
      mark.textContent = "✓ 정답";
    } else if (i === chosenIndex) {
      button.classList.add("is-wrong");
      mark.textContent = "✗ 내 선택";
    }
  });
  document.getElementById("btn-hint").disabled = true;

  const verdict = document.createElement("p");
  verdict.className = result.correct ? "verdict is-right" : "verdict is-wrong";
  if (result.correct) verdict.textContent = "✓ 정답입니다";
  else if (chosenIndex === null) verdict.textContent = "✗ 시간 초과 (오답 처리)";
  else verdict.textContent = "✗ 오답입니다";
  const reason = document.createElement("p");
  reason.textContent = item.explanation;
  const parts = [verdict, reason];
  if (options.points) {
    const points = document.createElement("p");
    points.className = "points";
    points.textContent = options.points;
    parts.push(points);
  }
  const source = document.createElement("p");
  source.className = "source";
  source.textContent = `출처: ${item.source}`;
  parts.push(source);
  const explanation = document.getElementById("explanation");
  explanation.replaceChildren(...parts);
  explanation.hidden = false;

  const next = document.getElementById("btn-next");
  next.textContent = options.nextLabel;
  next.hidden = false;
}

function onNext() {
  if (app.retry) {
    if (retryNext(app.retry)) renderRetryItem();
    return;
  }
  if (!app.state || !nextQuestion(app.state)) return;
  if (app.state.finished) renderResult();
  else renderQuestion();
}

function renderResult() {
  const state = app.state;
  stopTimer();
  showScreen("result");
  document.getElementById("result-category").textContent = app.category;
  document.getElementById("score").textContent = `${formatScore(state.score)} / ${ROUND_SIZE}`;
  document.getElementById("result-detail").textContent =
    state.wrong.length === 0 ? "모두 맞혔어요!" : `틀린 문제 ${state.wrong.length}개`;
  document.getElementById("result-notice").textContent = app.mode === "practice" ? NO_RECORD_NOTICE : "";

  // 연습 모드 결과에는 [틀린 문제 다시 풀기]를 항상 보여 준다. 틀린 문제가 없으면 비활성화하고 안내한다.
  const retryButton = document.getElementById("btn-retry");
  const retryNote = document.getElementById("retry-note");
  if (app.mode === "practice") {
    const none = state.wrong.length === 0;
    retryButton.hidden = false;
    retryButton.disabled = none;
    retryNote.textContent = none ? "틀린 문제가 없어요" : "";
  } else {
    retryButton.hidden = true;
    retryNote.textContent = "";
  }

  document.getElementById("btn-result-board").hidden = app.mode === "practice";
  prepareRecord();
}

/* ----- 순위표 기록 (스피드·힌트 판이 끝났을 때) ----- */

function recordStatusText(outcome) {
  if (outcome.status === "ranked") return `${outcome.rank}위에 올랐어요 (닉네임: ${app.nickname})`;
  if (outcome.status === "outside") return "순위권 밖이에요 (상위 10건에 들지 못했어요)";
  return "기록을 저장할 수 없어요 (브라우저 저장소를 쓸 수 없음)";
}

// 결과 화면에 들어올 때 부른다. 연습 모드는 아무것도 기록하지 않는다.
// 닉네임이 있으면 곧바로 기록하고, 없으면 입력 칸을 보여 준다.
function prepareRecord() {
  const form = document.getElementById("nickname-form");
  const status = document.getElementById("record-status");
  document.getElementById("nickname-error").hidden = true;
  form.hidden = true;
  status.textContent = "";
  if (app.mode === "practice") return;

  const stored = loadNickname(getStorage());
  if (stored) app.nickname = stored;
  if (app.nickname) {
    saveRecord();
  } else {
    status.textContent = "닉네임을 정하면 이번 점수를 순위표에 기록해요.";
    document.getElementById("nickname-input").value = "";
    form.hidden = false;
  }
}

// 한 판은 한 번만 기록한다.
function saveRecord() {
  if (app.recorded || !app.nickname || !app.state || app.mode === "practice") return;
  app.recorded = true;
  const outcome = recordResult(getStorage(), app.mode, app.category, {
    nickname: app.nickname,
    score: app.state.score,
    date: todayString(),
  });
  document.getElementById("record-status").textContent = recordStatusText(outcome);
  document.getElementById("nickname-form").hidden = true;
}

function onNicknameSave() {
  const error = document.getElementById("nickname-error");
  const name = normalizeNickname(document.getElementById("nickname-input").value);
  if (name === null) {
    error.textContent = "1~12자로 입력해 주세요";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  saveNickname(getStorage(), name); // 저장에 실패해도 이번 접속 동안은 계속 쓴다
  app.nickname = name;
  saveRecord();
}

/* ----- 순위표 화면 ----- */

const BOARD_MODES = ["speed", "hint"]; // 연습 모드는 기록하지 않으므로 탭에 없다
const boardView = { mode: "speed", category: CATEGORIES[0] };

function renderBoardTabs() {
  const modeTabs = document.getElementById("board-mode-tabs");
  modeTabs.replaceChildren();
  for (const mode of BOARD_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = mode === boardView.mode ? "tab is-active" : "tab";
    button.setAttribute("aria-pressed", String(mode === boardView.mode));
    button.textContent = MODE_LABELS[mode];
    button.addEventListener("click", () => openBoard(mode, boardView.category));
    modeTabs.appendChild(button);
  }
  const categoryTabs = document.getElementById("board-category-tabs");
  categoryTabs.replaceChildren();
  for (const category of CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = category === boardView.category ? "tab is-active" : "tab";
    button.setAttribute("aria-pressed", String(category === boardView.category));
    button.textContent = category;
    button.addEventListener("click", () => openBoard(boardView.mode, category));
    categoryTabs.appendChild(button);
  }
}

// 모든 칸은 createElement와 textContent로 만든다(닉네임의 HTML이 해석되지 않게).
function renderBoard() {
  const { mode, category } = boardView;
  document.getElementById("board-title").textContent = `${MODE_LABELS[mode]} · ${category}`;
  const storage = getStorage();
  const current = readBoard(storage, mode, category);
  const body = document.getElementById("board-body");
  body.replaceChildren();
  current.table.forEach((record, i) => {
    const row = document.createElement("tr");
    for (const text of [String(i + 1), record.nickname, formatScore(record.score), record.date]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    body.appendChild(row);
  });
  document.getElementById("board-error").hidden = current.ok;
  document.getElementById("board-empty").hidden = !(current.ok && current.table.length === 0);
  document.getElementById("board-nickname").textContent = loadNickname(storage) || app.nickname || "(아직 없음)";
}

function openBoard(mode, category) {
  boardView.mode = mode;
  boardView.category = category;
  renderBoardTabs();
  renderBoard();
  document.getElementById("board-nickname-error").hidden = true;
  showScreen("board");
}

// 닉네임을 바꾼다. 이미 저장된 기록의 닉네임은 바꾸지 않는다.
function onBoardNicknameChange() {
  const error = document.getElementById("board-nickname-error");
  const name = normalizeNickname(document.getElementById("board-nickname-input").value);
  if (name === null) {
    error.textContent = "1~12자로 입력해 주세요";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  saveNickname(getStorage(), name);
  app.nickname = name;
  document.getElementById("board-nickname-input").value = "";
  renderBoard();
}

/* ----- 틀린 문제 다시 풀기 화면 ----- */

function startRetry() {
  if (!app.state || app.state.wrong.length === 0) return;
  app.retry = createRetry(app.state.wrong);
  renderRetryItem();
}

function renderRetryItem() {
  const retry = app.retry;
  const item = retryCurrent(retry);
  stopTimer();
  if (!item) {
    document.getElementById("retry-done-notice").textContent = NO_RECORD_NOTICE;
    showScreen("retry-done");
    return;
  }
  showScreen("quiz");
  renderItem(item, `다시 풀기 ${retry.pos + 1} / ${retry.pass.length}`);
  document.getElementById("mode-label").textContent = "연습 모드 · 틀린 문제 다시 풀기";
  document.getElementById("live-score").hidden = true;
  document.getElementById("timer").hidden = true;
  document.getElementById("btn-hint").hidden = true;
  const notice = document.getElementById("quiz-notice");
  notice.textContent = NO_RECORD_NOTICE;
  notice.hidden = false;
}

function onRetryChoose(index) {
  const item = retryCurrent(app.retry);
  const result = retryAnswer(app.retry, index);
  if (!result) return;
  showAnswerResult(item, result, index, { nextLabel: "다음" });
}

// 카테고리를 고른 다음 모드 선택 화면으로 간다.
function chooseCategory(category) {
  app.category = category;
  document.getElementById("mode-category").textContent = category;
  showScreen("mode");
}

function chooseMode(mode) {
  app.mode = mode;
  startRound(app.category);
}

function renderModes() {
  const container = document.getElementById("mode-list");
  container.replaceChildren();
  for (const mode of MODES) {
    const button = document.createElement("button");
    button.type = "button";
    const name = document.createElement("span");
    name.textContent = MODE_LABELS[mode];
    const desc = document.createElement("span");
    desc.className = "mode-desc";
    desc.textContent = MODE_DESCRIPTIONS[mode];
    button.append(name, desc);
    button.addEventListener("click", () => chooseMode(mode));
    container.appendChild(button);
  }
}

function init() {
  // questions.js를 못 불러온 경우(파일을 따로 옮겼을 때 등)에도 빈 화면이 되지 않게 안내한다.
  if (typeof QUESTIONS === "undefined") {
    showErrors(["questions.js를 불러오지 못했습니다. index.html과 같은 폴더에 questions.js가 있는지 확인해 주세요."]);
    return;
  }
  const errors = validateQuestions(QUESTIONS).concat(validateCounts(QUESTIONS));
  if (errors.length > 0) {
    showErrors(errors);
    return;
  }
  renderCategories();
  renderModes();
  document.getElementById("btn-mode-back").addEventListener("click", goHome);
  document.getElementById("btn-hint").addEventListener("click", onHint);
  document.getElementById("btn-retry").addEventListener("click", startRetry);
  document.getElementById("btn-nickname-save").addEventListener("click", onNicknameSave);
  document.getElementById("btn-board").addEventListener("click", () => openBoard("speed", CATEGORIES[0]));
  document.getElementById("btn-result-board").addEventListener("click", () => openBoard(app.mode, app.category));
  document.getElementById("btn-board-back").addEventListener("click", goHome);
  document.getElementById("btn-board-nickname").addEventListener("click", onBoardNicknameChange);
  document.getElementById("board-nickname-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onBoardNicknameChange();
  });
  document.getElementById("nickname-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onNicknameSave();
  });
  document.getElementById("btn-retry-home").addEventListener("click", goHome);
  document.getElementById("btn-next").addEventListener("click", onNext);
  document.getElementById("btn-quit").addEventListener("click", goHome);
  document.getElementById("btn-home").addEventListener("click", goHome);
  showScreen("categories");
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

/* ===== 내보내기 (Node 테스트용, 브라우저에서는 건너뜀) ===== */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CATEGORIES, ROUND_SIZE, SPEED_SECONDS, BOARD_LIMIT, NO_RECORD_NOTICE, MODES, MODE_LABELS, MODE_DESCRIPTIONS, shuffle, validateQuestions, validateCounts,
    shuffleItem, buildRound, scoreFor, newGame, recordAnswer, nextQuestion, formatScore,
    useHint, secondsLeft, createRetry, retryCurrent, retryAnswer, retryNext,
    addRecord, normalizeNickname, todayString,
    NICKNAME_KEY, boardKey, getStorage, loadBoard, saveBoard, loadNickname, saveNickname, recordResult,
  };
}
