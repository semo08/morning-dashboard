// 투두 추가/완료/수정/삭제, 그룹 나누기
import { folderColor, folderLabel, folderPath, inFolder, renderFolderPicker } from "./folders.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];   // Date.getDay() 순서

// 반복 요일을 고르는 칸은 월요일부터
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_NAMES = WEEKDAYS;

export const GROUPS = [
  { id: "overdue", title: "지난 마감" },
  { id: "today", title: "오늘" },
  { id: "week", title: "이번 주" },
  { id: "later", title: "나중에" },
];

// 로컬 시간 기준 "YYYY-MM-DD" (toISOString은 UTC라 아침 9시 전엔 어제 날짜가 된다)
export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysUntil(due) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due + "T00:00:00");
  return Math.round((dueDate - today) / DAY_MS);
}

// repeat: false 또는 반복할 요일 배열 [1, 3, 5] (0 = 일요일)
export function isRepeating(todo) {
  return Array.isArray(todo.repeat) && todo.repeat.length > 0;
}

// 예전 데이터의 repeat: true(매일 반복)를 요일 배열로 바꾼다. 바뀐 게 있으면 true
export function migrateRepeats(todos) {
  let changed = false;
  for (const todo of todos) {
    if (todo.repeat === true) {
      todo.repeat = [0, 1, 2, 3, 4, 5, 6];
      changed = true;
    }
  }
  return changed;
}

// "매일" / "평일" / "주말" / "월·수·금"
export function repeatLabel(days) {
  const sorted = WEEK_ORDER.filter(d => days.includes(d));
  if (sorted.length === 7) return "매일";
  if (sorted.join() === "1,2,3,4,5") return "평일";
  if (sorted.join() === "6,0") return "주말";
  return sorted.map(d => WEEKDAYS[d]).join("·");
}

export function getGroup(todo) {
  // 반복 투두: 오늘이 반복 요일이면 오늘, 아니면 다음 반복일이 일주일 안이니 이번 주
  if (isRepeating(todo)) return todo.repeat.includes(new Date().getDay()) ? "today" : "week";
  if (!todo.due) return "later";
  const diffDays = daysUntil(todo.due);

  if (diffDays < 0) return "overdue";   // 지난 마감
  if (diffDays === 0) return "today";   // 오늘
  if (diffDays <= 7) return "week";     // 이번 주
  return "later";                        // 나중에
}

function dueLabel(todo) {
  if (!todo.due) return "";
  const diffDays = daysUntil(todo.due);
  if (diffDays < 0) return `${-diffDays}일 지남`;
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  const d = new Date(todo.due + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

export function createTodo({ text, folderId, due, repeat }) {
  return {
    id: "t_" + Date.now(),
    text,
    folderId,
    due: repeat ? null : due || null,   // 반복 투두는 마감일 대신 요일
    repeat,
    done: false,
    doneAt: null,
    createdAt: todayStr(),
  };
}

// 날짜가 바뀌었으면 반복 투두의 완료를 풀어준다. 바뀐 게 있으면 true
export function resetRepeats(todos) {
  const today = todayStr();
  let changed = false;
  for (const todo of todos) {
    if (isRepeating(todo) && todo.done && todo.doneAt !== today) {
      todo.done = false;
      todo.doneAt = null;
      changed = true;
    }
  }
  return changed;
}

// 어제 이전에 끝낸 일반 투두는 목록에서 숨긴다 (데이터는 남겨둔다)
export function isVisible(todo) {
  return !todo.done || isRepeating(todo) || todo.doneAt === todayStr();
}

// 오늘 챙겨야 할 투두 = 지난 마감 + 오늘 그룹 (헤더의 남은 개수, 진행률에 쓴다)
export function todayItems(todos) {
  return todos.filter(t => isVisible(t) && ["overdue", "today"].includes(getGroup(t)));
}

function compareTodos(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return a.id < b.id ? -1 : 1;
}

// editing: 고치는 중인 { id, field: "text" | "folder", level } (없으면 null)
export function renderTodos(container, { todos, folders, selectedId, editing, onToggleDone, onDelete, onEdit, onUpdate }) {
  container.replaceChildren();
  let toFocus = null;   // 다시 그린 뒤 포커스를 줄 칸

  const visible = todos.filter(t => inFolder(t, selectedId, folders) && isVisible(t));

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "이 폴더에는 할 일이 없어";
    container.append(empty);
    return;
  }

  for (const group of GROUPS) {
    const items = visible.filter(t => getGroup(t) === group.id).sort(compareTodos);
    if (items.length === 0) continue;   // 비어 있는 그룹은 숨긴다

    const section = document.createElement("section");
    section.className = `group group-${group.id}`;

    const head = document.createElement("h2");
    head.className = "group-title";
    const left = items.filter(t => !t.done).length;
    head.innerHTML = `<span></span><span class="num group-count"></span>`;
    head.children[0].textContent = group.title;
    head.children[1].textContent = `${left}개`;
    section.append(head);

    const list = document.createElement("ul");
    list.className = "todo-list";
    for (const todo of items) list.append(todoItem(todo, group.id));
    section.append(list);
    container.append(section);
  }
  toFocus?.focus();

  function todoItem(todo, groupId) {
    const li = document.createElement("li");
    li.className = "todo" +(todo.done ? " done" : "") + (groupId === "overdue" && !todo.done ? " overdue" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = todo.done;
    check.setAttribute("aria-label", (todo.done ? "완료 취소: " : "완료: ") + todo.text);
    check.addEventListener("change", () => onToggleDone(todo.id));

    const body = document.createElement("div");
    body.className = "todo-body";

    const isEditing = field => editing?.id === todo.id && editing.field === field;

    // 글자를 누르면 그 자리에서 고친다. Enter·바깥 클릭은 저장, Esc는 취소
    let text;
    if (isEditing("text")) {
      text = document.createElement("input");
      text.className = "todo-text-input";
      text.value = todo.text;
      text.maxLength = 200;
      text.setAttribute("aria-label", "할 일 고치기");
      let finished = false;
      const finish = commit => {
        if (finished) return;
        finished = true;
        const value = text.value.trim();
        if (commit && value && value !== todo.text) onUpdate(todo.id, { text: value });
        onEdit(null);
      };
      text.addEventListener("keydown", e => {
        if (e.isComposing) return;   // 한글 조합 중 Enter는 무시
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      });
      text.addEventListener("blur", () => finish(true));
      toFocus = text;
    } else {
      text = document.createElement("button");
      text.type = "button";
      text.className = "todo-text";
      text.textContent = todo.text;
      text.title = "눌러서 고치기";
      text.addEventListener("click", () => onEdit({ id: todo.id, field: "text" }));
    }

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    // 폴더 태그를 누르면 그 자리에 폴더 드롭다운. 고르면 바로 저장되고, 바깥을 누르거나 Esc로 닫는다
    const color = folderColor(todo.folderId, folders);
    const label = folderLabel(todo.folderId, folders);
    if (isEditing("folder")) {
      const picker = document.createElement("div");
      picker.className = "folder-picker todo-folder-edit";
      renderFolderPicker(picker, {
        folders,
        path: folderPath(folders, todo.folderId).map(f => f.id),
        onChange: (path, level) => {
          if (path.length) onUpdate(todo.id, { folderId: path.at(-1) }, { field: "folder", level });
        },
      });
      picker.addEventListener("keydown", e => {
        if (e.key === "Escape") onEdit(null);
      });
      meta.append(picker);
      toFocus = picker.querySelectorAll("select")[editing.level ?? 0] ?? null;
    } else if (label) {
      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = `tag c-${color}`;
      tag.textContent = label;
      tag.title = "눌러서 폴더 바꾸기";
      tag.addEventListener("click", () => onEdit({ id: todo.id, field: "folder" }));
      meta.append(tag);
    }
    if (isRepeating(todo)) {
      const rep = document.createElement("span");
      rep.className = "meta-repeat";
      rep.textContent = `↻ ${repeatLabel(todo.repeat)}`;
      meta.append(rep);
    }
    // 마감일을 누르면 바로 날짜 고르기. 반복 할 일은 마감일이 없다
    if (!isRepeating(todo)) {
      const due = document.createElement("label");
      due.className = "meta-due" + (todo.due ? "" : " meta-due-empty");
      due.textContent = dueLabel(todo) || "+ 마감일";
      const input = document.createElement("input");
      input.type = "date";
      input.className = "due-input";
      input.value = todo.due ?? "";
      input.setAttribute("aria-label", "마감일 바꾸기");
      // 칸 어디를 눌러도 달력이 뜨게
      const open = () => {
        try {
          input.showPicker();
        } catch {
          // 지원하지 않는 브라우저: 기본 동작에 맡긴다
        }
      };
      input.addEventListener("click", e => {
        e.preventDefault();
        open();
      });
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
      // 달력의 '삭제'를 누르면 마감일 없음
      input.addEventListener("change", () => onUpdate(todo.id, { due: input.value || null }));
      due.append(input);
      meta.append(due);
    }

    body.append(text, meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.textContent = "×";
    del.setAttribute("aria-label", "삭제");
    del.addEventListener("click", () => onDelete(todo.id));

    li.append(check, body, del);
    return li;
  }
}
