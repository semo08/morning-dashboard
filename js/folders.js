// 폴더 트리 렌더링, 선택, 추가/수정/삭제

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

// 하위 폴더는 상위 폴더의 색을 따른다
export function folderColor(folderId, folders) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return null;
  if (folder.parentId === null) return folder.color;
  const parent = folders.find(f => f.id === folder.parentId);
  return parent ? parent.color : null;
}

// "사이드 › Gedanken Lab" 형식
export function folderLabel(folderId, folders) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return "";
  if (folder.parentId === null) return folder.name;
  const parent = folders.find(f => f.id === folder.parentId);
  return parent ? `${parent.name} › ${folder.name}` : folder.name;
}

// 선택한 폴더에 속하는 투두인지 확인
export function inFolder(todo, selectedId, folders) {
  if (selectedId === "all") return true;
  if (todo.folderId === selectedId) return true;
  // 상위 폴더를 선택했으면 하위 폴더 투두도 포함
  const folder = folders.find(f => f.id === todo.folderId);
  return Boolean(folder && folder.parentId === selectedId);
}

// ── 추가/수정/삭제: 새 배열을 돌려준다 ──

// 상위 폴더면 아직 안 쓴 색을 먼저 고른다. 하위 폴더는 2단계까지만
export function addFolder(folders, { name, parentId = null }) {
  const folder = { id: "f_" + Date.now(), name, parentId };
  if (parentId === null) {
    const used = topFolders(folders).map(f => f.color);
    folder.color = (COLORS.find(c => !used.includes(c.id)) ?? COLORS[0]).id;
  } else {
    const parent = folders.find(f => f.id === parentId);
    if (!parent || parent.parentId !== null) return { folders, folder: null };
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

// 하위 폴더: 할 일은 상위 폴더로 옮긴다
// 상위 폴더: 하위 폴더와 그 안의 할 일까지 모두 지운다
export function deleteFolder(folders, todos, id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return { folders, todos };

  if (folder.parentId !== null) {
    return {
      folders: folders.filter(f => f.id !== id),
      todos: todos.map(t => (t.folderId === id ? { ...t, folderId: folder.parentId } : t)),
    };
  }

  const ids = [id, ...childFolders(folders, id).map(f => f.id)];
  return {
    folders: folders.filter(f => !ids.includes(f.id)),
    todos: todos.filter(t => !ids.includes(t.folderId)),
  };
}

// ── 그리기 ──

export function renderFolderTree(nav, { folders, selectedId, expanded, editing, countFor, focusId, on }) {
  nav.replaceChildren();

  const head = document.createElement("div");
  head.className = "tree-head";
  const title = document.createElement("h2");
  title.className = "tree-title";
  title.textContent = "폴더";
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
    for (const top of topFolders(folders)) list.append(editTopItem(top));
    const addTop = addButton("+ 상위 폴더", () => on.add(null));
    addTop.classList.add("tree-add-top");
    nav.append(list, addTop);
  } else {
    list.append(folderItem({ id: "all", name: "전체" }, { isTop: true }));
    for (const top of topFolders(folders)) {
      const children = childFolders(folders, top.id);
      const isOpen = expanded.includes(top.id);
      const li = folderItem(top, { isTop: true, hasChildren: children.length > 0, isOpen });
      if (children.length > 0 && isOpen) {
        const sub = document.createElement("ul");
        sub.className = "tree-sub";
        for (const child of children) sub.append(folderItem(child, {}));
        li.append(sub);
      }
      list.append(li);
    }
    nav.append(list);
  }

  if (focusId) {
    const input = nav.querySelector(`input[data-id="${focusId}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }

  function folderItem(folder, { isTop = false, hasChildren = false, isOpen = false }) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row" + (folder.id === selectedId ? " selected" : "") + (isTop ? " top" : "");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-toggle" + (isOpen ? " open" : "");
    toggle.innerHTML = `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5L7.5 6 4 9.5"/></svg>`;
    toggle.setAttribute("aria-label", (isOpen ? "접기: " : "펼치기: ") + folder.name);
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (hasChildren) {
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
    const color = folder.id === "all" ? null : folderColor(folder.id, folders);
    if (isTop && color) label.append(dot(color));
    label.append(folder.name);

    const count = document.createElement("span");
    count.className = "tree-count num";
    const n = countFor(folder.id);
    count.textContent = n > 0 ? n : "";

    name.append(label, count);
    name.addEventListener("click", () => on.select(folder.id));

    // 하위 폴더는 들여쓴 목록 안에 있어서 펼치기 버튼 자리가 필요 없다
    if (isTop) row.append(toggle);
    row.append(name);
    li.append(row);
    return li;
  }

  function editTopItem(top) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row top editing";

    const colorBtn = document.createElement("button");
    colorBtn.type = "button";
    colorBtn.className = "tree-color";
    const colorName = COLORS.find(c => c.id === top.color)?.name ?? "";
    colorBtn.setAttribute("aria-label", `색 바꾸기: ${top.name} (지금 ${colorName})`);
    colorBtn.title = "눌러서 색 바꾸기";
    colorBtn.append(dot(top.color));
    colorBtn.addEventListener("click", () => on.recolor(top.id));

    row.append(colorBtn, nameInput(top), deleteButton(top));
    li.append(row);

    const sub = document.createElement("ul");
    sub.className = "tree-sub";
    for (const child of childFolders(folders, top.id)) {
      const subLi = document.createElement("li");
      const subRow = document.createElement("div");
      subRow.className = "tree-row editing";
      subRow.append(nameInput(child), deleteButton(child));
      subLi.append(subRow);
      sub.append(subLi);
    }
    const addSubLi = document.createElement("li");
    addSubLi.append(addButton("+ 하위 폴더", () => on.add(top.id)));
    sub.append(addSubLi);
    li.append(sub);
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

  function deleteButton(folder) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "tree-delete";
    del.textContent = "×";
    del.setAttribute("aria-label", `폴더 삭제: ${folder.name}`);
    del.addEventListener("click", () => on.remove(folder.id));
    return del;
  }
}

function dot(color) {
  const span = document.createElement("span");
  span.className = `dot c-${color}`;
  return span;
}

function addButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-add";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}
