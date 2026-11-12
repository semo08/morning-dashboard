// 헤더: 날짜, 인사말, 시계
import { todayStr } from "./todos.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function renderHeader({ name, todayLeft }) {
  const now = new Date();
  document.getElementById("today-date").textContent =
    `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`;
  document.getElementById("greeting").textContent =
    name ? `${greetingFor(now.getHours())}, ${name}` : greetingFor(now.getHours());
  document.getElementById("today-left").textContent = `${todayLeft}개`;

  const clock = document.getElementById("clock");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  clock.textContent = `${hh}:${mm}`;
  clock.dateTime = `${hh}:${mm}`;
}

// 매초 시계를 갱신하고, 날짜가 바뀌면 onDayChange를 부른다
export function startClock(onTick, onDayChange) {
  let day = todayStr();
  setInterval(() => {
    const now = todayStr();
    if (now !== day) {
      day = now;
      onDayChange();
    } else {
      onTick();
    }
  }, 1000);
}
