// 폴더 트리 렌더링, 선택

export const DEFAULT_FOLDERS = [
  { id: "work", name: "업무", parentId: null, color: "work" },
  { id: "dev", name: "개발", parentId: "work" },
  { id: "side", name: "사이드", parentId: null, color: "side" },
  { id: "gedanken", name: "Gedanken Lab", parentId: "side" },
  { id: "study", name: "공부", parentId: null, color: "study" },
  { id: "en", name: "영어", parentId: "study" },
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

export function renderFolderTree(nav, { folders, selectedId, expanded, countFor, onSelect, onToggle }) {
  nav.replaceChildren();

  const title = document.createElement("p");
  title.className = "tree-title";
  title.textContent = "폴더";
  nav.append(title);

  const list = document.createElement("ul");
  list.className = "tree";
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

  function folderItem(folder, { isTop = false, hasChildren = false, isOpen = false }) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "tree-row" + (folder.id === selectedId ? " selected" : "") + (isTop ? "" : " child");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-toggle" + (isOpen ? " open" : "");
    toggle.textContent = "▸";
    toggle.setAttribute("aria-label", isOpen ? "접기" : "펼치기");
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (hasChildren) {
      toggle.addEventListener("click", () => onToggle(folder.id));
    } else {
      toggle.classList.add("hidden");
      toggle.tabIndex = -1;
    }

    const name = document.createElement("button");
    name.type = "button";
    name.className = "tree-name";
    const color = folder.id === "all" ? null : folderColor(folder.id, folders);
    if (isTop && color) {
      const dot = document.createElement("span");
      dot.className = `dot c-${color}`;
      name.append(dot);
    }
    name.append(folder.name);
    name.addEventListener("click", () => onSelect(folder.id));

    const count = document.createElement("span");
    count.className = "tree-count num";
    const n = countFor(folder.id);
    count.textContent = n > 0 ? n : "";

    row.append(toggle, name, count);
    li.append(row);
    return li;
  }
}
