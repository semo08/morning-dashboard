// 시작점, 이벤트 연결
import { load, save } from "./storage.js";
import { DEFAULT_FOLDERS, inFolder, folderColor, folderLabel, renderFolderTree, topFolders } from "./folders.js";
import { createTodo, fillFolderSelect, isVisible, renderTodos, resetRepeats, todayItems, todayStr } from "./todos.js";
import { renderHeader, startClock } from "./header.js";
import { THEMES, applyTheme, renderThemePicker } from "./theme.js";

const folders = load("folders", null) ?? DEFAULT_FOLDERS;
save("folders", folders);   // 처음 실행이면 기본 폴더를 넣어둔다

let todos = load("todos", []);
let expanded = load("expandedFolders", topFolders(folders).map(f => f.id));
const settings = { theme: "sunny", name: "Sehwa", ...load("settings", {}) };
let selectedFolder = "all";
const deletedStack = [];    // Ctrl+Z 되돌리기용 { todo, index }

const $ = id => document.getElementById(id);
const nav = $("folder-tree");
const groups = $("todo-groups");
const form = $("todo-form");
const textInput = $("todo-text");
const folderSelect = $("todo-folder");
const dueInput = $("todo-due");
const repeatInput = $("todo-repeat");
const toast = $("toast");
const settingsPanel = $("settings");
const settingsToggle = $("settings-toggle");
const nameInput = $("name-input");

function saveTodos() {
  save("todos", todos);
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
  renderHeader({ name: settings.name, todayLeft: todayLeft() });
}

function renderPanelHead() {
  const folder = folders.find(f => f.id === selectedFolder);
  let crumb = "모든 폴더";
  let title = "전체 할 일";
  if (folder) {
    crumb = folderLabel(folder.id, folders);
    title = folder.parentId === null ? `${folder.name} 전체` : folder.name;
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

function render() {
  renderFolderTree(nav, {
    folders,
    selectedId: selectedFolder,
    expanded,
    countFor: openCount,
    onSelect: id => {
      selectedFolder = id;
      // 상위 폴더를 고르면 하위 폴더도 펼쳐서 보여준다
      const folder = folders.find(f => f.id === id);
      if (folder && folder.parentId === null && !expanded.includes(id)) {
        expanded = [...expanded, id];
        save("expandedFolders", expanded);
      }
      render();
    },
    onToggle: id => {
      expanded = expanded.includes(id) ? expanded.filter(x => x !== id) : [...expanded, id];
      save("expandedFolders", expanded);
      render();
    },
  });

  renderPanelHead();
  fillFolderSelect(folderSelect, folders, selectedFolder);

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

  renderProgress();
  updateHeader();
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

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  todos.push(createTodo({
    text,
    folderId: folderSelect.value,
    due: dueInput.value,
    repeat: repeatInput.checked,
  }));
  saveTodos();
  textInput.value = "";
  render();
  textInput.focus();
});

// 매일 반복이면 마감일은 의미가 없다
repeatInput.addEventListener("change", () => {
  dueInput.disabled = repeatInput.checked;
  if (repeatInput.checked) dueInput.value = "";
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});

nameInput.addEventListener("input", () => {
  settings.name = nameInput.value.trim();
  saveSettings();
  updateHeader();
});

document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
  // 입력칸에서는 브라우저 기본 되돌리기를 쓴다
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" && document.activeElement.type === "text") return;
  if (tag === "TEXTAREA") return;
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
refreshDay();
startClock(updateHeader, refreshDay);
