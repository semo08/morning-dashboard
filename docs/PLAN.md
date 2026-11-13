# ☀️ 아침 투두 대시보드 기획서

> 매일 아침 새 탭에서 "오늘 뭐부터 하지?"를 바로 알 수 있는 대시보드.
> 기존 Momentum 클론(Chrome-application)을 새 repo에서 다시 만든다.

- 디자인 시안: [아침 투두 대시보드](https://claude.ai/artifact/MhSZHoLMDAEZwXYQvNEdeq)
- 형태: 웹으로 먼저 만들고, 나중에 크롬 확장(툴바 아이콘으로 열기)으로 바꾼다. 배포(GitHub Pages)는 하지 않는다.
- GitHub repo는 배포용이 아니라 코드 보관·컴퓨터 간 공유용이다.
- 기술: HTML, CSS, Vanilla JS, localStorage (서버 없음)

---

## 1. 기능 목록

| 단계 | 기능 | 설명 |
|---|---|---|
| **1** | 폴더 트리 | 폴더 최대 4단계, 추가·수정·삭제, 펼치기·접기, 폴더별 필터 |
| **1** | 투두 강화 | 마감일, 매일 반복, 완료 체크 |
| **1** | 마감 기준 그룹 | 지난 마감 / 오늘 / 이번 주 / 나중에 |
| 2 | 레이아웃 + 테마 | 헤더(인사말·시계), 3단 레이아웃, 테마 5종 |
| 3 | 작업 보드 | 진행 중인 작업 카드(마지막/다음/막힘), "다음 할 일 → 투두로" |
| 3 | 어제의 메모 | 퇴근 체크아웃 때 쓴 한 줄을 아침에 맨 위에 표시 |
| 4 | D-day | 추가/삭제, 헤더에 칩으로 표시 |
| 4 | 잔디 + 진행률 | 날짜별 완료 개수 기록, 최근 18주 그래프 |
| 5 | 배경 사진 | 사진 선택 → 줄여서 저장 |
| 6 | 크롬 확장 | manifest + 툴바 아이콘을 누르면 대시보드 탭 열기 (새 탭은 그대로) |
| 7 | 연차 계산기 | 근로기준법대로 받은 연차 계산 + 직접 입력, 사용·예정 게이지, 달력 표시 |

**이번 작업 범위 = 1단계 (투두 강화)**

---

## 2. 데이터 구조

모든 데이터는 localStorage에 JSON 문자열로 저장한다.

### folders
```javascript
[
  { id: "work", name: "업무", parentId: null, color: "work" },
  { id: "dev", name: "개발", parentId: "work" },
  { id: "side", name: "사이드", parentId: null, color: "side" },
  { id: "gedanken", name: "Gedanken Lab", parentId: "side" },
  { id: "study", name: "공부", parentId: null, color: "study" },
  { id: "en", name: "영어", parentId: "study" }
]
```
- `parentId`가 `null`이면 상위 폴더다.
- 폴더는 상위 폴더 포함 **4단계까지** 허용한다. (`MAX_DEPTH` in `folders.js`)

### todos
```javascript
[
  {
    id: "t_1731300000000",
    text: "트롤리 장면 1 코딩",
    folderId: "gedanken",
    due: "2026-11-12",        // 마감일 없으면 null
    repeat: false,            // 매일 반복
    done: false,
    doneAt: null,             // 완료한 날짜 (잔디용)
    createdAt: "2026-11-11"
  }
]
```
- `id`는 `"t_" + Date.now()`로 만든다.

### 나중 단계에서 추가할 것
```javascript
board:    [{ id, title, folderId, progress, last, next, blocked, updatedAt }]
memo:     { text, writtenAt }
ddays:    [{ id, title, date }]
history:  { "2026-11-12": 3 }       // 날짜별 완료 개수
settings: { theme: "sunny", name: "Sehwa", leave: { hireDate: "2024-03-02", basis: "hire" | "fiscal", custom: { start: "2026-03-02", days: 17 } | null } }
leaves:   [{ id, start: "2026-12-24", end: "2026-12-28", unit: 1 | 0.5 | 0.25, memo }]   // 연차 기록 (주말·공휴일은 세지 않는다)
background: "data:image/jpeg;base64,…" // 배경 사진 (긴 변 1920px로 줄인 JPEG)
holidays: { fetchedAt: 1763000000000, days: { "2026-09-25": "추석" } } // 구글 캘린더에서 받은 공휴일 (확장에서만, 일주일마다 갱신)
```

---

## 3. 폴더 구조

```
morning-dashboard/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ storage.js     # localStorage 읽기/쓰기
│  ├─ folders.js     # 폴더 트리 렌더링, 선택
│  ├─ todos.js       # 투두 추가/완료/삭제, 그룹 나누기
│  └─ main.js        # 시작점, 이벤트 연결
└─ docs/
   └─ PLAN.md
```
- `<script type="module">`을 쓰면 파일끼리 `import`/`export`할 수 있다.
- module은 파일을 더블클릭하면 동작하지 않는다 → **VS Code Live Server**로 연다.

---

## 4. 1단계 작업 순서 (오늘 밤)

### Step 1. 기본 세팅 (15분)
- [ ] 새 repo 만들고 위 폴더 구조대로 빈 파일 생성
- [ ] `index.html`에 화면 뼈대: 왼쪽 `<nav id="folder-tree">`, 오른쪽 `<section id="todo-panel">`
- [ ] Live Server로 열어서 확인

### Step 2. 저장소 함수 (15분) — `storage.js`
```javascript
export function load(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
```
- [ ] 처음 실행 시 folders가 없으면 기본 폴더(업무/사이드/공부)를 넣어둔다.

### Step 3. 폴더 트리 그리기 (40분) — `folders.js`
- [ ] 상위 폴더 = `parentId === null`
- [ ] 각 상위 폴더 아래에 `parentId === 상위.id`인 하위 폴더 표시
- [ ] ▸ 버튼으로 펼치기/접기 (펼친 상태도 저장)
- [ ] 폴더를 클릭하면 `selectedFolder`가 바뀌고 투두 목록을 다시 그린다
- [ ] 트리 맨 위 "전체"를 누르면 전체 목록으로 돌아간다 (고른 폴더를 다시 눌러도 같다)
- [ ] 폴더 옆에 투두 개수 표시

```javascript
// 선택한 폴더에 속하는 투두인지 확인
function inFolder(todo, selectedId, folders) {
  if (selectedId === "all") return true;
  if (todo.folderId === selectedId) return true;
  // 상위 폴더를 선택했으면 하위 폴더 투두도 포함
  const folder = folders.find(f => f.id === todo.folderId);
  return folder && folder.parentId === selectedId;
}
```

### Step 4. 투두 추가 (30분) — `todos.js`
- [ ] 입력칸: 할 일, 폴더(select), 마감일(`<input type="date">`), 매일 반복(checkbox)
- [ ] 폴더 select에는 하위 폴더를 `"사이드 › Gedanken Lab"` 형식으로 보여준다
- [ ] 추가 버튼 또는 Enter → todos 배열에 push → save → 다시 그리기

### Step 5. 마감 기준 그룹 나누기 (40분) ⭐ 핵심
```javascript
function getGroup(todo) {
  if (!todo.due) return "later";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(todo.due + "T00:00:00");
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";   // 지난 마감
  if (diffDays === 0) return "today";   // 오늘
  if (diffDays <= 7) return "week";     // 이번 주
  return "later";                        // 나중에
}
```
- [ ] 그룹 순서: 지난 마감 → 오늘 → 이번 주 → 나중에
- [ ] 비어 있는 그룹은 숨긴다
- [ ] 지난 마감은 배경을 연한 주황으로 강조하고 "2일 지남"처럼 표시한다
- [ ] 매일 반복 투두는 항상 "오늘" 그룹에 넣는다

### Step 6. 완료 체크 + 삭제 (20분)
- [ ] 체크하면 `done: true`, `doneAt: 오늘 날짜` → 취소선
- [ ] 매일 반복 투두는 날짜가 바뀌면 `done`을 다시 `false`로 (앱을 열 때 확인)
- [ ] 기존에 만들었던 **삭제 되돌리기(Ctrl+Z)** 가져오기

### Step 7. 커밋
- [ ] `feat: 폴더 트리와 마감 기준 투두 그룹` 으로 커밋

---

## 5. 디자인 메모 (1단계에 필요한 것만)

| 용도 | 색 |
|---|---|
| 배경 | `#FAF6EC` |
| 카드 | `#FFFFFF` |
| 글자 | `#2B3242` |
| 보조 글자 | `#5F6676` |
| 선택된 폴더 | `#F1E5BF` |
| 지난 마감 배경 / 글자 | `#F7ECE5` / `#9B4428` |
| 업무 태그 배경 / 글자 | `#E6EDF5` / `#36577D` |
| 사이드 태그 배경 / 글자 | `#E4EFE8` / `#3A664D` |
| 공부 태그 배경 / 글자 | `#F4E8DF` / `#845033` |

- 색은 CSS 변수(`--bg`, `--card`, `--text` …)로 만들어둔다. 2단계 테마 기능 때 변수만 바꾸면 된다.
- 폰트: IBM Plex Sans KR (본문), Space Grotesk (시계, 숫자)

---

## 6. 크롬 확장으로 바꾸기 (6단계)

웹으로 다 만든 뒤, 폴더에 `manifest.json` 하나만 추가하면 된다.
```json
{
  "manifest_version": 3,
  "name": "Morning Dashboard",
  "version": "1.0",
  "action": { "default_title": "Morning Dashboard 열기" },
  "background": { "service_worker": "service-worker.js" },
  "host_permissions": ["https://calendar.google.com/*"],
  "icons": { "16": "icons/icon-16.png", "128": "icons/icon-128.png" }
}
```
### 설치 방법
1. `chrome://extensions` 접속
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램 로드** → `morning-dashboard` 폴더 선택
4. 툴바에 핀으로 고정한 아이콘을 누르면 대시보드가 뜬다. (처음엔 새 탭 교체였지만, 새 탭마다 뜨는 게 불편해서 아이콘 방식으로 바꿈)

### 배포가 필요 없는 이유
- 크롬이 **내 컴퓨터의 폴더를 직접 읽어서** 실행하기 때문에 GitHub Pages 같은 배포가 필요 없다.

### 운영 메모
- **코드를 고치면** `chrome://extensions`에서 🔄 새로고침을 눌러야 반영된다.
- **회사 PC와 집 PC 모두 사용:** 각 컴퓨터에서 repo를 clone하고 위 설치 방법을 한 번씩 진행한다. 코드 업데이트는 `git pull` 후 새로고침.
- **데이터는 컴퓨터마다 따로 저장된다.** 회사에서 쓴 투두는 집에서 보이지 않는다.
  - 업무 투두는 회사 PC, 개인 투두는 집 PC로 나눠 써도 된다.
  - 동기화가 필요해지면 `chrome.storage.sync`로 바꾸는 것을 검토한다. (같은 구글 계정끼리 동기화, 용량이 작음)
- 웹으로 개발하던 중에 쌓인 localStorage 데이터는 확장으로 옮겨지지 않는다 (주소가 달라서). 필요하면 JSON 내보내기/가져오기 기능을 만든다.
- 다른 사람에게 배포하려면 크롬 웹 스토어에 등록한다. (개발자 등록비 1회, 심사 있음) → 지금은 계획 없음.

---

## 7. 연차 계산기 (7단계)

### 계산 규칙 (근로기준법 제60조)
| 근속 | 연차 |
|---|---|
| 1년 미만 | 한 달 채울 때마다 1일 (최대 11일) |
| 1년 이상 | 15일 |
| 3년 이상 | 2년마다 1일 추가 (최대 25일) |

- **입사일 기준:** 입사 기념일마다 새 기간이 시작된다.
- **회계연도 기준 (1월 1일):** 입사한 해는 월차만, 다음 해는 `15 × 입사한 해에 일한 날 / 그해 날수` + 남은 월차, 그다음 해부터 15일(2년마다 +1).
  - 입사한 해에 생긴 월차가 다음 해로 넘어가는 것은 계산하지 않는다. 다르면 직접 입력으로 고친다.
- **직접 입력:** 꾸미기 → 연차 → "이번 기간에 받은 연차". 그 기간에만 쓰이고, 기간이 바뀌면 다시 법정 개수로 돌아간다.
- 연차 1일 / 반차 0.5일 / 반반차 0.25일. 여러 날을 고르면 **주말과 공휴일은 빼고** 센다.

### 화면
- 오른쪽 열, 오늘 진행률 아래 카드: 남은 개수 / 받은 개수, 게이지(사용 = 진한 보라, 예정 = 옅은 보라 빗금), 기간·다음 발생일, 이번 기간 기록 목록(누르면 고치기·삭제), "+ 연차 쓰기".
- 오늘까지의 날은 사용, 내일부터는 예정으로 센다.
- 카드의 ‹ › 로 지난 기간·다음 기간을 넘겨본다. 지난 기간은 그 기간 마지막 날 기준으로 계산한다(월차가 다 쌓인 상태). 다른 기간 날짜로 연차를 넣으면 그 기간으로 넘어가서 보여준다.
- 달력: 연차는 칸 전체, 반차·반반차는 칸 아래 절반을 보라색으로.
- 잔디는 왼쪽 좁은 열에서 폴더 트리("할 일") 위로 옮기고, 열 폭을 240px → 280px로 넓혔다. 카드 폭에 들어가는 만큼 보여준다.
- 작업 보드(퇴근 체크아웃 포함)는 할 일과 같은 폭으로 줄여 할 일 위에 둔다. 한 줄(휴대폰)일 땐 보드 → 잔디 → 폴더 → 할 일 순서.
