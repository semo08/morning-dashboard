// 어제의 메모: 퇴근 체크아웃 때 남긴 한 줄을 아침에 맨 위에 보여준다
import { todayStr } from "./todos.js";

// "어제 남긴 메모 · 18:42" / "오늘 남긴 메모 · 18:42" / "11/9에 남긴 메모"
function memoLabel(ms) {
  const date = new Date(ms);
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (todayStr(date) === todayStr()) return `오늘 남긴 메모 · ${hm}`;
  if (todayStr(date) === todayStr(yesterday)) return `어제 남긴 메모 · ${hm}`;
  return `${date.getMonth() + 1}/${date.getDate()}에 남긴 메모`;
}

export function renderMemo(container, { memo, onCheckout }) {
  container.replaceChildren();
  container.classList.toggle("empty", !memo);

  const icon = document.createElement("span");
  icon.className = "memo-icon";
  icon.innerHTML = `<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>`;

  const body = document.createElement("div");
  body.className = "memo-body";
  if (memo) {
    const label = document.createElement("span");
    label.className = "memo-label";
    label.textContent = memoLabel(memo.writtenAt);
    const text = document.createElement("strong");
    text.className = "memo-text";
    text.textContent = memo.text;
    body.append(label, text);
  } else {
    const hint = document.createElement("span");
    hint.className = "memo-label";
    hint.textContent = "퇴근할 때 내일 아침의 나에게 한 줄 남겨보세요";
    body.append(hint);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-btn";
  button.textContent = "퇴근 체크아웃";
  button.addEventListener("click", onCheckout);

  container.append(icon, body, button);
}
