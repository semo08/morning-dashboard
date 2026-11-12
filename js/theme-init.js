// 페이지가 그려지기 전에 저장된 테마를 적용한다 (module이 아니라 바로 실행됨)
try {
  const settings = JSON.parse(localStorage.getItem("settings"));
  if (settings && settings.theme) document.documentElement.dataset.theme = settings.theme;
} catch {
  // 저장된 값이 없거나 깨졌으면 기본 테마
}
