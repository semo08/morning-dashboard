// 연차: 근로기준법대로 받은 개수를 계산하고, 쓴 날(오늘까지)과 쓸 날(예정)을 나눠 센다
// 주말과 공휴일은 연차를 쓴 날로 세지 않는다
import { todayStr } from "./todos.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export const UNITS = [
  { value: 1, label: "연차" },
  { value: 0.5, label: "반차" },
  { value: 0.25, label: "반반차" },
];

export const DEFAULT_LEAVE_SETTINGS = { hireDate: "", basis: "hire", custom: null };

const parse = s => new Date(s + "T00:00:00");

// 7.4 / 8.25 / 15 (0.25 단위와 비례 계산 소수점을 깔끔하게)
export function fmt(n) {
  return String(Math.round(n * 100) / 100);
}

export function unitLabel(unit) {
  return UNITS.find(u => u.value === unit)?.label ?? "연차";
}

// 말일 보정: 1/31 + 1달 = 2/28
function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), last));
  return d;
}

// from부터 to까지 꽉 채운 햇수
function fullYears(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  if (addMonths(from, years * 12) > to) years--;
  return years;
}

// 1년 이상: 15일, 3년차부터 2년마다 1일 더 (최대 25일)
function annualDays(years) {
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}

// 1년 미만은 한 달 채울 때마다 1일 (입사 1~11개월 되는 날)
function monthlyDates(hire) {
  return Array.from({ length: 11 }, (_, i) => addMonths(hire, i + 1));
}

// 회계연도 기준 입사 다음 해: 입사한 해에 일한 날만큼 15일을 나눠 준다
function proratedDays(hire) {
  const nextJan = new Date(hire.getFullYear() + 1, 0, 1);
  const yearDays = Math.round((nextJan - new Date(hire.getFullYear(), 0, 1)) / DAY_MS);
  const worked = Math.round((nextJan - hire) / DAY_MS);
  return Math.round((15 * worked / yearDays) * 100) / 100;
}

// 지금 연차 기간 { start, end(포함 안 함), legal, granted, custom, note, next }
// 입사일이 없거나 아직 안 왔으면 null
export function leaveYear(config, now = new Date()) {
  if (!config?.hireDate) return null;
  const hire = parse(config.hireDate);
  const today = parse(todayStr(now));
  if (today < hire) return null;

  const monthly = monthlyDates(hire);
  let start, end, legal, note, next;

  if (config.basis === "fiscal") {
    const year = today.getFullYear();
    const hireYear = hire.getFullYear();
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
    const monthlyThisYear = monthly.filter(d => d >= start && d < end);
    const accrued = monthlyThisYear.filter(d => d <= today).length;
    const upcoming = monthlyThisYear.find(d => d > today);

    if (year === hireYear) {
      legal = accrued;
      note = "입사한 해 · 한 달에 1일씩";
    } else if (year === hireYear + 1) {
      legal = Math.round((proratedDays(hire) + accrued) * 100) / 100;
      note = `작년 근무 비례 ${fmt(proratedDays(hire))}일` + (accrued ? ` + 월차 ${accrued}일` : "");
    } else {
      legal = annualDays(year - hireYear - 1);
      note = `회계연도 ${year - hireYear + 1}년차`;
    }
    const nextYearDays = year === hireYear ? proratedDays(hire) : annualDays(year - hireYear);
    next = upcoming ? { date: upcoming, text: "+1일" } : { date: end, text: `새로 ${fmt(nextYearDays)}일` };
  } else {
    const years = fullYears(hire, today);
    if (years < 1) {
      start = hire;
      end = addMonths(hire, 12);
      const accrued = monthly.filter(d => d <= today).length;
      legal = accrued;
      note = `입사 ${accrued}개월 · 한 달에 1일씩`;
      next = accrued < 11 ? { date: monthly[accrued], text: "+1일" } : { date: end, text: "새로 15일" };
    } else {
      start = addMonths(hire, years * 12);
      end = addMonths(hire, (years + 1) * 12);
      legal = annualDays(years);
      note = `근속 ${years}년`;
      next = { date: end, text: `새로 ${annualDays(years + 1)}일` };
    }
  }

  // 직접 넣은 개수는 넣었던 기간에만 쓴다 (기간이 바뀌면 다시 법정 기준)
  const custom = config.custom?.start === todayStr(start) ? config.custom.days : null;
  return {
    start: todayStr(start),
    end: todayStr(end),
    legal,
    granted: custom ?? legal,
    custom: custom !== null,
    note,
    next: { date: todayStr(next.date), text: next.text },
  };
}

export function createLeave({ start, end, unit, memo }) {
  return { id: "l_" + Date.now(), start, end: end || start, unit, memo };
}

// 연차를 쓴 날짜들. 주말·공휴일은 뺀다
export function entryDays(entry, holidays) {
  const days = [];
  const last = parse(entry.end ?? entry.start);
  for (const d = parse(entry.start); d <= last; d.setDate(d.getDate() + 1)) {
    const date = todayStr(d);
    if (d.getDay() === 0 || d.getDay() === 6 || holidays[date]) continue;
    days.push(date);
  }
  return days;
}

// 달력 표시용 { "2026-11-20": 0.5 }
export function leaveDates(leaves, holidays) {
  const dates = {};
  for (const entry of leaves) {
    for (const date of entryDays(entry, holidays)) dates[date] = (dates[date] ?? 0) + entry.unit;
  }
  return dates;
}

// 이번 기간에 쓴 개수(오늘까지)와 예정 개수(내일부터), 기간 안의 기록 목록
export function leaveUsage(leaves, holidays, year) {
  const today = todayStr();
  let used = 0;
  let planned = 0;
  const entries = [];
  for (const entry of leaves) {
    const days = entryDays(entry, holidays).filter(d => d >= year.start && d < year.end);
    if (days.length === 0) continue;
    for (const d of days) {
      if (d <= today) used += entry.unit;
      else planned += entry.unit;
    }
    entries.push({ entry, amount: days.length * entry.unit, planned: days.at(-1) > today });
  }
  entries.sort((a, b) => (a.entry.start < b.entry.start ? 1 : -1));   // 최근 것(예정)부터
  return { used, planned, left: year.granted - used - planned, entries };
}

function shortDate(s, withDay = true) {
  const d = parse(s);
  return `${d.getMonth() + 1}/${d.getDate()}` + (withDay ? ` (${WEEKDAYS[d.getDay()]})` : "");
}

// "2026.3.2 ~ 2027.3.1" (end는 포함하지 않으니 하루 전까지)
function periodLabel(year) {
  const last = parse(year.end);
  last.setDate(last.getDate() - 1);
  const dot = d => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  return `${dot(parse(year.start))} ~ ${dot(last)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// listOpen: 사용 내역을 펼쳤는지
export function renderLeave(container, { year, usage, listOpen, on }) {
  container.replaceChildren();
  const head = el("div", "leave-head");
  const title = el("h2", "", "연차");
  title.id = "leave-title";
  head.append(title);
  container.append(head);

  if (!year) {
    const setup = el("button", "ghost-btn", "입사일 넣기");
    setup.type = "button";
    setup.addEventListener("click", on.setup);
    container.append(el("p", "leave-empty", "입사일을 넣으면 근로기준법대로 연차를 계산해요"), setup);
    return;
  }

  const { used, planned, left } = usage;
  const total = el("span", "leave-total");
  total.append(el("strong", "num", fmt(Math.max(0, left))), el("span", "num", ` / ${fmt(year.granted)}일`));
  head.append(total);

  // 게이지: 쓴 것 | 예정 | 남은 것
  const bar = el("div", "bar leave-bar");
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `${fmt(year.granted)}일 중 사용 ${fmt(used)}일, 예정 ${fmt(planned)}일, 남은 ${fmt(left)}일`);
  const pct = n => (year.granted > 0 ? Math.min(100, (n / year.granted) * 100) : 0);
  const usedFill = el("span", "leave-used");
  usedFill.style.width = `${pct(used)}%`;
  const plannedFill = el("span", "leave-planned");
  plannedFill.style.width = `${Math.min(pct(planned), 100 - pct(used))}%`;
  bar.append(usedFill, plannedFill);

  const stats = el("ul", "leave-stats");
  stats.append(
    el("li", "stat-used", `사용 ${fmt(used)}일`),
    el("li", "stat-planned", `예정 ${fmt(planned)}일`),
    left < 0 ? el("li", "stat-over", `${fmt(-left)}일 초과`) : el("li", "stat-left", `남은 ${fmt(left)}일`),
  );

  const meta = el("p", "leave-meta");
  meta.append(
    el("span", "", `${periodLabel(year)} · ${year.custom ? "직접 입력" : year.note}`),
    el("span", "", `다음 발생 ${shortDate(year.next.date, false)} · ${year.next.text}`),
  );

  container.append(bar, stats, meta);

  // 사용 내역은 눌러서 펼치고 접는다
  if (usage.entries.length) {
    const toggle = el("button", "leave-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(listOpen));
    toggle.setAttribute("aria-controls", "leave-list");
    toggle.append(el("span", "", "사용 내역"), el("span", "num leave-count", usage.entries.length));
    toggle.addEventListener("click", on.toggleList);
    container.append(toggle);
  }
  if (usage.entries.length && listOpen) {
    const list = el("ul", "leave-list");
    list.id = "leave-list";
    for (const { entry, amount, planned: isPlanned } of usage.entries) {
      const item = el("li");
      const button = el("button", "leave-item" + (isPlanned ? " planned" : ""));
      button.type = "button";
      const range = entry.end !== entry.start ? `${shortDate(entry.start)} ~ ${shortDate(entry.end)}` : shortDate(entry.start);
      const kind = entry.unit === 1 ? `연차 ${fmt(amount)}일` : unitLabel(entry.unit);
      button.append(el("span", "num leave-date", range), el("span", "leave-kind", kind));
      if (isPlanned) button.append(el("span", "leave-badge", "예정"));
      if (entry.memo) button.append(el("span", "leave-memo", entry.memo));
      button.setAttribute("aria-label", `${range} ${kind}${entry.memo ? `, ${entry.memo}` : ""}${isPlanned ? ", 예정" : ""}, 고치기`);
      button.addEventListener("click", () => on.edit(entry.id));
      item.append(button);
      list.append(item);
    }
    container.append(list);
  }

  const add = el("button", "dashed-btn", "+ 연차 쓰기");
  add.type = "button";
  add.addEventListener("click", () => on.edit(null));
  container.append(add);
}
