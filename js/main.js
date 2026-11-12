// 시작점, 이벤트 연결
import { load, save } from "./storage.js";
import { DEFAULT_FOLDERS, inFolder, folderLabel, renderFolderTree, topFolders } from "./folders.js";
import { createTodo, fillFolderSelect, isVisible, renderTodos, resetRepeats, todayStr } from "./todos.js";

const folders = load("folders", null) ?? DEFAULT_FOLDERS;
save("folders", folders);   // 처음 실행이면 기본 폴더를 넣어둔다

let todos = load("todos", []);
let expanded = load("expandedFolders", topFolders(folders).map(f => f.id));
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

function saveTodos() {
  save("todos", todos);
}

function openCount(folderId) {
  return todos.filter(t => !t.done && isVisible(t) && inFolder(t, folderId, folders)).length;
}

function render() {
  renderFolderTree(nav, {
    folders,
    selectedId: selectedFolder,
    expanded,
    countFor: openCount,
    onSelect: id => {
      selectedFolder = id;
      render();
    },
    onToggle: id => {
      expanded = expanded.includes(id) ? expanded.filter(x => x !== id) : [...expanded, id];
      save("expandedFolders", expanded);
      render();
    },
  });

  $("panel-title").textContent = selectedFolder === "all" ? "전체" : folderLabel(selectedFolder, folders);
  $("panel-count").textContent = openCount(selectedFolder);
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
  if (document.visibilityState !== "visible") return;
  if (resetRepeats(todos)) saveTodos();
  render();
});

if (resetRepeats(todos)) saveTodos();
render();
