# 4지선다 상식 퀴즈 웹 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대학 1학년 학생이 혼자 쓰는, 서버 없이 브라우저에서 파일을 열면 동작하는 4지선다 상식 퀴즈 앱(연습·스피드·힌트 모드, 순위표)을 3단계로 만든다.

**Architecture:** 정적 파일 4개로 이루어진다. `script.js`는 위쪽에 DOM과 무관한 순수 로직(섞기, 판 상태, 점수, 타이머 계산, 순위표, 저장소)을, 아래쪽에 DOM 화면 코드를 둔다. 순수 로직은 Node의 내장 테스트 러너로 자동 검증하고, 화면은 단계마다 정해 둔 브라우저 직접 확인 항목으로 검증한다.

**Tech Stack:** 순수 HTML/CSS/JavaScript(의존성 없음). 개발용 테스트는 Node 18 이상의 `node --test`만 쓴다. `tests/`는 개발용이며 배포 파일 4개에 포함하지 않는다.

**Spec:** `PRD.md`

## Global Constraints

모든 태스크는 아래 내용을 따른다. 값은 PRD.md에서 그대로 옮겼다.

- 파일은 `index.html`, `style.css`, `script.js`, `questions.js` 4개다. 서버는 없고, 브라우저에서 파일을 열면(`file://`) 동작한다.
- 빌드 도구, 패키지 설치, 외부 CDN, 외부 폰트를 쓰지 않는다. 인터넷 없이 동작해야 한다.
- ES 모듈(`type="module"`, `import`)과 `fetch`로 JSON 읽기를 쓰지 않는다. `index.html`에서 `questions.js`, `script.js` 순서로 일반 `<script>` 태그로 불러오고, 문항은 전역 `QUESTIONS`로 노출한다.
- 카테고리는 한국사, 세계지리, 과학, 예술과 문화 4개이고 각 10문제, 총 40문제다. 한 판은 카테고리 1개의 10문제다.
- 문항 순서와 보기 순서는 매 판 무작위로 섞는다. 보기를 누르면 즉시 확정되고 바꿀 수 없다.
- 점수: 맞히면 1점, 힌트 모드에서 힌트를 쓰고 맞히면 0.5점, 틀린 문항은 모든 모드에서 0점이다.
- 스피드: 문항마다 15초, 시간이 지나면 오답이다. 해설이 나오면 타이머가 멈추고, [다음]을 누르면 다시 15초부터 센다.
- 힌트: 문항마다 1번, 누르면 오답 보기 2개를 지운다.
- 표시 문구 `순위표에 기록되지 않음`은 연습 모드의 시작(카테고리 선택) 화면, 결과 화면, 다시 풀기 화면에 쓴다.
- 순위표: 스피드·힌트 × 4개 카테고리 = 8개 표, 연습은 기록하지 않는다. 각 표는 상위 10건, 동점이면 최근 기록이 위다. 기록 항목은 점수, 날짜(`YYYY-MM-DD`), 닉네임이다. 닉네임은 처음 한 번만 입력해 저장하고 계속 쓴다. `localStorage` 키 접두어는 `quiz:v1:`이다.
- 정오는 색만으로 구분하지 않고 ✓/✗ 기호를 함께 쓴다.
- 문항 텍스트와 닉네임은 DOM에 `textContent`로만 넣는다(`innerHTML` 금지).
- 문항 규칙: (1) 정답은 하나만이어야 한다. (2) 해설에는 확인한 출처를 명시한다. (3) "가장 ~한" 같은 최상급 표현이 든 문항은 기준과 시점을 문제에 명시한다.
- 화면 문구는 한국어로 쓴다.
- 과제 채점 기준(2단계 이후 반영): 카테고리를 고른 **다음** 모드 선택 화면에 `연습`, `스피드`, `힌트` 3개를 보여 준다 / 스피드는 `남은 시간`이 15초부터 줄고 0초에 `시간 초과`로 처리한다 / 힌트는 오답 2개를 지우고 힌트 후 정답은 0.5점 / 연습 결과 화면에 [틀린 문제 다시 풀기]가 있다 / 모든 화면에 학번·이름이 보인다 / 저장소에는 `PRD.md`, `IMPL-PLAN.md`, `CLAUDE.md`(대소문자 그대로)가 있고 `CLAUDE.md`에 문항 작성 규칙(5.4.2)이 있다.

## Review Focus

PRD가 직접 말하지 않지만 사용자가 부딪히기 쉬운 상황이다. 가능성이 높은 순서이며, 각 줄의 테스트는 담당 태스크에 들어 있다.

1. **이중 입력**: 보기를 연속으로 두 번 누르거나 [다음]을 연타해도 한 문항은 한 번만 채점되고 문항을 건너뛰지 않는다. → Task 7(판 상태), Task 14(다시 풀기)
2. **시간 초과와 클릭의 경합, 타이머 정리**: 0초 도달과 보기 클릭이 거의 동시에 일어나면 먼저 처리된 쪽만 반영되고, 해설이 뜬 뒤에는 타이머가 계속 돌지 않는다. → Task 12
3. **저장소 사용 불가·손상**: `localStorage`가 막혔거나 저장된 값이 깨져 있어도 앱이 멈추지 않고 안내만 보여 준 뒤 퀴즈는 계속된다. → Task 17
4. **닉네임 이상 입력**: 공백뿐인 값, 너무 긴 값, `<b>` 같은 HTML 문자가 든 값이 와도 안전하게 거부되거나 글자 그대로 보인다. → Task 16, Task 19
5. **전부 맞히거나 전부 틀린 판**: 10/10과 0/10이 정확히 계산되고, 틀린 문제가 없는 판에서는 다시 풀기 버튼이 비활성화되고 안내 문구가 붙는다. → Task 7, Task 15

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 화면 뼈대. 화면 섹션을 `hidden` 속성으로 전환 |
| `style.css` | 스타일 |
| `script.js` | 위쪽: 순수 로직(`module.exports` 가드 포함). 아래쪽: DOM 화면 코드(`typeof document !== "undefined"`일 때만 시작) |
| `questions.js` | `const QUESTIONS = [...]` 40개. 파일 끝에 `module.exports` 가드 |
| `tests/helpers.js` | 테스트용 공용 도구(`seqRng`, `validQuestion`, `fakeQuestions`, `FakeStorage`) |
| `tests/logic.test.js` | 순수 로직 테스트 |
| `tests/questions.test.js` | 실제 문항 데이터 검사 |

**공통 약속:** 순수 로직 함수를 새로 만들면 `script.js` 끝의 `module.exports = {...}`에 이름을 추가한다. 실행은 프로젝트 폴더(PRD.md가 있는 곳)에서 `node --test`로 한다.

**공통 타입** (이후 태스크의 Interfaces에서 이름만 참조한다)

- `Question` = `{ id, category, question, choices: string[4], answer: 0~3, explanation, source }`
- `RoundItem` = `{ id, question, choices: string[4], answerIndex, explanation, source }` (보기가 이미 섞인 상태)
- `GameState` = `{ mode, items: RoundItem[], index, score, wrong: RoundItem[], answered, hintUsed, finished }`
- `Result` = `{ correct: boolean, points: number, answerIndex: number }`
- `BoardRecord` = `{ nickname: string, score: number, date: string }`

---

# 1단계: 연습 모드와 점수

## 만들 것
- 카테고리 선택 → 10문제 진행 → 보기를 누르면 즉시 ✓/✗, 정답, 한 줄 해설, 출처 표시 → 결과 점수
- 문항 40개와 데이터 검사
- 모드 선택 화면과 틀린 문제 다시 풀기는 아직 만들지 않는다. 앱을 열면 카테고리 선택 화면으로 바로 들어가 연습 모드로 진행한다.

## 완료 기준
- 4개 카테고리 모두 10문제씩 끝까지 풀린다.
- 맞히면 1점, 틀리면 0점이 합산되어 결과에 `N / 10`으로 나온다.
- 문항 순서와 보기 순서가 매 판 달라진다.
- 연습 모드의 시작(카테고리 선택) 화면과 결과 화면에 `순위표에 기록되지 않음`이 보인다. (2단계에서 카테고리 다음 모드 선택 화면이 생기면 시작 화면 문구는 모드 선택 화면의 연습 항목으로 옮겨진다.)
- 40개 문항이 모두 문항 규칙을 지키고, `node --test`가 통과한다.
- `index.html`을 더블클릭해 열면 동작한다(`file://`).

## 내가 브라우저에서 직접 확인할 항목
`index.html`을 더블클릭해서 열고(Chrome 권장) F12 → Console 탭을 켜 둔 채 확인한다.

- [ ] 1. 화면에 카테고리 버튼 4개(한국사, 세계지리, 과학, 예술과 문화)와 `순위표에 기록되지 않음`이 보인다. Console에 빨간 오류가 없다.
- [ ] 2. 카테고리 하나를 누르면 `1 / 10` 진행 표시, 문제, 보기 4개가 보인다.
- [ ] 3. 보기를 누르면 곧바로 ✓ 또는 ✗, 정답 보기 표시, 한 줄 해설, `출처: …`가 나온다. 다른 보기를 눌러도 반응이 없다(바꿀 수 없음).
- [ ] 4. [다음]을 눌러 10문제를 끝내면 결과 화면에 `N / 10`이 나오고, N은 내가 맞힌 개수와 같다. `순위표에 기록되지 않음`이 보인다.
- [ ] 5. 한 판은 전부 맞혀서 `10 / 10`, 한 판은 전부 틀려서 `0 / 10`이 나온다.
- [ ] 6. 같은 카테고리를 두 번 연속 풀면 문제 순서와 보기 순서가 다르다.
- [ ] 7. 4개 카테고리 모두 10문제씩 나온다. 풀면서 눈에 띄는 오류(오타, 정답이 둘로 보이는 문제)를 적어 둔다.
- [ ] 8. 풀다가 [그만두기]를 누르면 카테고리 선택 화면으로 돌아오고, 다시 시작하면 1번 문제부터 나온다.
- [ ] 9. 문제에 "가장"이 든 문항은 문제 문장 안에 기준과 시점이 적혀 있다(예: "…기준, 2026년 현재").
- [ ] 10. 새로고침(F5)하면 카테고리 선택 화면으로 돌아오고 오류가 없다.

## 태스크

### Task 1: 프로젝트 뼈대와 테스트 환경

**Files:**
- Create: `script.js`, `questions.js`, `tests/helpers.js`, `tests/logic.test.js`

**Interfaces:**
- Produces: `CATEGORIES: string[]` = `["한국사","세계지리","과학","예술과 문화"]`, `ROUND_SIZE = 10`, `shuffle<T>(list: T[], rng: () => number = Math.random): T[]`(새 배열), 테스트 도구 `seqRng(values: number[]): () => number`(값을 순환해서 돌려줌)

- [ ] **Step 1: 환경 확인.** `node --version`이 18 이상인지 확인한다. Git 저장소가 아니면 `git init`을 실행한다.
- [ ] **Step 2: 실패하는 테스트를 쓴다.** `tests/logic.test.js`에 두 개를 쓴다.

```js
test("shuffle은 같은 원소의 새 배열을 돌려주고 입력을 바꾸지 않는다", () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input);
  assert.notEqual(out, input);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});
test("같은 rng 값이면 같은 결과가 나온다", () => {
  const a = shuffle([1, 2, 3, 4], seqRng([0.9, 0.1, 0.5]));
  const b = shuffle([1, 2, 3, 4], seqRng([0.9, 0.1, 0.5]));
  assert.deepEqual(a, b);
});
```

- [ ] **Step 3: 실패를 확인한다.** `node --test` → 모듈에서 `shuffle`을 찾지 못해 FAIL.
- [ ] **Step 4: 구현한다.** `script.js`에 위 Produces의 상수와 `shuffle`(복사본에 Fisher–Yates)을 만들고, 파일 끝에 `if (typeof module !== "undefined" && module.exports) module.exports = { CATEGORIES, ROUND_SIZE, shuffle };`를 둔다. `questions.js`에는 `const QUESTIONS = [];`와 같은 방식의 `module.exports = QUESTIONS` 가드를 둔다. `tests/helpers.js`에 `seqRng`를 만든다.
- [ ] **Step 5: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 6: 커밋한다.**

```bash
git add script.js questions.js tests/ && git commit -m "chore: 프로젝트 뼈대와 테스트 환경, shuffle"
```

### Task 2: 문항 검증 함수와 데이터 검사 테스트

**Files:**
- Modify: `script.js`, `tests/helpers.js`, `tests/logic.test.js`
- Create: `tests/questions.test.js`

**Interfaces:**
- Consumes: `CATEGORIES`, `ROUND_SIZE`
- Produces: `validateQuestions(list: Question[]): string[]`(문항 단위 검사, 오류 메시지 배열, 빈 배열이면 정상), `validateCounts(list: Question[]): string[]`(카테고리별 정확히 10개인지 검사), 테스트 도구 `validQuestion(overrides?: object): Question`

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `validQuestion()`은 `{id:"t-01", category:"한국사", question:"문제", choices:["a","b","c","d"], answer:0, explanation:"해설", source:"출처"}`를 돌려준다. `tests/logic.test.js`에 아래를 쓴다.

```js
test("올바른 문항은 오류가 없다", () => assert.deepEqual(validateQuestions([validQuestion()]), []));
const bad = {
  "보기 3개": { choices: ["a","b","c"] }, "answer 4": { answer: 4 }, "answer -1": { answer: -1 },
  "answer 소수": { answer: 1.5 }, "source 빈 값": { source: "" }, "source 공백": { source: "  " },
  "source 없음": { source: undefined }, "문제 빈 값": { question: "" }, "해설 빈 값": { explanation: "" },
  "보기 중복": { choices: ["a","a","c","d"] }, "카테고리 오타": { category: "역사" },
};
for (const [name, patch] of Object.entries(bad)) {
  test(`검사 실패: ${name}`, () => {
    const errors = validateQuestions([validQuestion(patch)]);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("t-01"));
  });
}
test("id 중복을 잡는다", () => assert.ok(validateQuestions([validQuestion(), validQuestion()]).length > 0));
test("validateCounts: 카테고리당 10개면 정상", () => assert.deepEqual(validateCounts(tenPerCategory()), []));
test("validateCounts: 한국사가 9개면 오류에 '한국사'가 들어 있다", () => {
  const errors = validateCounts(tenPerCategory().slice(1));
  assert.ok(errors.some((e) => e.includes("한국사")));
});
```

`tenPerCategory()`는 `validQuestion`으로 카테고리마다 id가 다른 10개씩 만드는 테스트 안의 보조 함수다.

`tests/questions.test.js`에는 실제 데이터 검사를 쓴다.

```js
test("모든 문항이 형식 검사를 통과한다", () => assert.deepEqual(validateQuestions(QUESTIONS), []));
for (const c of CATEGORIES) test(`${c}: 10문항`, () => assert.equal(QUESTIONS.filter((q) => q.category === c).length, 10));
test("최상급 표현이 든 문항은 문제에 기준과 시점이 있다 (휴리스틱)", () => {
  for (const q of QUESTIONS.filter((q) => /가장|최대|최소|최고|최장|최단|제일/.test(q.question))) {
    assert.match(q.question, /기준/, q.id);
    assert.match(q.question, /\d{4}년|현재/, q.id);
  }
});
test("해설과 출처는 한 줄이다", () => {
  for (const q of QUESTIONS) assert.doesNotMatch(q.explanation + q.source, /\n/, q.id);
});
```

- [ ] **Step 2: 실패를 확인한다.** `node --test` → `validateQuestions` 없음으로 FAIL.
- [ ] **Step 3: 구현한다.** `script.js`에 `validateQuestions`(필드별 검사: 문자열 비어 있지 않음, `choices` 길이 4·서로 다름, `answer`는 0~3의 정수, `category`는 `CATEGORIES`에 속함, `source`는 공백만이면 안 됨, `id` 유일)와 `validateCounts`를 만든다. 오류 메시지는 `"<id>: <이유>"`, 개수 오류는 `"<카테고리>: 10개여야 하는데 N개"` 형식이다.
- [ ] **Step 4: 통과를 확인한다.** `node --test tests/logic.test.js` → PASS. (`tests/questions.test.js`의 카테고리별 10문항 테스트 4개는 Task 3~6이 끝날 때까지 FAIL이 정상이다.)
- [ ] **Step 5: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: 문항 검증 함수와 데이터 검사 테스트"
```

### Task 3: 한국사 문항 10개

**Files:**
- Modify: `questions.js`
- Test: `tests/questions.test.js`

**Interfaces:**
- Consumes: `Question` 형식(PRD 3.2절), id 규칙 `kh-01`~`kh-10`
- Produces: `category: "한국사"` 문항 10개

- [ ] **Step 1: 실패를 확인한다.** `node --test tests/questions.test.js` → `한국사: 10문항`이 FAIL(현재 0개).
- [ ] **Step 2: 주제 10개를 정한다.** 선사·삼국·고려·조선·근대·현대로 시대를 나눠 겹치지 않게 고른다.
- [ ] **Step 3: 문항마다 출처를 실제로 확인한다.** 웹 검색 등으로 사실을 확인하고, 확인한 자료명을 `source`에 적는다. 확인하지 못하면 그 문항을 다른 주제로 바꾼다.
- [ ] **Step 4: 문항을 작성한다.** 정답은 하나이고 나머지 3개는 분명히 틀려야 하며, "모두 맞음/정답 없음" 보기는 쓰지 않는다. 최상급이 들어가면 문제에 기준과 시점을 쓴다. 해설은 한 줄이다. `answer`의 위치는 0~3에 고르게 분산한다.
- [ ] **Step 5: 통과를 확인한다.** `node --test tests/questions.test.js` → 한국사 항목과 형식 검사, 최상급 검사가 PASS.
- [ ] **Step 6: 검수한다.** PRD 5.1 체크리스트를 10문항 모두에 적용해 위반이 없음을 확인한다.
- [ ] **Step 7: 커밋한다.**

```bash
git add questions.js && git commit -m "feat: 한국사 문항 10개"
```

### Task 4: 세계지리 문항 10개

**Files:**
- Modify: `questions.js`
- Test: `tests/questions.test.js`

**Interfaces:**
- Consumes: `Question` 형식, id 규칙 `wg-01`~`wg-10`
- Produces: `category: "세계지리"` 문항 10개

- [ ] **Step 1: 실패를 확인한다.** `node --test tests/questions.test.js` → `세계지리: 10문항`이 FAIL.
- [ ] **Step 2: 주제 10개를 정한다.** 대륙·지역(아시아, 유럽, 아프리카, 아메리카, 오세아니아)과 자연·인문 주제를 분산한다. 수치나 순위가 필요한 문항은 출처마다 값이 갈리는지 먼저 확인한다.
- [ ] **Step 3: 문항마다 출처를 실제로 확인한다.** 확인한 자료명을 `source`에 적고, 확인하지 못하면 문항을 바꾼다.
- [ ] **Step 4: 문항을 작성한다.** 정답 하나, 나머지 3개는 분명히 오답, 최상급은 기준(면적, 길이, 인구 등)과 시점을 문제에 쓴다. 해설은 한 줄이고 `answer` 위치는 고르게 분산한다.
- [ ] **Step 5: 통과를 확인한다.** `node --test tests/questions.test.js` → 세계지리 항목과 형식 검사, 최상급 검사가 PASS.
- [ ] **Step 6: 검수한다.** PRD 5.1 체크리스트를 10문항 모두에 적용한다.
- [ ] **Step 7: 커밋한다.**

```bash
git add questions.js && git commit -m "feat: 세계지리 문항 10개"
```

### Task 5: 과학 문항 10개

**Files:**
- Modify: `questions.js`
- Test: `tests/questions.test.js`

**Interfaces:**
- Consumes: `Question` 형식, id 규칙 `sc-01`~`sc-10`
- Produces: `category: "과학"` 문항 10개

- [ ] **Step 1: 실패를 확인한다.** `node --test tests/questions.test.js` → `과학: 10문항`이 FAIL.
- [ ] **Step 2: 주제 10개를 정한다.** 물리, 화학, 생물, 지구과학·천문을 고르게 나눈다. 학설이 갈리거나 최근 바뀐 수치는 피한다.
- [ ] **Step 3: 문항마다 출처를 실제로 확인한다.** 확인한 자료명을 `source`에 적고, 확인하지 못하면 문항을 바꾼다.
- [ ] **Step 4: 문항을 작성한다.** 정답 하나, 나머지 3개는 분명히 오답, 최상급은 기준과 시점을 문제에 쓴다. 해설은 한 줄이고 `answer` 위치는 고르게 분산한다.
- [ ] **Step 5: 통과를 확인한다.** `node --test tests/questions.test.js` → 과학 항목과 형식 검사, 최상급 검사가 PASS.
- [ ] **Step 6: 검수한다.** PRD 5.1 체크리스트를 10문항 모두에 적용한다.
- [ ] **Step 7: 커밋한다.**

```bash
git add questions.js && git commit -m "feat: 과학 문항 10개"
```

### Task 6: 예술과 문화 문항 10개

**Files:**
- Modify: `questions.js`
- Test: `tests/questions.test.js`

**Interfaces:**
- Consumes: `Question` 형식, id 규칙 `ac-01`~`ac-10`
- Produces: `category: "예술과 문화"` 문항 10개. 이 태스크가 끝나면 `QUESTIONS`가 총 40개가 된다.

- [ ] **Step 1: 실패를 확인한다.** `node --test tests/questions.test.js` → `예술과 문화: 10문항`이 FAIL.
- [ ] **Step 2: 주제 10개를 정한다.** 미술, 음악, 문학, 건축, 전통 문화(한국·세계)를 분산한다. 가사·시 등 저작물 본문은 문제나 해설에 넣지 않고 작품명·작가 같은 사실만 다룬다.
- [ ] **Step 3: 문항마다 출처를 실제로 확인한다.** 확인한 자료명을 `source`에 적고, 확인하지 못하면 문항을 바꾼다.
- [ ] **Step 4: 문항을 작성한다.** 정답 하나, 나머지 3개는 분명히 오답, 최상급은 기준과 시점을 문제에 쓴다. 해설은 한 줄이고 `answer` 위치는 고르게 분산한다.
- [ ] **Step 5: 통과를 확인한다.** `node --test` → 전체 PASS(문항 40개, 카테고리별 10개).
- [ ] **Step 6: 검수한다.** PRD 5.1 체크리스트를 10문항 모두에 적용하고, 40개 `id`가 겹치지 않는지 확인한다.
- [ ] **Step 7: 커밋한다.**

```bash
git add questions.js && git commit -m "feat: 예술과 문화 문항 10개"
```

### Task 7: 판 상태와 점수 로직

**Files:**
- Modify: `script.js`, `tests/helpers.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: `shuffle`, `ROUND_SIZE`, `CATEGORIES`
- Produces:
  - `shuffleItem(item: RoundItem, rng?): RoundItem` (보기를 다시 섞되 `answerIndex`를 새 위치로 맞춤)
  - `buildRound(questions: Question[], category: string, rng?): RoundItem[]` (그 카테고리에서 10개를 무작위 순서로, 보기도 섞음. 10개 미만이면 `Error`를 던짐)
  - `scoreFor(mode: string, correct: boolean, hintUsed: boolean): number` (이 태스크에서는 `"practice"`만 지원, 다른 mode는 `Error`)
  - `newGame(items: RoundItem[], mode: string): GameState`
  - `recordAnswer(state: GameState, choiceIndex: number | null): Result | null` (`null` 입력은 시간 초과. 이미 답했거나 끝난 판이면 `null`을 돌려주고 아무것도 바꾸지 않음)
  - `nextQuestion(state: GameState): boolean` (답하기 전이면 `false`로 아무것도 안 함. 답한 뒤면 `index`를 올리고 `answered`/`hintUsed`를 초기화, 마지막 뒤면 `finished = true`)
  - `formatScore(n: number): string` (정수는 `"8"`, 소수는 `"7.5"`)
  - 테스트 도구 `fakeQuestions(category: string, n?: number): Question[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 이름과 핵심 단언은 아래와 같다.

```js
test("buildRound: 해당 카테고리 문항 10개, 중복 없음", /* fakeQuestions("한국사",12)+fakeQuestions("과학",5) → length 10, 모두 한국사 id, id 유일 */);
test("buildRound: 보기가 섞여도 정답 보기의 글자는 그대로다", () => {
  for (const item of buildRound(qs, "한국사", seqRng([0.3, 0.8, 0.1]))) {
    const orig = qs.find((q) => q.id === item.id);
    assert.equal(item.choices[item.answerIndex], orig.choices[orig.answer]);
    assert.deepEqual([...item.choices].sort(), [...orig.choices].sort());
  }
});
test("buildRound: 10개 미만이면 Error", () => assert.throws(() => buildRound(fakeQuestions("한국사", 9), "한국사")));
test("연습: 정답이면 1점, 오답이면 0점", () => { assert.equal(scoreFor("practice", true, false), 1); assert.equal(scoreFor("practice", false, false), 0); });
test("알 수 없는 모드는 Error", () => assert.throws(() => scoreFor("x", true, false)));
test("recordAnswer: 정답은 {correct:true, points:1}이고 score가 오른다", /* score 1 */);
test("recordAnswer: 오답은 points 0이고 wrong에 그 문항이 들어간다", /* wrong.length 1 */);
test("recordAnswer를 같은 문항에 두 번 호출하면 두 번째는 null이고 score가 변하지 않는다", /* 이중 입력 */);
test("nextQuestion: 답하기 전에는 false이고 index가 변하지 않는다", /* 연타 */);
test("nextQuestion: 답한 뒤에는 true이고 index가 1 오르며 answered가 false로 돌아온다", /* ... */);
test("10문항을 끝내면 finished이고 이후 recordAnswer는 null이다", /* ... */);
test("전부 맞히면 score 10, wrong 비어 있음", /* 10번 반복 */);
test("전부 틀리면 score 0, wrong 10개", /* 10번 반복 */);
test("formatScore", () => { assert.equal(formatScore(8), "8"); assert.equal(formatScore(7.5), "7.5"); assert.equal(formatScore(0), "0"); });
```

`fakeQuestions(category, n = 10)`은 `validQuestion`으로 id가 `f-<카테고리>-<번호>`인 문항 n개를 만들고, `answer`는 번호에 따라 0~3으로 돌린다.

- [ ] **Step 2: 실패를 확인한다.** `node --test tests/logic.test.js` → 함수 없음으로 FAIL.
- [ ] **Step 3: `shuffleItem`, `buildRound`를 구현한다.** `buildRound`는 `shuffle`로 카테고리 문항을 섞어 앞 10개를 `RoundItem`으로 바꾸고 `shuffleItem`으로 보기를 섞는다.
- [ ] **Step 4: `scoreFor`, `newGame`, `recordAnswer`, `nextQuestion`, `formatScore`를 구현한다.** `newGame`은 `index 0, score 0, wrong [], answered false, hintUsed false, finished false`로 시작한다. `recordAnswer`는 `scoreFor(state.mode, correct, state.hintUsed)`로 점수를 계산하고, 오답이거나 시간 초과(`null`)면 `wrong`에 추가한다.
- [ ] **Step 5: 통과를 확인한다.** `node --test tests/logic.test.js` → PASS.
- [ ] **Step 6: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: 판 상태, 채점, 점수 표시 로직"
```

### Task 8: 화면 뼈대와 카테고리 선택

**Files:**
- Create: `index.html`, `style.css`
- Modify: `script.js` (아래쪽 DOM 구역 신설)

**Interfaces:**
- Consumes: `CATEGORIES`, `validateQuestions`, `validateCounts`, 전역 `QUESTIONS`
- Produces: `NO_RECORD_NOTICE = "순위표에 기록되지 않음"`, `app = { mode: "practice", category: null, state: null }`, `showScreen(name: string): void`(해당 `#screen-<name>`만 보이게 함), `init(): void`, `index.html`의 `#error-banner`와 `#screen-categories`

- [ ] **Step 1: `index.html`을 만든다.** `style.css`를 링크하고, `questions.js`, `script.js` 순서의 일반 `<script>` 태그를 둔다(모듈·외부 자원 없음). 본문에는 `#error-banner`(기본 숨김)와 `#screen-categories`(제목, 카테고리 버튼 영역, `NO_RECORD_NOTICE`를 표시할 `#notice`)를 둔다. 이후 화면은 각 태스크가 자기 섹션을 추가한다.
- [ ] **Step 2: `init`을 구현한다.** `validateQuestions(QUESTIONS)`와 `validateCounts(QUESTIONS)`의 오류를 모아, 하나라도 있으면 `#error-banner`에 목록으로 보여 주고 시작하지 않는다. 오류가 없으면 `CATEGORIES`로 버튼을 만들고(`textContent`) `#notice`에 `NO_RECORD_NOTICE`를 넣은 뒤 `showScreen("categories")`를 한다. 시작은 `if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init)`로 하고, 파일 끝의 `module.exports`에 `NO_RECORD_NOTICE`를 추가한다.
- [ ] **Step 3: `style.css`를 만든다.** 기본 레이아웃, 버튼, `[hidden]`이 항상 숨겨지게 하는 규칙, 좁은 화면에서 한 열로 쌓이는 간단한 반응형을 쓴다.
- [ ] **Step 4: 자동 테스트가 그대로 통과하는지 확인한다.** `node --test` → PASS(`document`가 없는 Node에서 `init`이 실행되지 않는다).
- [ ] **Step 5: 브라우저로 확인한다.** `index.html`을 열어 1단계 직접 확인 항목 1번을 본다. 추가로, `questions.js` 사본에서 한 문항의 `source`를 비워 열면 `#error-banner`에 오류가 보이고 퀴즈가 시작되지 않는지 확인한 뒤 원래대로 되돌린다.
- [ ] **Step 6: 커밋한다.**

```bash
git add index.html style.css script.js && git commit -m "feat: 화면 뼈대와 카테고리 선택, 데이터 오류 표시"
```

### Task 9: 문제 진행, 해설, 결과 화면

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `app`, `showScreen`, `buildRound`, `newGame`, `recordAnswer`, `nextQuestion`, `formatScore`, `NO_RECORD_NOTICE`, `ROUND_SIZE`
- Produces: `startRound(category: string): void`, `renderQuestion(): void`, `onChoose(index: number | null): void`(`null`은 시간 초과, Task 12가 사용), `onNext(): void`, `renderResult(): void`, `#screen-quiz`(진행 표시 `#progress`, 문제 `#question`, 보기 버튼 영역 `#choices`, 해설 영역 `#explanation`, `#btn-next`, `#btn-quit`), `#screen-result`(`#score`, `#result-notice`)

- [ ] **Step 1: 마크업을 추가한다.** `index.html`에 `#screen-quiz`와 `#screen-result` 섹션을 위 id대로 만든다.
- [ ] **Step 2: `startRound`를 구현한다.** `buildRound(QUESTIONS, category)`와 `newGame(items, app.mode)`로 `app.state`를 만들고 `renderQuestion()`을 호출한다. 카테고리 버튼에 이 함수를 연결한다.
- [ ] **Step 3: `renderQuestion`, `onChoose`를 구현한다.** `renderQuestion`은 `3 / 10` 형식의 진행 표시, 문제, 보기 버튼 4개를 `textContent`로 그린다. `onChoose`는 `recordAnswer`의 결과가 `null`이면 아무것도 하지 않고, 아니면 모든 보기 버튼을 비활성화한 뒤 정답 보기에 `✓`, 틀리게 고른 보기에 `✗`를 붙이고, `정답입니다`/`오답입니다` 문구, 해설, `출처: …`를 `#explanation`에 표시하고 [다음]을 보여 준다. [다음]은 마지막 문항에서 `결과 보기`로 바뀐다.
- [ ] **Step 4: `onNext`, `renderResult`를 구현한다.** `onNext`는 `nextQuestion`이 `true`일 때만 진행하고, `state.finished`이면 `renderResult()`를, 아니면 `renderQuestion()`을 호출한다. `renderResult`는 `${formatScore(score)} / 10`을 `#score`에 쓰고, 연습 모드이면 `#result-notice`에 `NO_RECORD_NOTICE`를 쓴다. [처음으로]는 카테고리 선택으로 돌아간다. [그만두기]는 기록 없이 카테고리 선택으로 돌아간다.
- [ ] **Step 5: 자동 테스트를 확인한다.** `node --test` → PASS.
- [ ] **Step 6: 브라우저로 1단계 직접 확인 항목 1~10번을 모두 확인한다.** 특히 3번(보기 잠김), 5번(10/10, 0/10), 6번(순서 변경)을 본다.
- [ ] **Step 7: 커밋한다.**

```bash
git add index.html style.css script.js && git commit -m "feat: 1단계 연습 모드 문제 진행, 해설, 결과"
```

---

# 2단계: 스피드 모드, 힌트 모드, 모드 선택 화면, 틀린 문제 다시 풀기

## 만들 것
- **카테고리 선택 → 모드 선택 화면(연습, 스피드, 힌트) → 진행.** 과제 채점 기준이 "카테고리를 고른 뒤 모드 선택 화면에 연습, 스피드, 힌트 3개가 나와야 한다"이므로 1단계 계획의 "모드 먼저" 순서를 바꾼다. 1단계에서 카테고리 화면에 있던 `순위표에 기록되지 않음`은 모드 선택 화면의 연습 항목으로 옮긴다.
- 스피드 모드: 문항마다 15초 카운트다운, 시간 초과는 오답, 해설이 나오면 타이머 정지, [다음]에서 15초부터 다시
- 힌트 모드: 문항마다 1번, 오답 보기 2개 제거, 힌트를 쓰고 맞히면 0.5점
- 연습 모드의 틀린 문제 다시 풀기(점수 없는 복습). 결과 화면에는 틀린 문제가 없어도 [틀린 문제 다시 풀기] 버튼을 항상 보여 주고, 없으면 비활성화하고 안내 문구를 붙인다(채점 기준: 결과 화면에 버튼이 있어야 함).
- 모든 화면 아래에 학번·이름(`#student-info`)을 표시한다(채점 기준).
- 저장소 루트에 `CLAUDE.md`를 만들고 문항 작성 규칙(5.4.2)을 넣는다(채점 기준).

## 완료 기준
- 카테고리를 고르면 모드 선택 화면에 `연습`, `스피드`, `힌트` 3개가 보인다.
- 스피드 모드에서 남은 시간이 15초부터 줄어들고, 0초에 `시간 초과`로 오답(0점) 처리되며 정답과 해설이 나온다.
- 해설이 나오는 동안 타이머가 멈추고, [다음]에서 15초부터 다시 센다.
- 힌트 모드에서 [힌트]를 누르면 오답 보기 2개가 지워지고, 힌트를 쓰고 맞히면 0.5점, 쓰지 않고 맞히면 1점, 틀리면 0점이다. 점수가 `7.5 / 10`처럼 소수로 표시된다.
- 연습 모드 결과 화면에 [틀린 문제 다시 풀기]가 보인다. 틀린 문제가 있으면 활성, 없으면 비활성+안내다. 다시 풀기는 틀린 문제만 반복하고, 모두 맞히면 `복습 완료`로 끝난다. 처음 점수는 바뀌지 않는다.
- 모든 화면에 학번·이름이 보인다.
- 저장소에 `PRD.md`, `IMPL-PLAN.md`, `CLAUDE.md`가 있고, `CLAUDE.md`에 문항 작성 규칙(5.4.2)이 있다.
- `node --test`가 통과한다.

## 내가 브라우저에서 직접 확인할 항목
- [ ] 1. 카테고리를 고르면 모드 선택 화면에 `연습`, `스피드`, `힌트` 버튼 3개가 보인다. 연습 버튼에는 `순위표에 기록되지 않음`이 적혀 있고, 스피드·힌트에는 없다. [뒤로]를 누르면 카테고리 선택으로 돌아간다.
- [ ] 2. 연습 모드 문제 화면에는 타이머와 [힌트] 버튼이 없다.
- [ ] 3. 스피드 모드: 문제가 나오면 `남은 시간 15초`부터 줄어드는 숫자가 보인다.
- [ ] 4. 스피드 모드에서 아무것도 누르지 않고 기다리면 0초에 `시간 초과`로 오답 처리되고, 정답 보기·해설·출처가 나온다. 이 문항 점수는 0점이다.
- [ ] 5. 해설이 떠 있는 동안 10초 이상 두어도 숫자가 변하지 않는다(타이머 정지).
- [ ] 6. [다음]을 누르면 다음 문제가 15초부터 다시 시작한다.
- [ ] 7. 스피드 모드에서 제한 시간 안에 맞히면 1점이다. 결과 점수가 맞힌 개수와 같다.
- [ ] 8. 스피드 모드에서 문제를 띄운 채 다른 탭으로 가서 20초 뒤에 돌아오면, 시간이 이미 초과되어 있거나 남은 시간이 실제 경과만큼 줄어 있다.
- [ ] 9. 힌트 모드: [힌트]를 누르면 보기 2개가 사라지고 2개가 남으며, 그중 하나는 정답이다. [힌트]는 그 문항에서 비활성화되어 한 번만 쓸 수 있다.
- [ ] 10. 힌트 모드에서 보기를 고른 뒤에는 [힌트]를 누를 수 없다.
- [ ] 11. 힌트 모드 점수: 힌트를 쓰고 맞히면 0.5점, 힌트 없이 맞히면 1점, 힌트를 쓰고 틀리면 0점이 해설에 표시된다. 힌트 후 3문제 맞히고, 힌트 없이 2문제 맞히고, 나머지는 틀리면 결과가 `3.5 / 10`이다.
- [ ] 12. 연습 모드 결과 화면에 [틀린 문제 다시 풀기]가 보인다. 틀린 문제가 있으면 눌러지고, 전부 맞힌 판에서는 비활성이며 `틀린 문제가 없어요`가 붙는다. 스피드·힌트 결과에는 이 버튼이 없다.
- [ ] 13. 다시 풀기를 누르면 방금 틀린 문제들만 나오고, `순위표에 기록되지 않음`이 보이며, 점수는 표시되지 않는다. 즉시 ✓/✗, 해설, 출처는 그대로 나온다.
- [ ] 14. 다시 풀기에서 맞히면 그 문제는 다음 바퀴에 나오지 않고, 틀리면 다음 바퀴에 다시 나온다. 모두 맞히면 `복습 완료`가 나온다.
- [ ] 15. 복습이 끝난 뒤 처음으로 돌아가 같은 카테고리를 다시 풀면 새 판이 정상으로 시작한다.
- [ ] 16. 어느 화면에서든 아래쪽에 학번·이름이 보인다.

## 태스크

### Task 10: 힌트와 스피드 점수 규칙, 타이머 계산

**Files:**
- Modify: `script.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: `scoreFor`, `newGame`, `recordAnswer`, `nextQuestion`, `shuffle`, `GameState`
- Produces: `SPEED_SECONDS = 15`, `scoreFor`에 `"speed"`(맞히면 1)와 `"hint"`(힌트를 쓰고 맞히면 0.5, 쓰지 않고 맞히면 1, 틀리면 0) 지원, `useHint(state: GameState, rng?): number[] | null`(힌트 모드에서 이번 문항에 아직 안 썼고 답하기 전일 때만, 지울 보기 인덱스 2개를 돌려주고 `state.hintUsed = true`. 그 외에는 `null`), `secondsLeft(startMs: number, nowMs: number, limitSeconds?: number): number`(남은 초를 올림한 정수, 0 미만이 되지 않음)

- [ ] **Step 1: 실패하는 테스트를 쓴다.**

```js
test("scoreFor 표", () => {
  assert.equal(scoreFor("speed", true, false), 1);   assert.equal(scoreFor("speed", false, false), 0);
  assert.equal(scoreFor("hint", true, true), 0.5);   assert.equal(scoreFor("hint", true, false), 1);
  assert.equal(scoreFor("hint", false, true), 0);    assert.equal(scoreFor("practice", true, true), 1);
});
test("secondsLeft", () => {
  assert.equal(secondsLeft(0, 0), 15);      assert.equal(secondsLeft(0, 1), 15);
  assert.equal(secondsLeft(0, 14001), 1);   assert.equal(secondsLeft(0, 15000), 0);
  assert.equal(secondsLeft(0, 20000), 0);   assert.equal(secondsLeft(5000, 11000), 9);
});
test("useHint: 정답을 빼고 오답 2개를 서로 다르게 고른다", /* answerIndex 0~3 각각, rng 여러 가지로 반복: 길이 2, 서로 다름, answerIndex 미포함, 각 0~3 */);
test("useHint: 연습·스피드 모드에서는 null", /* ... */);
test("useHint: 같은 문항에서 두 번째는 null", /* ... */);
test("useHint: 답한 뒤에는 null", /* ... */);
test("useHint: nextQuestion 뒤 새 문항에서는 다시 쓸 수 있다", /* ... */);
test("힌트 모드 합산: 힌트 후 정답 0.5 + 힌트 없이 정답 1 + 힌트 후 오답 0 = 1.5", /* recordAnswer 3번 */);
```

- [ ] **Step 2: 실패를 확인한다.** `node --test tests/logic.test.js` → FAIL.
- [ ] **Step 3: `scoreFor`를 확장하고 `useHint`, `secondsLeft`를 구현한다.** `useHint`는 `answerIndex`를 뺀 3개 인덱스를 섞어 앞 2개를 돌려준다. `secondsLeft`는 `Math.max(0, Math.ceil(limit - (now - start) / 1000))`와 같은 결과를 낸다. `module.exports`에 `SPEED_SECONDS`, `useHint`, `secondsLeft`를 추가한다.
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: 힌트·스피드 점수 규칙과 타이머 계산"
```

### Task 11: 모드 선택 화면(카테고리 다음)과 학번·이름 표시

**Files:**
- Modify: `index.html`, `style.css`, `script.js`, `tests/dom.test.js`

**Interfaces:**
- Consumes: `app`, `showScreen`, `init`, `renderCategories`, `startRound`, `NO_RECORD_NOTICE`
- Produces: `MODES = ["practice","speed","hint"]`, `MODE_LABELS = { practice: "연습", speed: "스피드", hint: "힌트" }`, `MODE_DESCRIPTIONS`(연습: `시간 제한·힌트 없음 · 순위표에 기록되지 않음`, 스피드: `문항마다 15초`, 힌트: `문항마다 힌트 1번`), `#screen-mode`(`#mode-list`, [뒤로] `#btn-mode-back`), `chooseCategory(category)`(`app.category`를 정하고 모드 선택 화면으로 이동), `chooseMode(mode)`(`app.mode`를 정하고 `startRound(app.category)`), `#student-info`(모든 화면 아래의 `<footer>`)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 카테고리 버튼을 누르면 `screen-mode`만 보이고 `#mode-list`에 `연습`, `스피드`, `힌트`로 시작하는 버튼 3개가 있다. 연습 버튼 글자에만 `순위표에 기록되지 않음`이 들어 있다. [뒤로]는 카테고리 화면으로 돌아간다. 연습을 누르면 문제 화면(`1 / 10`)이 나온다. `#student-info`가 비어 있지 않다. 1단계의 `startCategory` 도우미는 카테고리 → 연습 순서로 누르도록 고친다.
- [ ] **Step 2: 실패를 확인한다.** `node --test tests/dom.test.js` → FAIL.
- [ ] **Step 3: 구현한다.** 카테고리 버튼은 `chooseCategory`를 부르고, 모드 버튼은 `<span>이름</span><span>설명</span>` 구조로 만든다. 카테고리 화면의 `#notice`는 없앤다. 결과 화면과 `startRound`는 `app.mode`를 쓴다. `index.html`의 `<footer id="student-info">` 안에 학번·이름을 적는다(값은 사용자에게 받아 채운다).
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add index.html style.css script.js tests/ && git commit -m "feat: 카테고리 다음 모드 선택 화면과 학번·이름 표시"
```

### Task 12: 스피드 모드 화면

**Files:**
- Modify: `index.html`, `style.css`, `script.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: `app`, `renderQuestion`, `onChoose(index | null)`, `onNext`, `secondsLeft`, `SPEED_SECONDS`, `recordAnswer`
- Produces: `startTimer(): void`, `stopTimer(): void`, `#timer`(스피드 모드에서만 보임)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** (Review Focus 2)

```js
test("시간 초과 직후의 클릭은 무시된다", () => {
  const state = newGame(items, "speed");
  const r1 = recordAnswer(state, null);
  assert.deepEqual([r1.correct, r1.points], [false, 0]);
  assert.equal(state.wrong.length, 1);
  assert.equal(recordAnswer(state, state.items[0].answerIndex), null);
  assert.equal(state.score, 0);
});
test("클릭 직후의 시간 초과는 무시된다", () => {
  const state = newGame(items, "speed");
  recordAnswer(state, state.items[0].answerIndex);
  assert.equal(recordAnswer(state, null), null);
  assert.equal(state.score, 1);
});
```

- [ ] **Step 2: 테스트가 통과하는지 확인한다.** Task 7의 가드로 이미 통과해야 한다. `node --test tests/logic.test.js` → PASS. 실패하면 `recordAnswer`의 `answered` 가드부터 고친다.
- [ ] **Step 3: `startTimer`를 구현한다.** `renderQuestion`이 스피드 모드 문항을 그릴 때 시작 시각 `Date.now()`를 저장하고 `setInterval`(200ms)로 `secondsLeft`를 `#timer`에 표시한다. 남은 시간이 0이 되면 `stopTimer()`를 호출한 뒤 `onChoose(null)`을 호출한다.
- [ ] **Step 4: `stopTimer`를 연결한다.** `onChoose`(해설이 뜰 때), [그만두기], 결과 화면 진입 시 항상 `stopTimer()`로 인터벌을 지운다. `onChoose(null)`일 때는 `시간 초과` 문구와 정답, 해설, 출처를 보여 준다. [다음] 뒤 새 문항에서 `startTimer()`가 다시 15초부터 시작한다.
- [ ] **Step 5: 브라우저로 2단계 직접 확인 항목 3~8번을 확인한다.**
- [ ] **Step 6: 커밋한다.**

```bash
git add index.html style.css script.js tests/ && git commit -m "feat: 스피드 모드 15초 타이머"
```

### Task 13: 힌트 모드 화면

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `app`, `renderQuestion`, `onChoose`, `useHint`
- Produces: `#btn-hint`(힌트 모드에서만 보임), `onHint(): void`

- [ ] **Step 1: 버튼을 추가한다.** `#screen-quiz`에 `#btn-hint`를 넣고, 힌트 모드가 아니면 숨긴다. 새 문항을 그릴 때마다 활성 상태로 되돌린다.
- [ ] **Step 2: `onHint`를 구현한다.** `useHint(app.state)`가 인덱스 2개를 돌려주면 해당 보기 버튼을 숨기고 `#btn-hint`를 비활성화한다. `null`이면 아무것도 하지 않는다.
- [ ] **Step 3: 해설 표시에 점수를 더한다.** 힌트 모드의 해설에는 이번 문항의 획득 점수(`+0.5`, `+1`, `+0`)를 `formatScore`로 보여 주고, 답한 뒤에는 `#btn-hint`를 비활성화한다.
- [ ] **Step 4: 자동 테스트를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 브라우저로 2단계 직접 확인 항목 9~11번을 확인한다.**
- [ ] **Step 6: 커밋한다.**

```bash
git add index.html style.css script.js && git commit -m "feat: 힌트 모드 화면"
```

### Task 14: 틀린 문제 다시 풀기 로직

**Files:**
- Modify: `script.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: `RoundItem`, `shuffle`, `shuffleItem`
- Produces: `RetryState = { pass: RoundItem[], pos: number, missed: RoundItem[], answered: boolean, done: boolean, rng }`, `createRetry(wrongItems: RoundItem[], rng?): RetryState`(문항과 보기 순서를 새로 섞음), `retryCurrent(r: RetryState): RoundItem | null`(끝났으면 `null`), `retryAnswer(r: RetryState, choiceIndex: number): { correct: boolean } | null`(이미 답했거나 끝났으면 `null`), `retryNext(r: RetryState): boolean`(답하기 전이면 `false`. 한 바퀴가 끝났을 때 `missed`가 비면 `done = true`, 남아 있으면 `missed`로 새 바퀴를 시작)

- [ ] **Step 1: 실패하는 테스트를 쓴다.**

```js
test("createRetry: 틀린 문항들만 들어 있다", /* pass의 id 집합 == wrong의 id 집합 */);
test("정답이면 다음 바퀴에 나오지 않고, 오답이면 다음 바퀴에 다시 나온다", /* 3문항: 1번 정답, 2·3번 오답 → 새 pass의 id는 2·3번 */);
test("모두 맞히면 done이 되고 retryCurrent는 null이다", /* ... */);
test("한 문항을 두 번 연속 답해도 두 번째는 null이다 (이중 입력)", /* ... */);
test("retryNext: 답하기 전에는 false이고 pos가 변하지 않는다", /* ... */);
test("새 바퀴가 되면 보기가 다시 섞이고 정답 보기의 글자는 그대로다", /* choices[answerIndex] 유지 */);
test("틀린 문항이 0개면 곧바로 done이다", /* createRetry([]) */);
```

- [ ] **Step 2: 실패를 확인한다.** `node --test tests/logic.test.js` → FAIL.
- [ ] **Step 3: 구현한다.** `createRetry`는 `shuffle(wrongItems).map(i => shuffleItem(i, rng))`로 첫 바퀴를 만든다. 새 바퀴도 같은 방식으로 `missed`를 섞어 만든다. 원본 `GameState.wrong`은 바꾸지 않는다. `module.exports`에 `createRetry`, `retryCurrent`, `retryAnswer`, `retryNext`를 추가한다.
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: 틀린 문제 다시 풀기 로직"
```

### Task 15: 틀린 문제 다시 풀기 화면

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `app`, `renderQuestion`, `renderResult`, `createRetry`, `retryCurrent`, `retryAnswer`, `retryNext`, `NO_RECORD_NOTICE`
- Produces: `#btn-retry`(결과 화면), `startRetry(): void`, `renderRetryItem(): void`, `#screen-retry-done`(`복습 완료`와 [처음으로])

- [ ] **Step 1: 문제 그리기를 공용으로 만든다.** `renderQuestion`에서 한 문항을 그리는 부분을 `renderItem(item: RoundItem, progressText: string): void`로 분리한다. 기존 동작은 바뀌지 않아야 한다. 분리 후 `node --test`와 1단계 직접 확인 항목 2~3번으로 확인한다.
- [ ] **Step 2: 버튼을 노출한다.** `renderResult`에서 `app.mode === "practice"`이면 `#btn-retry`를 항상 보여 준다. 틀린 문제가 없으면(`app.state.wrong.length === 0`) 비활성화하고 `#retry-note`에 `틀린 문제가 없어요`를 쓴다(채점 기준: 결과 화면에 버튼이 있어야 함, Review Focus 5).
- [ ] **Step 3: 다시 풀기 진행을 구현한다.** `startRetry`는 `app.retry = createRetry(app.state.wrong)` 뒤 `renderRetryItem()`을 호출한다. 진행 표시는 `다시 풀기 · 남은 N문제`, 화면에는 `NO_RECORD_NOTICE`를 표시하고 점수는 표시하지 않는다. 보기를 고르면 `retryAnswer`로 판정하고 ✓/✗, 해설, 출처를 보여 주며, [다음]은 `retryNext`가 `true`일 때만 진행한다. `retryCurrent`가 `null`이면 `#screen-retry-done`을 보여 준다. 처음 결과 점수(`app.state.score`)는 건드리지 않는다.
- [ ] **Step 4: 자동 테스트를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 브라우저로 2단계 직접 확인 항목 12~15번을 확인한다. 이어서 1단계와 2단계 항목을 빠르게 다시 훑어 깨진 것이 없는지 본다.**
- [ ] **Step 6: 커밋한다.**

```bash
git add index.html style.css script.js && git commit -m "feat: 틀린 문제 다시 풀기 화면"
```

### Task 20: CLAUDE.md와 저장소 점검 (채점 기준 반영)

**Files:**
- Create: `CLAUDE.md`
- Modify: `PRD.md`(화면 흐름을 카테고리 → 모드 순서로 정정)

- [ ] **Step 1: `CLAUDE.md`를 만든다.** 프로젝트 개요, 파일 역할, 실행·테스트 명령(`node --test`), 작업 방식(테스트 먼저), 화면 흐름(카테고리 → 모드), 모드 규칙 요약, 그리고 **문항 작성 규칙(5.4.2)** 절을 넣는다. 이 절에는 정답 1개, 해설에 확인한 출처 명시, 최상급 표현의 기준·시점 명시 세 규칙과 문항 검수 체크리스트를 그대로 적는다.
- [ ] **Step 2: 저장소 파일을 점검한다.** 루트에 `PRD.md`, `IMPL-PLAN.md`, `CLAUDE.md`가 정확히 이 대소문자로 있는지 `ls`로 확인한다.
- [ ] **Step 3: `PRD.md`의 화면 흐름(6장)과 연습 모드 시작 화면 문구를 카테고리 → 모드 순서에 맞게 고친다.**
- [ ] **Step 4: 커밋한다.**

```bash
git add CLAUDE.md PRD.md && git commit -m "docs: CLAUDE.md 추가와 화면 흐름 정정"
```

---

# 3단계: 점수 저장과 순위표

## 만들 것
- 닉네임을 처음 한 번만 입력해 `localStorage`에 저장한다. 입력은 **판이 끝난 결과 화면**에서 받는다(스피드·힌트 판이 시작 전에 끊기지 않게 하려는 것, 채점 기준의 스피드·힌트 항목을 깨지 않기 위함).
- 스피드·힌트 판이 끝나면 자동으로 순위표에 기록(연습은 기록 안 함)
- 순위표 화면: 스피드·힌트 × 카테고리 4개 = 8개 표, 상위 10건, 동점이면 최근 기록이 위
- 저장소 사용 불가·손상 시 안내만 보여 주고 퀴즈는 계속됨

## 완료 기준
- 연습 모드 결과는 어떤 표에도 기록되지 않는다.
- 8개 표가 서로 섞이지 않는다.
- 각 표는 상위 10건만 유지되고, 동점이면 최근 기록이 위에 온다.
- 브라우저를 닫았다 다시 열어도 기록과 닉네임이 남는다.
- 저장소가 막혔거나 저장된 값이 깨져 있어도 앱이 멈추지 않는다.
- `node --test`가 통과한다.

## 내가 브라우저에서 직접 확인할 항목
- [ ] 1. 스피드(또는 힌트) 모드는 닉네임 입력 없이 곧바로 시작한다(스피드는 `남은 시간 15초`부터). 첫 판을 끝내면 결과 화면에 닉네임 입력 칸이 나온다. 빈 값, 공백만 있는 값, 13자 이상은 안내 문구와 함께 거부된다. 1~12자를 입력하고 [기록하기]를 누르면 순위가 나온다.
- [ ] 2. 두 번째 판부터는 닉네임을 묻지 않고 판이 끝나면 곧바로 기록된다. 새로고침과 브라우저 재시작 뒤에도 같은 닉네임이 쓰인다.
- [ ] 3. 판을 끝내면 결과 화면에 `N위` 또는 `순위권 밖`이 나온다.
- [ ] 4. 카테고리 선택 화면의 [순위표 보기]에서 모드(스피드, 힌트)와 카테고리(4개)를 바꿔 가며 8개 표를 본다. 한국사 스피드 기록이 과학 스피드나 한국사 힌트 표에 나타나지 않는다.
- [ ] 5. 연습 모드로 판을 끝낸 뒤 순위표를 봐도 어느 표에도 기록이 늘지 않는다. 결과 화면에는 `순위표에 기록되지 않음`이 있다.
- [ ] 6. 같은 모드·카테고리에서 같은 점수를 두 번 기록하면 나중 기록이 위에 있다.
- [ ] 7. 같은 표에 11판 이상 기록하면 표에는 10건만 남는다. 10건이 찬 뒤 더 낮은 점수는 `순위권 밖`이 되고 표가 바뀌지 않는다.
- [ ] 8. 기록의 날짜가 `YYYY-MM-DD`(예: `2026-10-10`) 형식이다.
- [ ] 9. 힌트 모드에서 0.5점 단위 점수(예: `7.5`)가 순위표에 그대로 보이고 정렬이 맞다.
- [ ] 10. 순위표 화면에서 닉네임을 바꾸면 이후 기록부터 새 닉네임이 쓰이고, 이미 있는 기록의 닉네임은 그대로다.
- [ ] 11. 닉네임을 `<b>x</b>`로 바꾸면 순위표에 그 글자가 그대로 보이고 굵게 표시되지 않는다.
- [ ] 12. F12 → Application → Local Storage에서 `quiz:v1:board:speed:한국사` 값을 `{{{`로 바꾸고 새로고침한다. 오류 없이 앱이 열리고 그 표는 빈 표로 보인다.
- [ ] 13. (선택) 브라우저의 저장소 차단을 켜거나 시크릿 모드에서 판을 끝낸다. 결과 화면에 저장할 수 없다는 안내가 보이고, 퀴즈는 정상으로 진행된다.

## 태스크

### Task 16: 순위표 기록 로직

**Files:**
- Modify: `script.js`, `tests/logic.test.js`

**Interfaces:**
- Produces: `BOARD_LIMIT = 10`, `addRecord(table: BoardRecord[], record: BoardRecord, limit?: number): { table: BoardRecord[], rank: number | null }`(입력 `table`은 바꾸지 않음. 점수 높은 순이고, 같은 점수의 기존 기록보다 새 기록이 위. `limit`을 넘으면 맨 아래를 버리고, 새 기록이 들지 못하면 `rank`는 `null`이며 `table`은 그대로), `normalizeNickname(input: unknown): string | null`(앞뒤 공백 제거 후 1~12자(코드 포인트 기준)이면 그 문자열, 아니면 `null`), `todayString(date?: Date): string`(`YYYY-MM-DD`, 로컬 날짜)

- [ ] **Step 1: 실패하는 테스트를 쓴다.**

```js
test("addRecord: 빈 표에 넣으면 rank 1", /* ... */);
test("addRecord: 점수 내림차순", /* 7, 9, 8 순서로 넣어도 9,8,7 */);
test("addRecord: 동점이면 새 기록이 위", /* 기존 8(old) + 새 8(new) → table[0].nickname === "new", rank 1 */);
test("addRecord: 10건이 차면 맨 아래가 밀려난다", /* 10..1점 표에 5점 추가 → length 10, 기존 5점 바로 위로 rank 6, 1점 제거 */);
test("addRecord: 10건이 차고 모두 6점 이상이면 5점은 rank null이고 표가 그대로다", /* ... */);
test("addRecord: 꼴찌와 동점이면 새 기록이 들어가고 옛 꼴찌가 밀려난다", /* 최저 5점 + 새 5점 → rank 10 */);
test("addRecord: 0.5점 단위 정렬", /* 7.5, 7, 8 → 8, 7.5, 7 */);
test("addRecord: 입력 표를 바꾸지 않는다", /* deepEqual 원본 */);
test("normalizeNickname", () => {
  assert.equal(normalizeNickname("  민수  "), "민수");
  assert.equal(normalizeNickname(""), null);        assert.equal(normalizeNickname("   "), null);
  assert.equal(normalizeNickname("가".repeat(12)), "가".repeat(12));
  assert.equal(normalizeNickname("가".repeat(13)), null);
  assert.equal(normalizeNickname(123), null);       assert.equal(normalizeNickname(null), null);
  assert.equal(normalizeNickname("<b>x</b>"), "<b>x</b>");
});
test("todayString", () => assert.equal(todayString(new Date(2026, 9, 10)), "2026-10-10"));
```

- [ ] **Step 2: 실패를 확인한다.** `node --test tests/logic.test.js` → FAIL.
- [ ] **Step 3: 구현한다.** `addRecord`는 새 기록을 "점수가 같거나 낮은 첫 기존 기록" 앞에 넣고 `limit`으로 자른다. `module.exports`에 `BOARD_LIMIT`, `addRecord`, `normalizeNickname`, `todayString`을 추가한다. HTML 문자는 거부하지 않는다(표시할 때 `textContent`로 안전하게 처리한다).
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: 순위표 기록 로직과 닉네임 검사"
```

### Task 17: 저장소 계층

**Files:**
- Modify: `script.js`, `tests/helpers.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: `addRecord`, `BoardRecord`, `BOARD_LIMIT`
- Produces: `StorageLike = { getItem(key): string | null, setItem(key, value): void }`, `getStorage(): StorageLike | null`(브라우저에서 `window.localStorage`, 접근이 막히거나 `window`가 없으면 `null`), `boardKey(mode: string, category: string): string`(`"quiz:v1:board:<mode>:<category>"`), `NICKNAME_KEY = "quiz:v1:nickname"`, `loadBoard(storage: StorageLike | null, mode, category): BoardRecord[]`(없거나 깨졌거나 배열이 아니면 `[]`, 형식이 틀린 항목은 걸러냄), `saveBoard(storage, mode, category, table): boolean`, `loadNickname(storage): string | null`, `saveNickname(storage, name: string): boolean`, `recordResult(storage, mode, category, record: BoardRecord): { status: "ranked" | "outside" | "unavailable", rank: number | null }`, 테스트 도구 `FakeStorage`(Map 기반, `throwOnSet` 옵션)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** (Review Focus 3)

```js
test("boardKey와 닉네임 키", () => {
  assert.equal(boardKey("speed", "한국사"), "quiz:v1:board:speed:한국사");
  assert.equal(NICKNAME_KEY, "quiz:v1:nickname");
});
test("loadBoard: 값이 없으면 []", /* ... */);
test("loadBoard: 깨진 JSON이면 []", /* "{{{" */);
test("loadBoard: 배열이 아닌 JSON이면 []", /* '{"a":1}' */);
test("loadBoard: 형식이 틀린 항목은 걸러낸다", /* score가 문자열, nickname 없음 */);
test("storage가 null이면 load는 []/null, save는 false", /* ... */);
test("setItem이 throw하면 save는 false이고 예외가 밖으로 나오지 않는다", /* quota */);
test("recordResult: 정상이면 ranked와 rank, 저장된다", /* loadBoard로 확인 */);
test("recordResult: 10건이 차고 낮은 점수면 outside이고 저장 내용이 그대로다", /* ... */);
test("recordResult: storage null 또는 저장 실패면 unavailable", /* ... */);
test("표가 모드·카테고리별로 격리된다", /* speed/한국사에 기록 → hint/한국사, speed/과학은 [] */);
test("getStorage: window가 없는 환경(Node)에서는 null", () => assert.equal(getStorage(), null));
test("닉네임 저장과 불러오기", /* saveNickname → loadNickname 같은 값, 없으면 null */);
```

- [ ] **Step 2: 실패를 확인한다.** `node --test tests/logic.test.js` → FAIL.
- [ ] **Step 3: 구현한다.** 모든 `getItem`/`setItem`/`JSON.parse`는 `try/catch`로 감싸 실패해도 예외를 던지지 않는다. `recordResult`는 `loadBoard` → `addRecord` → (`rank`가 있으면) `saveBoard` 순서로 하고, 저장이 실패하면 `unavailable`을 돌려준다. `module.exports`에 새 이름을 모두 추가한다.
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add script.js tests/ && git commit -m "feat: localStorage 저장소 계층과 기록 저장"
```

### Task 18: 결과 화면에서 닉네임 입력과 순위표 기록

**Files:**
- Modify: `index.html`, `style.css`, `script.js`, `tests/fake-dom.js`, `tests/dom.test.js`

**Interfaces:**
- Consumes: `app`, `renderResult`, `startRound`, `getStorage`, `loadNickname`, `saveNickname`, `normalizeNickname`, `recordResult`, `todayString`, `formatScore`
- Produces: 결과 화면의 `#record-status`, `#nickname-form`(입력 `#nickname-input`, 안내 `#nickname-error`, 버튼 `#btn-nickname-save`), `app.nickname`, `app.recorded`(그 판에서 이미 기록했는지), `prepareRecord(): void`, `saveRecord(): void`, `onNicknameSave(): void`, 테스트 도구 `loadApp({ storage })`(가짜 `window.localStorage` 주입)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 스피드·힌트 판은 닉네임 없이 곧바로 시작한다. 닉네임이 없는 첫 판의 결과에는 `#nickname-form`이 보이고 기록은 아직 저장되지 않는다. 빈 값·공백·13자는 `#nickname-error`를 보이고 저장하지 않는다. 올바른 닉네임을 저장하면 `N위에 올랐어요`가 나오고 표에 기록된다. 닉네임이 이미 저장되어 있으면 폼 없이 곧바로 기록된다. 한 판은 한 번만 기록된다(`saveRecord`를 두 번 불러도 한 건). 연습 모드는 폼도 기록도 없다. 저장소가 없으면 `기록을 저장할 수 없어요`가 나온다. 10건이 찬 표에 낮은 점수면 `순위권 밖`이 나온다. 닉네임에 `<b>x</b>`가 들어가도 화면에는 글자 그대로다.
- [ ] **Step 2: 실패를 확인한다.** `node --test tests/dom.test.js` → FAIL.
- [ ] **Step 3: 구현한다.** `renderResult`가 스피드·힌트 모드이면 `prepareRecord()`를 부른다. 저장된 닉네임이 있으면 `saveRecord()`로 곧바로 기록하고, 없으면 `#nickname-form`을 보여 준다. `saveRecord`는 `app.recorded`가 참이면 아무것도 하지 않고, 아니면 `recordResult(getStorage(), app.mode, app.category, { nickname, score, date: todayString() })`를 한 번 부른 뒤 결과 문구를 `#record-status`에 `textContent`로 쓴다(`ranked`: `N위에 올랐어요`, `outside`: `순위권 밖`, `unavailable`: `기록을 저장할 수 없어요 (브라우저 저장소를 쓸 수 없음)`). `startRound`는 `app.recorded = false`로 되돌린다.
- [ ] **Step 4: 통과를 확인한다.** `node --test` → PASS.
- [ ] **Step 5: 커밋한다.**

```bash
git add index.html style.css script.js tests/ && git commit -m "feat: 결과 화면에서 닉네임 입력과 순위표 기록"
```

### Task 19: 순위표 화면과 최종 점검

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `app`, `showScreen`, `MODES`, `MODE_LABELS`, `CATEGORIES`, `getStorage`, `loadBoard`, `loadNickname`, `saveNickname`, `normalizeNickname`, `formatScore`
- Produces: `#screen-board`(모드 탭 2개, 카테고리 탭 4개, 표 `#board-table`, 닉네임 변경 영역), `renderBoard(mode: string, category: string): void`, 카테고리 선택 화면의 [순위표 보기] 버튼, 결과 화면(스피드·힌트)의 [순위표 보기] 버튼

- [ ] **Step 1: 마크업과 버튼을 추가한다.** 모드 탭은 스피드·힌트만(연습은 기록이 없으므로 제외), 카테고리 탭은 4개다. 홈에 [순위표], 스피드·힌트 결과 화면에 [순위표 보기](그 판의 모드·카테고리 표로 이동)를 둔다.
- [ ] **Step 2: `renderBoard`를 구현한다.** `loadBoard`로 불러온 표를 순위, 닉네임, 점수(`formatScore`), 날짜 열로 그린다. 모든 칸은 `createElement`와 `textContent`로 만든다(Review Focus 4). 기록이 없으면 `아직 기록이 없어요`를 보여 준다. 저장소를 쓸 수 없으면 `기록을 불러올 수 없어요`를 함께 보여 준다.
- [ ] **Step 3: 닉네임 변경을 구현한다.** 현재 닉네임을 보여 주고, 입력 후 [변경]을 누르면 `normalizeNickname`을 통과한 값만 `saveNickname`과 `app.nickname`에 반영한다. 이미 저장된 기록은 바꾸지 않는다. 거부되면 `1~12자로 입력해 주세요`를 보여 준다.
- [ ] **Step 4: 전체 자동 테스트를 실행한다.** `node --test` → 전체 PASS.
- [ ] **Step 5: 브라우저로 3단계 직접 확인 항목 1~13번을 모두 확인한다.**
- [ ] **Step 6: 최종 회귀 점검을 한다.** 1단계 직접 확인 항목 1~10번, 2단계 항목 1~15번을 한 번씩 다시 훑는다. 그리고 폴더에 배포 파일이 `index.html`, `style.css`, `script.js`, `questions.js` 4개뿐인지(`tests/`와 문서 제외), 외부 주소 요청이 없는지(F12 → Network 탭에서 `file://` 외 요청이 없음) 확인한다.
- [ ] **Step 7: 커밋한다.**

```bash
git add index.html style.css script.js && git commit -m "feat: 순위표 화면과 닉네임 변경"
```

---

## Self-Review 결과

1. **PRD 커버리지:** 개요·범위(1~2장) → 전체 구조와 단계별 만들 것. 환경 제약 3장 → Global Constraints, Task 1, 8. 게임 규칙 4장 → Task 7, 9~15. 문항 규칙 5장 → Task 2~6. 화면 6장 → Task 8, 9, 11, 15, 18, 19. 순위표 7장 → Task 16~19. 구현 단계 8장 → 1~3단계의 완료 기준.
2. **이름 일관성:** `recordAnswer(state, choiceIndex)`는 `hintUsed`를 인자가 아니라 `state.hintUsed`로 읽는다(Task 7, 10, 12 일치). `scoreFor(mode, correct, hintUsed)`, `useHint`, `secondsLeft`, `retry*`, `addRecord`, `recordResult`는 정의한 태스크와 사용하는 태스크의 시그니처가 같다.
3. **Review Focus 5개:** 각각 담당 태스크에 테스트나 직접 확인 항목이 있다.
4. **PRD에서 정하지 않아 이 계획이 정한 값:** 닉네임은 1~12자 / 닉네임 입력 시점은 첫 스피드·힌트 판 시작 전 / `formatScore`는 정수는 소수점 없이(`8`), 소수는 한 자리(`7.5`) / 다시 풀기의 새 바퀴마다 보기를 다시 섞음 / 최상급 검사 테스트는 휴리스틱이므로 사람의 문항 검수(PRD 5.1)를 대체하지 않음.
