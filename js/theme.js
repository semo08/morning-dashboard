// 테마 목록, 적용, 고르기 화면 (색 값은 css/style.css의 [data-theme]에 있다)

export const THEMES = [
  { id: "sunny", name: "햇살" },
  { id: "sky", name: "맑은 하늘" },
  { id: "lavender", name: "라벤더" },
  { id: "peach", name: "복숭아" },
  { id: "night", name: "밤" },
];

export function applyTheme(themeId) {
  document.documentElement.dataset.theme = themeId;
}

export function renderThemePicker(container, currentId, onPick) {
  container.replaceChildren();
  for (const theme of THEMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-option";
    // 버튼 안에서는 그 테마의 변수가 쓰여서 미리보기가 된다
    button.dataset.theme = theme.id;
    button.setAttribute("aria-pressed", String(theme.id === currentId));
    button.innerHTML = `<span class="swatches"><span class="sw-page"></span><span class="sw-hero"></span><span class="sw-primary"></span></span><span class="theme-name"></span>`;
    button.querySelector(".theme-name").textContent = theme.name;
    button.addEventListener("click", () => onPick(theme.id));
    container.append(button);
  }
}
