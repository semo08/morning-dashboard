// 시작점, 이벤트 연결
import { load, save } from "./storage.js";
import {
  DEFAULT_FOLDERS, addFolder, childFolders, deleteFolder, descendantIds, folderColor, folderLabel,
  folderPath, inFolder, nextColor, renderFolderPicker, renderFolderTree, topFolders, updateFolder, validPath,
} from "./folders.js";
import {
  WEEKDAY_NAMES, WEEK_ORDER, createTodo, isVisible, migrateRepeats, renderTodos, resetRepeats, todayItems, todayStr,
} from "./todos.js";
import { renderHeader, startClock } from "./header.js";
import { renderCalendar } from "./calendar.js";
import { createCard, isSentToday, renderBoard } from "./board.js";
import { renderMemo } from "./memo.js";
import { THEMES, applyTheme, renderThemePicker } from "./theme.js";

let folders = load("folders", null) ?? DEFAULT_FOLDERS;
save("folders", folders);   // 처음 실행이면 기본 폴더를 넣어둔다

let todos = load("todos", []);
if (migrateRepeats(todos)) save("todos", todos);
let board = load("board", []);
let memo = load("memo", null);       // { text, writtenAt }
let expanded = load("expandedFolders", topFolders(folders).map(f => f.id));
const settings = { theme: "sunny", name: "", ...load("settings", {}) };
let selectedFolder = "all";
let editingFolders = false;
let pickPath = [];          // 입력칸에서 고른 폴더 경로 [맨 위 id, 하위 id, ...]
const calView = { year: new Date().getFullYear(), month: new Date().getMonth() };
const deletedStack = [];    // Ctrl+Z 되돌리기용 { todo, index }
let editingCardId = null;   // 작업 카드 창: 수정 중인 카드 (새 카드면 null)
let cardPickPath = [];

const $ = id => document.getElementById(id);
const nav = $("folder-tree");
const groups = $("todo-groups");
const form = $("todo-form");
const textInput = $("todo-text");
const picker = $("folder-picker");
const dueInput = $("todo-due");
const repeatInput = $("todo-repeat");
const repeatDays = $("repeat-days");
const toast = $("toast");
const settingsPanel = $("settings");
const settingsToggle = $("settings-toggle");
const nameInput = $("name-input");
const cardDialog = $("card-dialog");
const cardForm = $("card-form");
const memoDialog = $("memo-dialog");
const memoForm = $("memo-form");

function saveTodos() {
  save("todos", todos);
}

function saveFolders() {
  save("folders", folders);
}

function saveBoard() {
  save("board", board);
}

function saveSettings() {
  save("settings", settings);
}

function openCount(folderId) {
  return todos.filter(t => !t.done && isVisible(t) && inFolder(t, folderId, folders)).length;
}

function todayLeft() {
  return todayItems(todos).filter(t => !t.done).length;
}

function updateHeader() {
  renderHeader({ todayLeft: todayLeft() });
}

function renderPanelHead() {
  const folder = folders.find(f => f.id === selectedFolder);
  let crumb = "모든 폴더";
  let title = "전체 할 일";
  if (folder) {
    crumb = folderLabel(folder.id, folders);
    title = childFolders(folders, folder.id).length ? `${folder.name} 전체` : folder.name;
  }
  $("panel-crumb").textContent = crumb;
  $("panel-title").textContent = title;
}

function renderProgress() {
  const items = todayItems(todos);
  const done = items.filter(t => t.done).length;
  $("progress-num").textContent = `${done}/${items.length}`;
  $("progress-bar").style.width = items.length ? `${Math.round((done / items.length) * 100)}%` : "0%";

  const list = $("progress-stats");
  list.replaceChildren();
  for (const top of topFolders(folders)) {
    const mine = items.filter(t => inFolder(t, top.id, folders));
    if (mine.length === 0) continue;
    const li = document.createElement("li");
    const tag = document.createElement("span");
    tag.className = `tag c-${folderColor(top.id, folders)}`;
    tag.textContent = top.name;
    const stat = document.createElement("span");
    stat.className = "progress-stat";
    stat.textContent = `${mine.filter(t => t.done).length} / ${mine.length} 완료`;
    li.append(tag, stat);
    list.append(li);
  }
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "progress-empty";
    li.textContent = "오늘 할 일이 없어";
    list.append(li);
  }
}

function removeFolder(id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  const isTop = folder.parentId === null;

  if (isTop && topFolders(folders).length === 1) {
    showToast("상위 폴더는 하나 이상 있어야 해요");
    return;
  }

  const ids = isTop ? descendantIds(folders, id) : [id];
  const todoCount = todos.filter(t => ids.includes(t.folderId)).length;
  const childCount = childFolders(folders, id).length;
  if (isTop) {
    const subCount = ids.length - 1;
    const parts = [subCount && `하위 폴더 ${subCount}개`, todoCount && `할 일 ${todoCount}개`].filter(Boolean);
    const extra = parts.length ? `\n${parts.join(", ")}도 함께 삭제돼요.` : "";
    if (!confirm(`'${folder.name}' 폴더를 삭제할까요?${extra}`)) return;
  }

  ({ folders, todos } = deleteFolder(folders, todos, id));
  // 작업 카드는 지우지 않는다: 하위 폴더면 한 단계 위로, 맨 위 폴더면 폴더 없음으로
  board = board.map(card => {
    if (!ids.includes(card.folderId)) return card;
    return { ...card, folderId: isTop ? null : folder.parentId };
  });
  saveBoard();
  // 되돌리기 대기 중인 투두도 같은 규칙으로: 상위 폴더로 옮기거나 함께 버린다
  for (let i = deletedStack.length - 1; i >= 0; i--) {
    const todo = deletedStack[i].todo;
    if (!ids.includes(todo.folderId)) continue;
    if (isTop) deletedStack.splice(i, 1);
    else todo.folderId = folder.parentId;
  }
  expanded = expanded.filter(x => folders.some(f => f.id === x));
  if (!folders.some(f => f.id === selectedFolder)) selectedFolder = "all";
  saveFolders();
  saveTodos();
  save("expandedFolders", expanded);
  render();
  if (!isTop && (todoCount || childCount)) {
    const parts = [childCount && `하위 폴더 ${childCount}개`, todoCount && `할 일 ${todoCount}개`].filter(Boolean);
    showToast(`${parts.join(", ")}는 '${folderLabel(folder.parentId, folders)}'로 옮겼어요`);
  }
}

function renderTree(focusId) {
  renderFolderTree(nav, {
    folders,
    selectedId: selectedFolder,
    expanded,
    editing: editingFolders,
    countFor: openCount,
    focusId,
    on: {
      // 선택된 폴더를 다시 누르면 선택을 풀고 전체를 보여준다
      select: id => {
        selectedFolder = selectedFolder === id ? "all" : id;
        // 하위 폴더가 있는 폴더를 고르면 펼쳐서 보여준다
        if (selectedFolder === id && childFolders(folders, id).length && !expanded.includes(id)) {
          expanded = [...expanded, id];
          save("expandedFolders", expanded);
        }
        render();
      },
      toggleOpen: id => {
        expanded = expanded.includes(id) ? expanded.filter(x => x !== id) : [...expanded, id];
        save("expandedFolders", expanded);
        render();
      },
      toggleEdit: () => {
        editingFolders = !editingFolders;
        render();
      },
      add: parentId => {
        const result = addFolder(folders, { name: "새 폴더", parentId });
        if (!result.folder) return;
        folders = result.folders;
        if (parentId && !expanded.includes(parentId)) {
          expanded = [...expanded, parentId];
          save("expandedFolders", expanded);
        }
        saveFolders();
        renderMain();
        renderTree(result.folder.id);   // 새 폴더 이름칸에 바로 입력할 수 있게
      },
      // 이름 바꾸기는 트리를 다시 그리지 않는다 (입력칸을 벗어나며 누른 버튼이 사라지지 않게)
      rename: (id, name) => {
        folders = updateFolder(folders, id, { name });
        saveFolders();
        renderMain();
      },
      recolor: id => {
        const folder = folders.find(f => f.id === id);
        folders = updateFolder(folders, id, { color: nextColor(folder.color) });
        saveFolders();
        render();
      },
      remove: removeFolder,
    },
  });
}

function render() {
  renderTree();
  renderMain();
}

// 폴더 트리를 뺀 나머지
function renderMain() {
  renderPanelHead();
  // 왼쪽에서 폴더를 골라 두었으면 입력칸 폴더도 그 폴더로
  if (selectedFolder !== "all") pickPath = folderPath(folders, selectedFolder).map(f => f.id);
  pickPath = validPath(folders, pickPath);
  renderPicker();

  renderTodos(groups, {
    todos,
    folders,
    selectedId: selectedFolder,
    onToggleDone: id => {
      const todo = todos.find(t => t.id === id);
      todo.done = !todo.done;
      todo.doneAt = todo.done ? todayStr() : null;
      saveTodos();
      render();
    },
    onDelete: id => {
      const index = todos.findIndex(t => t.id === id);
      deletedStack.push({ todo: todos[index], index });
      todos.splice(index, 1);
      saveTodos();
      render();
      showToast("삭제했어요 · Ctrl+Z로 되돌리기");
    },
  });

  renderBoardSection();
  renderCal();
  renderProgress();
  updateHeader();
}

function renderBoardSection() {
  renderMemo($("memo"), { memo, onCheckout: openMemoDialog });
  $("board-count").textContent = board.length ? `${board.length}개` : "";
  renderBoard($("board-grid"), {
    board,
    folders,
    on: {
      edit: openCardDialog,
      send: sendNextToTodo,
    },
  });
}

// 카드의 "다음 할 일"을 오늘 마감 투두로 보낸다
function sendNextToTodo(id) {
  const card = board.find(c => c.id === id);
  if (!card?.next || isSentToday(card)) return;
  const folderId = folders.some(f => f.id === card.folderId) ? card.folderId : topFolders(folders)[0].id;
  todos.push(createTodo({ text: card.next, folderId, due: todayStr(), repeat: false }));
  card.sent = { date: todayStr(), text: card.next };
  saveTodos();
  saveBoard();
  render();
  showToast("오늘 할 일에 추가했어요");
}

// ── 작업 카드 창 ──

function renderCardPicker(focusLevel) {
  const container = $("card-folder-picker");
  renderFolderPicker(container, {
    folders,
    path: cardPickPath,
    onChange: (path, level) => {
      cardPickPath = path;
      renderCardPicker(level);
    },
  });
  if (focusLevel !== undefined) container.querySelectorAll("select")[focusLevel]?.focus();
}

function openCardDialog(id = null) {
  const card = board.find(c => c.id === id);
  editingCardId = card ? card.id : null;
  $("card-dialog-title").textContent = card ? "작업 수정" : "작업 추가";
  $("card-delete").hidden = !card;

  const f = cardForm.elements;
  f.title.value = card?.title ?? "";
  f.progress.value = card?.progress ?? 0;
  f.last.value = card?.last ?? "";
  f.next.value = card?.next ?? "";
  f.blocked.value = card?.blocked ?? "";
  $("card-progress-out").textContent = `${f.progress.value}%`;

  // 새 카드는 지금 보고 있는 폴더(없으면 입력칸 폴더)에서 시작
  const startId = card ? card.folderId : selectedFolder !== "all" ? selectedFolder : pickPath.at(-1);
  cardPickPath = validPath(folders, folderPath(folders, startId).map(x => x.id));
  renderCardPicker();

  cardDialog.showModal();
  f.title.focus();
}

cardForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = cardForm.elements;
  const values = {
    title: f.title.value.trim(),
    folderId: cardPickPath.at(-1) ?? null,
    progress: Number(f.progress.value),
    last: f.last.value.trim(),
    next: f.next.value.trim(),
    blocked: f.blocked.value.trim(),
  };
  if (!values.title) return;

  const card = board.find(c => c.id === editingCardId);
  if (card) Object.assign(card, values, { updatedAt: Date.now() });
  else board.push(createCard(values));
  saveBoard();
  cardDialog.close();
  render();
});

cardForm.elements.progress.addEventListener("input", () => {
  $("card-progress-out").textContent = `${cardForm.elements.progress.value}%`;
});

$("card-delete").addEventListener("click", () => {
  const card = board.find(c => c.id === editingCardId);
  if (!card || !confirm(`'${card.title}' 작업을 삭제할까요?`)) return;
  board = board.filter(c => c.id !== card.id);
  saveBoard();
  cardDialog.close();
  render();
});

$("board-add").addEventListener("click", () => openCardDialog());

// ── 퇴근 체크아웃 ──

function openMemoDialog() {
  // 오늘 이미 남긴 메모가 있으면 고칠 수 있게 채워둔다
  const writtenToday = memo && todayStr(new Date(memo.writtenAt)) === todayStr();
  memoForm.elements.memo.value = writtenToday ? memo.text : "";
  memoDialog.showModal();
  memoForm.elements.memo.focus();
}

memoForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = memoForm.elements.memo.value.trim();
  memo = text ? { text, writtenAt: Date.now() } : null;
  save("memo", memo);
  memoDialog.close();
  renderBoardSection();
  showToast(text ? "메모를 남겼어요. 내일 아침에 봐요" : "메모를 지웠어요");
});

// 창의 취소 버튼
for (const button of document.querySelectorAll("dialog [data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}

function renderCal() {
  renderCalendar($("calendar"), {
    ...calView,
    todos,
    selectedDate: dueInput.value,
    on: {
      move: delta => {
        const d = new Date(calView.year, calView.month + delta, 1);
        calView.year = d.getFullYear();
        calView.month = d.getMonth();
        renderCal();
      },
      today: () => {
        calView.year = new Date().getFullYear();
        calView.month = new Date().getMonth();
        renderCal();
      },
      // 날짜를 누르면 입력칸의 마감일로. 같은 날을 다시 누르면 비운다
      pick: date => {
        setRepeat(false);
        dueInput.value = dueInput.value === date ? "" : date;
        renderCal();
        textInput.focus();
      },
    },
  });
}

function renderPicker(focusLevel) {
  renderFolderPicker(picker, {
    folders,
    path: pickPath,
    onChange: (path, level) => {
      pickPath = path;
      renderPicker(level);
    },
  });
  // 드롭다운을 다시 그려도 방금 고른 칸에 포커스를 남긴다
  if (focusLevel !== undefined) picker.querySelectorAll("select")[focusLevel]?.focus();
}

function renderSettings() {
  renderThemePicker($("theme-list"), settings.theme, id => {
    settings.theme = id;
    applyTheme(id);
    saveSettings();
    renderSettings();
  });
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3000);
}

function undoDelete() {
  const last = deletedStack.pop();
  if (!last) return;
  todos.splice(Math.min(last.index, todos.length), 0, last.todo);
  saveTodos();
  render();
  showToast("되돌렸어요");
}

// 날짜가 바뀌면 반복 투두를 풀고 그룹을 다시 나눈다
function refreshDay() {
  if (resetRepeats(todos)) saveTodos();
  render();
}

// 반복 요일 칩: 월~일, 처음엔 월~금이 체크되어 있다
function renderRepeatDays() {
  for (const day of WEEK_ORDER) {
    const chip = document.createElement("label");
    chip.className = "day-chip" + (day === 0 || day === 6 ? " weekend" : "");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = day;
    box.checked = day >= 1 && day <= 5;
    const name = document.createElement("span");
    name.textContent = WEEKDAY_NAMES[day];
    chip.append(box, name);
    repeatDays.append(chip);
  }
}

function checkedRepeatDays() {
  return [...repeatDays.querySelectorAll("input:checked")].map(box => Number(box.value));
}

// 반복을 켜면 요일 칩이 나오고, 마감일은 쓰지 않는다
function setRepeat(on) {
  repeatInput.checked = on;
  repeatDays.hidden = !on;
  dueInput.disabled = on;
  if (on) dueInput.value = "";
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  let repeat = false;
  if (repeatInput.checked) {
    repeat = checkedRepeatDays();
    if (repeat.length === 0) {
      showToast("반복할 요일을 하나 이상 골라주세요");
      return;
    }
  }
  todos.push(createTodo({
    text,
    folderId: pickPath.at(-1),
    due: dueInput.value,
    repeat,
  }));
  saveTodos();
  textInput.value = "";
  render();
  textInput.focus();
});

repeatInput.addEventListener("change", () => {
  setRepeat(repeatInput.checked);
  renderCal();
});

// 마감일을 직접 고쳐도 달력 표시가 따라가게
dueInput.addEventListener("change", renderCal);

settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});

nameInput.addEventListener("input", () => {
  settings.name = nameInput.value.trim();
  saveSettings();
});
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") nameInput.blur();
});

document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
  // 입력칸에서는 브라우저 기본 되돌리기를 쓴다
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" && document.activeElement.type === "text") return;
  if (tag === "TEXTAREA") return;
  if (document.querySelector("dialog[open]")) return;
  if (deletedStack.length === 0) return;
  e.preventDefault();
  undoDelete();
});

// 새 탭을 켜둔 채 날짜가 바뀌어도 다시 볼 때 반영되도록
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshDay();
});

if (!THEMES.some(t => t.id === settings.theme)) settings.theme = "sunny";
applyTheme(settings.theme);
nameInput.value = settings.name;
renderSettings();
renderRepeatDays();
refreshDay();
startClock(updateHeader, refreshDay);
