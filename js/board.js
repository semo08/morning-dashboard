// 작업 보드: 진행 중인 작업 카드 (마지막 / 다음 / 막힘), "다음 할 일 → 오늘 투두로"
import { folderColor, folderLabel } from "./folders.js";
import { todayStr } from "./todos.js";

export function createCard({ title, folderId, progress, last, next, blocked }) {
  return {
    id: "b_" + Date.now(),
    title,
    folderId,
    progress,
    last,
    next,
    blocked,
    updatedAt: Date.now(),
    sent: null,               // 투두로 보낸 기록 { date, text }
  };
}

// 오늘 이미 지금의 "다음 할 일"을 투두로 보냈는지 (다음 할 일이 바뀌면 다시 보낼 수 있다)
export function isSentToday(card) {
  return card.sent?.date === todayStr() && card.sent.text === card.next;
}

// "오늘 18:40" / "어제 18:40" / "11/9"
export function timeLabel(ms) {
  const date = new Date(ms);
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (todayStr(date) === todayStr()) return `오늘 ${hm}`;
  if (todayStr(date) === todayStr(yesterday)) return `어제 ${hm}`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function renderBoard(container, { board, folders, on }) {
  container.replaceChildren();

  if (board.length === 0) {
    const empty = document.createElement("p");
    empty.className = "board-empty";
    empty.textContent = "진행 중인 작업이 없어요. '+ 작업 추가'로 카드를 만들어 보세요.";
    container.append(empty);
    return;
  }

  // 최근에 손댄 작업이 앞에
  const cards = [...board].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const card of cards) container.append(cardItem(card));

  function cardItem(card) {
    const color = folderColor(card.folderId, folders);
    const article = document.createElement("article");
    article.className = "board-card";

    const head = document.createElement("div");
    head.className = "board-card-head";
    const titleBox = document.createElement("div");
    titleBox.className = "board-card-title";
    const path = folderLabel(card.folderId, folders);
    if (path) {
      const tag = document.createElement("span");
      tag.className = `tag c-${color}`;
      tag.textContent = path;
      titleBox.append(tag);
    }
    const title = document.createElement("h3");
    title.textContent = card.title;
    titleBox.append(title);
    const pct = document.createElement("span");
    pct.className = "board-pct num";
    pct.textContent = `${card.progress}%`;
    head.append(titleBox, pct);

    const bar = document.createElement("div");
    bar.className = "bar board-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", `${card.title} 진행률`);
    bar.setAttribute("aria-valuenow", card.progress);
    bar.setAttribute("aria-valuemin", 0);
    bar.setAttribute("aria-valuemax", 100);
    const fill = document.createElement("div");
    fill.className = `bar-fill c-${color}`;
    fill.style.width = `${card.progress}%`;
    bar.append(fill);

    const dl = document.createElement("dl");
    dl.className = "board-notes";
    addNote(dl, "마지막", card.last);
    addNote(dl, "다음", card.next, "next");
    addNote(dl, "막힘", card.blocked, "blocked");

    const foot = document.createElement("div");
    foot.className = "board-card-foot";
    const updated = document.createElement("span");
    updated.className = "board-updated";
    updated.textContent = `${timeLabel(card.updatedAt)} 업데이트`;

    const actions = document.createElement("div");
    actions.className = "board-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost-btn";
    edit.textContent = "수정";
    edit.setAttribute("aria-label", `수정: ${card.title}`);
    edit.addEventListener("click", () => on.edit(card.id));
    actions.append(edit);

    if (card.next) {
      const sent = isSentToday(card);
      const send = document.createElement("button");
      send.type = "button";
      send.className = sent ? "ghost-btn sent" : "primary-btn small";
      send.textContent = sent ? "✓ 오늘 투두에 추가됨" : "다음 할 일 → 오늘 투두로";
      send.disabled = sent;
      send.addEventListener("click", () => on.send(card.id));
      actions.append(send);
    }

    foot.append(updated, actions);
    article.append(head, bar, dl, foot);
    return article;
  }
}

function addNote(dl, label, value, className = "") {
  if (!value) return;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (className) {
    dt.className = className;
    dd.className = className;
  }
  dl.append(dt, dd);
}
