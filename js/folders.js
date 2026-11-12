// 폴더 트리 렌더링, 선택, 추가/수정/삭제
// 폴더는 parentId로 이어지고, 맨 위 폴더 포함 MAX_DEPTH 단계까지 만들 수 있다

export const MAX_DEPTH = 4;

export const DEFAULT_FOLDERS = [
  { id: "work", name: "업무", parentId: null, color: "work" },
  { id: "dev", name: "개발", parentId: "work" },
  { id: "side", name: "사이드", parentId: null, color: "side" },
  { id: "gedanken", name: "Gedanken Lab", parentId: "side" },
  { id: "study", name: "공부", parentId: null, color: "study" },
  { id: "en", name: "영어", parentId: "study" },
];

// 상위 폴더 색. id는 css의 .c-{id} 클래스와 같다 (work/side/study는 처음 폴더 3개의 색)
export const COLORS = [
  { id: "work", name: "파랑" },
  { id: "side", name: "초록" },
  { id: "study", name: "갈색" },
  { id: "purple", name: "보라" },
  { id: "rose", name: "분홍" },
  { id: "teal", name: "청록" },
  { id: "gray", name: "회색" },
];

export function topFolders(folders) {
  return folders.filter(f => f.parentId === null);
}

export function childFolders(folders, parentId) {
  return folders.filter(f => f.parentId === parentId);
}

// 맨 위 폴더부터 그 폴더까지 [업무, 개발, ...]
export function folderPath(folders, folderId) {
  const path = [];
  let folder = folders.find(f => f.id === folderId);
  while (folder && path.length < folders.length) {   // 데이터가 꼬여 순환해도 멈추게
    path.unshift(folder);
    folder = folders.find(f => f.id === folder.parentId);
  }
  return path;
}

// 그 폴더와 모든 하위 폴더의 id
export function descendantIds(folders, folderId) {
  return folders
    .filter(f => folderPath(folders, f.id).some(p => p.id === folderId))
    .map(f => f.id);
}

// 하위 폴더는 맨 위 폴더의 색을 따른다
export function folderColor(folderId, folders) {
  return folderPath(folders, folderId)[0]?.color ?? null;
}

// "사이드 › Gedanken Lab › 장면 1" 형식
export function folderLabel(folderId, folders) {
  return folderPath(folders, folderId).map(f => f.name).join(" › ");
}

// 선택한 폴더에 속하는 투두인지 확인 (하위 폴더 투두도 포함)
export function inFolder(todo, selectedId, folders) {
  if (selectedId === "all") return true;
  return folderPath(folders, todo.folderId).some(f => f.id === selectedId);
}

// ── 추가/수정/삭제: 새 배열을 돌려준다 ──

export function canAddChild(folders, folderId) {
  return folderPath(folders, folderId).length < MAX_DEPTH;
}

// 상위 폴더면 아직 안 쓴 색을 먼저 고른다
export function addFolder(folders, { name, parentId = null }) {
  const folder = { id: "f_" + Date.now(), name, parentId };
  if (parentId === null) {
    const used = topFolders(folders).map(f => f.color);
    folder.color = (COLORS.find(c => !used.includes(c.id)) ?? COLORS[0]).id;
  } else if (!folders.some(f => f.id === parentId) || !canAddChild(folders, parentId)) {
    return { folders, folder: null };
  }
  return { folders: [...folders, folder], folder };
}

export function updateFolder(folders, id, changes) {
  return folders.map(f => (f.id === id ? { ...f, ...changes } : f));
}

export function nextColor(colorId) {
  const index = COLORS.findIndex(c => c.id === colorId);
  return COLORS[(index + 1) % COLORS.length].id;
}

// 하위 폴더: 안에 있던 할 일과 폴더는 한 단계 위로 옮긴다
// 맨 위 폴더: 모든 하위 폴더와 그 안의 할 일까지 지운다
export function deleteFolder(folders, todos, id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return { folders, todos };

  if (folder.parentId !== null) {
    return {
      folders: folders
        .filter(f => f.id !== id)
        .map(f => (f.parentId === id ? { ...f, parentId: folder.parentId } : f)),
      todos: todos.map(t => (t.folderId === id ? { ...t, folderId: folder.parentId } : t)),
    };
  }

  const ids = descendantIds(folders, id);
  return {
    folders: folders.filter(f => !ids.includes(f.id)),
    todos: todos.filter(t => !ids.includes(t.folderId)),
  };
}

// ── 투두 입력칸의 폴더 드롭다운 ──

// 경로 [맨 위 id, 하위 id, ...]에서 없어진 폴더 이후를 잘라낸다. 비면 첫 상위 폴더
export function validPath(folders, path) {
  const result = [];
  let parentId = null;
  for (const id of path) {
    if (!folders.some(f => f.id === id && f.parentId === parentId)) break;
    result.push(id);
    parentId = id;
  }
  if (result.length === 0 && topFolders(folders).length) result.push(topFolders(folders)[0].id);
  return result;
}

// 고른 폴더에 하위 폴더가 있으면 "업무 › 개발 › …"처럼 드롭다운을 하나 더 잇는다
export function renderFolderPicker(container, { folders, path, onChange }) {
  container.replaceChildren();
  let options = topFolders(folders);
  for (let level = 0; options.length > 0; level++) {
    const chosen = path[level] ?? "";

    if (level > 0) {
      const sep = document.createElement("span");
      sep.className = "picker-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "›";
      container.append(sep);
    }

    const select = document.createElement("select");
    select.setAttribute("aria-label", level === 0 ? "폴더" : `${level}단계 하위 폴더`);
    if (level > 0) select.append(new Option("없음", ""));
    for (const f of options) select.append(new Option(f.name, f.id));
    select.value = chosen;
    select.addEventListener("change", () => {
      onChange([...path.slice(0, level), ...(select.value ? [select.value] : [])], level);
    });

    container.append(select);

    if (!chosen) break;
    options = childFolders(folders, chosen);
  }
}

// ── 트리 그리기 ──

export function renderFolderTree(nav, { folders, selectedId, expanded, editing, countFor, focusId, on }) {
  nav.replaceChildren();

  const head = document.createElement("div");
  head.className = "tree-head";
  const title = document.createElement("h2");
  title.className = "tree-title";
  title.textContent = "할 일";
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "tree-edit-toggle" + (editing ? " on" : "");
  editBtn.textContent = editing ? "완료" : "편집";
  editBtn.setAttribute("aria-pressed", String(editing));
  editBtn.addEventListener("click", on.toggleEdit);
  head.append(title, editBtn);
  nav.append(head);

  const list = document.createElement("ul");
  list.className = "tree";

  if (editing) {
    for (const top of topFolders(folders)) list.append(editItem(top, 0));
    const addTop = document.createElement("button");
    addTop.type = "button";
    addTop.className = "tree-add-top";
    addTop.textContent = "+ 상위 폴더";
    addTop.addEventListener("click", () => on.add(null));
    nav.append(list, addTop);
  } else {
    for (const top of topFolders(folders)) list.append(folderItem(top, 0));
    nav.append(list);
  }

  if (focusId) {
    const input = nav.querySelector(`input[data-id="${focusId}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }

  function folderItem(folder, depth) {
    const children = childFolders(folders, folder.id);
    const isOpen = expanded.includes(folder.id);

    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row" + (folder.id === selectedId ? " selected" : "") + (depth === 0 ? " top" : "");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-toggle" + (isOpen ? " open" : "");
    toggle.innerHTML = `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5L7.5 6 4 9.5"/></svg>`;
    toggle.setAttribute("aria-label", (isOpen ? "접기: " : "펼치기: ") + folder.name);
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (children.length > 0) {
      toggle.addEventListener("click", () => on.toggleOpen(folder.id));
    } else {
      toggle.classList.add("hidden");
      toggle.tabIndex = -1;
    }

    const name = document.createElement("button");
    name.type = "button";
    name.className = "tree-name";
    const label = document.createElement("span");
    label.className = "tree-label";
    if (depth === 0 && folder.color) label.append(dot(folder.color));
    label.append(folder.name);

    const count = document.createElement("span");
    count.className = "tree-count num";
    const n = countFor(folder.id);
    count.textContent = n > 0 ? n : "";

    name.append(label, count);
    name.addEventListener("click", () => on.select(folder.id));

    row.append(toggle, name);
    li.append(row);

    if (children.length > 0 && isOpen) {
      const sub = document.createElement("ul");
      sub.className = "tree-sub";
      for (const child of children) sub.append(folderItem(child, depth + 1));
      li.append(sub);
    }
    return li;
  }

  // 편집 모드에서는 모든 폴더를 펼쳐서 보여준다
  function editItem(folder, depth) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row editing" + (depth === 0 ? " top" : "");

    if (depth === 0) {
      const colorBtn = document.createElement("button");
      colorBtn.type = "button";
      colorBtn.className = "tree-color";
      const colorName = COLORS.find(c => c.id === folder.color)?.name ?? "";
      colorBtn.setAttribute("aria-label", `색 바꾸기: ${folder.name} (지금 ${colorName})`);
      colorBtn.title = "눌러서 색 바꾸기";
      colorBtn.append(dot(folder.color));
      colorBtn.addEventListener("click", () => on.recolor(folder.id));
      row.append(colorBtn);
    }

    row.append(nameInput(folder));
    // 마지막 단계에서는 하위 폴더를 더 만들 수 없다 (자리는 남겨서 줄을 맞춘다)
    const addChild = iconButton("+", `하위 폴더 추가: ${folder.name}`, "tree-add-child", () => on.add(folder.id));
    if (depth + 1 >= MAX_DEPTH) {
      addChild.classList.add("hidden");
      addChild.tabIndex = -1;
      addChild.setAttribute("aria-hidden", "true");
    }
    const del = iconButton("×", `폴더 삭제: ${folder.name}`, "tree-delete", () => on.remove(folder.id));
    row.append(addChild, del);
    li.append(row);

    const children = childFolders(folders, folder.id);
    if (children.length > 0) {
      const sub = document.createElement("ul");
      sub.className = "tree-sub";
      for (const child of children) sub.append(editItem(child, depth + 1));
      li.append(sub);
    }
    return li;
  }

  function nameInput(folder) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-input";
    input.defaultValue = folder.name;   // 마지막으로 저장된 이름
    input.maxLength = 30;
    input.dataset.id = folder.id;
    input.setAttribute("aria-label", "폴더 이름");
    // 빈 이름이면 원래 이름으로 되돌린다
    input.addEventListener("change", () => {
      const name = input.value.trim();
      if (!name) {
        input.value = input.defaultValue;
        return;
      }
      input.defaultValue = name;
      on.rename(folder.id, name);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = input.defaultValue;
        input.blur();
      }
    });
    return input;
  }
}

function dot(color) {
  const span = document.createElement("span");
  span.className = `dot c-${color}`;
  return span;
}

function iconButton(text, label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}
