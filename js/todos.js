// 투두 추가/완료/삭제, 그룹 나누기
import { folderColor, folderLabel, inFolder } from "./folders.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

export function getGroup(todo) {
  if (todo.repeat) return "today";        // 매일 반복은 항상 오늘
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
    due: repeat ? null : due || null,
    repeat,
    done: false,
    doneAt: null,
    createdAt: todayStr(),
  };
}

// 날짜가 바뀌었으면 매일 반복 투두의 완료를 풀어준다. 바뀐 게 있으면 true
export function resetRepeats(todos) {
  const today = todayStr();
  let changed = false;
  for (const todo of todos) {
    if (todo.repeat && todo.done && todo.doneAt !== today) {
      todo.done = false;
      todo.doneAt = null;
      changed = true;
    }
  }
  return changed;
}

// 어제 이전에 끝낸 일반 투두는 목록에서 숨긴다 (데이터는 남겨둔다)
export function isVisible(todo) {
  return !todo.done || todo.repeat || todo.doneAt === todayStr();
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

export function renderTodos(container, { todos, folders, selectedId, onToggleDone, onDelete }) {
  container.replaceChildren();

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

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    const color = folderColor(todo.folderId, folders);
    const label = folderLabel(todo.folderId, folders);
    if (label) {
      const tag = document.createElement("span");
      tag.className = `tag c-${color}`;
      tag.textContent = label;
      meta.append(tag);
    }
    if (todo.repeat) {
      const rep = document.createElement("span");
      rep.className = "meta-repeat";
      rep.textContent = "↻ 매일";
      meta.append(rep);
    }
    const due = dueLabel(todo);
    if (due) {
      const d = document.createElement("span");
      d.className = "meta-due";
      d.textContent = due;
      meta.append(d);
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
