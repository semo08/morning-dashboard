// 달력: 한 달 보기. 안 끝낸 할 일의 마감일에 점을 찍는다
import { isVisible, todayStr } from "./todos.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 날짜별 남은 마감 개수 { "2026-11-15": 2 }
function dueCounts(todos) {
  const counts = {};
  for (const t of todos) {
    if (!t.due || t.done || t.repeat || !isVisible(t)) continue;
    counts[t.due] = (counts[t.due] ?? 0) + 1;
  }
  return counts;
}

export function renderCalendar(container, { year, month, todos, selectedDate, on }) {
  container.replaceChildren();
  const today = todayStr();
  const now = new Date();
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  const head = document.createElement("div");
  head.className = "cal-head";
  const title = document.createElement("h2");
  title.id = "cal-title";
  title.textContent = `${year}년 ${month + 1}월`;

  const navBox = document.createElement("div");
  navBox.className = "cal-nav";
  if (!isThisMonth) navBox.append(navButton("오늘", "이번 달로", on.today, "cal-today"));
  navBox.append(
    navButton("‹", "이전 달", () => on.move(-1)),
    navButton("›", "다음 달", () => on.move(1)),
  );
  head.append(title, navBox);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-labelledby", "cal-title");

  for (const [i, name] of WEEKDAYS.entries()) {
    const cell = document.createElement("span");
    cell.className = "cal-weekday" + (i === 0 ? " sun" : "");
    cell.setAttribute("aria-hidden", "true");
    cell.textContent = name;
    grid.append(cell);
  }

  // 1일 앞의 빈칸
  const firstDay = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDay; i++) grid.append(document.createElement("span"));

  const counts = dueCounts(todos);
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDate; day++) {
    const date = dateStr(year, month, day);
    const count = counts[date] ?? 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-day";
    if (date === today) button.classList.add("today");
    if (date === selectedDate) button.classList.add("selected");
    if ((firstDay + day - 1) % 7 === 0) button.classList.add("sun");
    button.setAttribute("aria-pressed", String(date === selectedDate));
    button.setAttribute("aria-label",
      `${month + 1}월 ${day}일` + (date === today ? ", 오늘" : "") + (count ? `, 마감 ${count}개` : ""));
    if (date === today) button.setAttribute("aria-current", "date");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = day;
    button.append(num);

    if (count) {
      const dot = document.createElement("span");
      dot.className = "cal-dot" + (date < today ? " overdue" : "");
      button.append(dot);
    }

    button.addEventListener("click", () => on.pick(date));
    grid.append(button);
  }

  container.append(head, grid);
}

function navButton(text, label, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cal-nav-btn " + className;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}
