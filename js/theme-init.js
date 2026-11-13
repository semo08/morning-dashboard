// 페이지가 그려지기 전에 저장된 테마를 적용한다 (module이 아니라 바로 실행됨)
try {
  const settings = JSON.parse(localStorage.getItem("settings"));
  if (settings && settings.theme) document.documentElement.dataset.theme = settings.theme;
} catch {
  // 저장된 값이 없거나 깨졌으면 기본 테마
}

// 배경 사진도 첫 화면부터 (main.js의 applyPhoto와 같은 방식)
const photo = localStorage.getItem("background");
if (photo) {
  document.documentElement.style.setProperty("--photo", `url("${photo}")`);
  document.documentElement.dataset.photo = "";
}
