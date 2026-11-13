// 잔디: 날짜별 완료 개수 { "2026-11-12": 3 } 를 기록하고 최근 몇 주(카드 폭만큼)를 그린다
import { todayStr } from "./todos.js";

export const MAX_WEEKS = 53;   // 1년

// 완료하면 +1, 완료를 취소하면 그 날짜에서 -1. 새 객체를 돌려준다
export function recordDone(history, date, delta) {
  if (!date) return history;
  const count = Math.max(0, (history[date] ?? 0) + delta);
  const next = { ...history };
  if (count) next[date] = count;
  else delete next[date];
  return next;
}

// 기록이 처음 생길 때: 지금 완료 상태로 남아 있는 투두의 doneAt으로 채운다
export function seedHistory(todos) {
  let history = {};
  for (const t of todos) if (t.done && t.doneAt) history = recordDone(history, t.doneAt, 1);
  return history;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// 오늘(아직 0개면 어제)부터 거꾸로 하나 이상 완료한 날이 이어진 수
export function streak(history) {
  let day = new Date();
  if (!history[todayStr(day)]) day = addDays(day, -1);
  let n = 0;
  while (history[todayStr(day)]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

// 0 / 1 / 2~3 / 4~5 / 6개 이상
function level(count) {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function renderGrass(container, history, weeks = 18) {
  container.replaceChildren();
  const today = todayStr();

  // 이번 주 일요일에서 (weeks - 1)주 전 일요일부터
  const start = addDays(new Date(), -new Date().getDay() - (weeks - 1) * 7);
  container.style.setProperty("--weeks", weeks);
  let total = 0;

  for (let i = 0; i < weeks * 7; i++) {
    const date = todayStr(addDays(start, i));
    const cell = document.createElement("span");
    cell.className = "grass-cell";
    if (date > today) {
      cell.classList.add("future");
    } else {
      const count = history[date] ?? 0;
      total += count;
      cell.classList.add(`lv-${level(count)}`);
      const [, m, d] = date.split("-");
      cell.title = `${Number(m)}월 ${Number(d)}일 · ${count}개 완료`;
    }
    container.append(cell);
  }

  container.setAttribute("aria-label", `최근 ${weeks}주 동안 ${total}개 완료`);
}
