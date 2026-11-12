// 헤더: 날짜, 인사말, 시계
import { todayStr } from "./todos.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 시간대별 하늘 아이콘: 해(6~17시) → 노을(17~20시) → 달(20~6시)
const SKY_ICONS = {
  sun: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="13" fill="currentColor"/>
    <path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  sunset: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <path d="M19 42a13 13 0 0 1 26 0z" fill="currentColor"/>
    <path d="M32 16v7M15 25l4.5 4.5M49 25l-4.5 4.5M6 42h52M16 50h32M25 57h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  moon: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <path d="M54 36.5A22 22 0 1 1 27.5 10a17 17 0 0 0 26.5 26.5z" fill="currentColor"/>
    <circle cx="47" cy="12" r="2.5" fill="currentColor"/>
    <circle cx="56" cy="21" r="1.8" fill="currentColor"/>
  </svg>`,
};

function skyFor(hour) {
  if (hour >= 6 && hour < 17) return "sun";
  if (hour >= 17 && hour < 20) return "sunset";
  return "moon";
}

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// 이름은 헤더의 입력칸이 직접 들고 있어서 여기서는 건드리지 않는다
export function renderHeader({ todayLeft }) {
  const now = new Date();
  document.getElementById("today-date").textContent =
    `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`;
  document.getElementById("greeting").textContent = greetingFor(now.getHours());

  // 매초 불리니까 시간대가 바뀔 때만 아이콘을 다시 그린다
  const icon = document.getElementById("sky-icon");
  const sky = skyFor(now.getHours());
  if (icon.dataset.sky !== sky) {
    icon.dataset.sky = sky;
    icon.innerHTML = SKY_ICONS[sky];
    // 배경 하늘의 빛도 같은 시간대를 따른다
    document.documentElement.dataset.sky = sky;
  }
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
