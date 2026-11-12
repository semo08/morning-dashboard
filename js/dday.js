// D-day: 헤더에 칩으로 표시. 칩을 누르면 수정/삭제, +로 추가

const DAY_MS = 1000 * 60 * 60 * 24;

export function createDday({ title, date }) {
  return { id: "d_" + Date.now(), title, date };
}

function daysLeft(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + "T00:00:00") - today) / DAY_MS);
}

// "D-12" / "D-DAY" / "D+3"
export function ddayLabel(date) {
  const n = daysLeft(date);
  if (n === 0) return "D-DAY";
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

export function renderDdays(container, { ddays, on }) {
  container.replaceChildren();

  // 가까운 날짜부터
  for (const dday of [...ddays].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "dday-chip" + (daysLeft(dday.date) < 0 ? " past" : "");
    chip.setAttribute("aria-label", `${dday.title} ${ddayLabel(dday.date)}, 수정`);

    const num = document.createElement("span");
    num.className = "dday-num num";
    num.textContent = ddayLabel(dday.date);
    const title = document.createElement("span");
    title.className = "dday-title";
    title.textContent = dday.title;

    chip.append(num, title);
    chip.addEventListener("click", () => on.edit(dday.id));
    container.append(chip);
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "dday-add";
  add.textContent = "+";
  add.setAttribute("aria-label", "D-day 추가");
  add.title = "D-day 추가";
  add.addEventListener("click", () => on.edit(null));
  container.append(add);
}
