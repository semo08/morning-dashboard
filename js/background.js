// 배경 사진: 고른 사진을 줄여서 localStorage에 data URL로 저장한다
export const PHOTO_KEY = "background";

// 긴 변 기준. 새 탭 배경으로 충분하고, localStorage(약 5MB)에 넉넉히 들어가는 크기
const MAX_SIDE = 1920;
const QUALITIES = [0.82, 0.7, 0.55];

export async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return QUALITIES.map(q => canvas.toDataURL("image/jpeg", q));
}

// 화질 높은 것부터 저장해 보고, 자리가 모자라면 한 단계씩 낮춘다
export function savePhoto(candidates) {
  for (const url of candidates) {
    try {
      localStorage.setItem(PHOTO_KEY, url);
      return url;
    } catch {
      // 용량 초과: 다음 화질로
    }
  }
  return null;
}

export function removePhoto() {
  localStorage.removeItem(PHOTO_KEY);
}

export function applyPhoto(url) {
  const root = document.documentElement;
  if (url) {
    root.style.setProperty("--photo", `url("${url}")`);
    root.dataset.photo = "";
  } else {
    root.style.removeProperty("--photo");
    delete root.dataset.photo;
  }
}

export function renderPhotoPicker(container, { url, on }) {
  container.replaceChildren();

  const preview = document.createElement("div");
  preview.className = "photo-preview";
  if (url) preview.style.backgroundImage = `url("${url}")`;
  else preview.textContent = "기본 하늘";

  const actions = document.createElement("div");
  actions.className = "photo-actions";

  // 파일 입력은 숨기고 label을 버튼처럼 쓴다
  const pick = document.createElement("label");
  pick.className = "ghost-btn file-pick";
  pick.textContent = url ? "다른 사진" : "사진 고르기";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "file-input";
  input.addEventListener("change", () => {
    if (input.files[0]) on.pick(input.files[0]);
  });
  pick.append(input);
  actions.append(pick);

  if (url) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "ghost-btn";
    reset.textContent = "기본 하늘로";
    reset.addEventListener("click", on.remove);
    actions.append(reset);
  }

  container.append(preview, actions);
}
