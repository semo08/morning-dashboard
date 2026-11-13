// 대한민국 공휴일: 구글 캘린더 공개 피드(ICS)에서 받아 localStorage에 넣어둔다
// 구글이 브라우저 직접 호출(CORS)을 막아서 크롬 확장(host_permissions)에서만 받아진다.
// localhost 웹에서는 받지 못하고, 넣어둔 값이 없으면 공휴일 없이 그린다.
import { load, save } from "./storage.js";

const FEED = "https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics";
const KEY = "holidays";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // 일주일에 한 번 새로 받는다 (임시공휴일 반영)

// { "2026-09-25": "추석" }
export function cachedHolidays() {
  return load(KEY, null)?.days ?? {};
}

// 오래됐거나 없으면 새로 받아서 저장. 바뀐 게 있으면 새 목록을, 아니면 null
export async function refreshHolidays() {
  // 웹(localhost)에서는 어차피 막히니 요청하지 않는다
  if (!globalThis.chrome?.runtime?.id) return null;
  const cached = load(KEY, null);
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return null;
  try {
    const response = await fetch(FEED);
    if (!response.ok) return null;
    const days = parseIcs(await response.text());
    save(KEY, { fetchedAt: Date.now(), days });
    return days;
  } catch {
    // 오프라인: 넣어둔 값 그대로 쓴다
    return null;
  }
}

function parseIcs(text) {
  // 75자가 넘는 줄은 다음 줄 앞에 공백을 붙여 이어 쓴다 (ICS 줄 접기)
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const days = {};
  let event = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") event = {};
    else if (line === "END:VEVENT") {
      // 기념일(어버이날 등)은 빼고 쉬는 날만
      if (event.start && event.summary && event.description?.startsWith("공휴일")) {
        for (const date of eachDate(event.start, event.end)) days[date] = event.summary;
      }
      event = null;
    } else if (event) {
      const [name, ...rest] = line.split(":");
      const value = rest.join(":");
      if (name.startsWith("DTSTART")) event.start = value;
      else if (name.startsWith("DTEND")) event.end = value;
      // 구글은 대체공휴일을 "쉬는 날 삼일절"로 적는다 → "삼일절 대체공휴일"
      else if (name === "SUMMARY") event.summary = value.trim().replace(/^쉬는 날 (.+)$/, "$1 대체공휴일");
      else if (name === "DESCRIPTION") event.description = value;
    }
  }
  return days;
}

// "20260924" ~ "20260927"(끝 날짜 미포함) → ["2026-09-24", "2026-09-25", "2026-09-26"]
function eachDate(start, end) {
  const toDate = s => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const date = toDate(start);
  const last = end ? toDate(end) : new Date(date.getTime() + 86400000);
  const dates = [];
  while (date < last) {
    dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}
