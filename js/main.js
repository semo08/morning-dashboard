// 시작점, 이벤트 연결
import { load, save } from "./storage.js";
import {
  DEFAULT_FOLDERS, addFolder, childFolders, deleteFolder, folderColor, folderLabel,
  inFolder, nextColor, renderFolderTree, topFolders, updateFolder,
} from "./folders.js";
import { createTodo, fillFolderSelects, fillSubSelect, isVisible, renderTodos, resetRepeats, todayItems, todayStr } from "./todos.js";
import { renderHeader, startClock } from "./header.js";
import { THEMES, applyTheme, renderThemePicker } from "./theme.js";

let folders = load("folders", null) ?? DEFAULT_FOLDERS;
save("folders", folders);   // 처음 실행이면 기본 폴더를 넣어둔다

let todos = load("todos", []);
let expanded = load("expandedFolders", topFolders(folders).map(f => f.id));
const settings = { theme: "sunny", name: "Sehwa", ...load("settings", {}) };
let selectedFolder = "all";
let editingFolders = false;
const deletedStack = [];    // Ctrl+Z 되돌리기용 { todo, index }

const $ = id => document.getElementById(id);
const nav = $("folder-tree");
const groups = $("todo-groups");
const form = $("todo-form");
const textInput = $("todo-text");
const topSelect = $("todo-folder-top");
const subSelect = $("todo-folder-sub");
const dueInput = $("todo-due");
const repeatInput = $("todo-repeat");
const toast = $("toast");
const settingsPanel = $("settings");
const settingsToggle = $("settings-toggle");
const nameInput = $("name-input");

function saveTodos() {
  save("todos", todos);
}

function saveFolders() {
  save("folders", folders);
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

function removeFolder(id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  const isTop = folder.parentId === null;

  if (isTop && topFolders(folders).length === 1) {
    showToast("상위 폴더는 하나 이상 있어야 해요");
    return;
  }

  const ids = isTop ? [id, ...childFolders(folders, id).map(f => f.id)] : [id];
  const todoCount = todos.filter(t => ids.includes(t.folderId)).length;
  if (isTop) {
    const subCount = ids.length - 1;
    const parts = [subCount && `하위 폴더 ${subCount}개`, todoCount && `할 일 ${todoCount}개`].filter(Boolean);
    const extra = parts.length ? `\n${parts.join(", ")}도 함께 삭제돼요.` : "";
    if (!confirm(`'${folder.name}' 폴더를 삭제할까요?${extra}`)) return;
  }

  ({ folders, todos } = deleteFolder(folders, todos, id));
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
  if (!isTop && todoCount) showToast(`할 일 ${todoCount}개는 '${folderLabel(folder.parentId, folders)}'로 옮겼어요`);
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
      select: id => {
        selectedFolder = id;
        // 상위 폴더를 고르면 하위 폴더도 펼쳐서 보여준다
        const folder = folders.find(f => f.id === id);
        if (folder && folder.parentId === null && !expanded.includes(id)) {
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
  fillFolderSelects(topSelect, subSelect, folders, selectedFolder);

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
    folderId: subSelect.value || topSelect.value,
    due: dueInput.value,
    repeat: repeatInput.checked,
  }));
  saveTodos();
  textInput.value = "";
  render();
  textInput.focus();
});

topSelect.addEventListener("change", () => {
  fillSubSelect(subSelect, folders, topSelect.value);
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
