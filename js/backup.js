// JSON 내보내기/가져오기: 다른 PC나 크롬 확장으로 데이터를 옮길 때 쓴다
import { PHOTO_KEY } from "./background.js";
import { todayStr } from "./todos.js";

const APP = "morning-dashboard";
const VERSION = 1;
const JSON_KEYS = ["folders", "todos", "expandedFolders", "settings", "board", "memo", "ddays", "history"];
const ARRAY_KEYS = ["folders", "todos", "expandedFolders", "board", "ddays"];

export function exportData() {
  const data = {};
  for (const key of JSON_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // 깨진 값은 옮기지 않는다
    }
  }
  // 배경 사진은 JSON이 아니라 data URL 문자열 그대로 저장돼 있다
  const photo = localStorage.getItem(PHOTO_KEY);
  if (photo) data[PHOTO_KEY] = photo;

  const json = JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  link.download = `morning-dashboard-${todayStr()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// 파일을 읽어 검사만 한다. 문제가 있으면 이유를 담아 throw
export async function readBackup(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("JSON 파일이 아니에요");
  }
  if (parsed?.app !== APP || typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("Morning Dashboard에서 내보낸 파일이 아니에요");
  }
  for (const key of ARRAY_KEYS) {
    if (key in parsed.data && !Array.isArray(parsed.data[key])) {
      throw new Error(`'${key}' 데이터가 깨져 있어요`);
    }
  }
  return parsed;
}

// 파일 내용으로 통째로 바꾼다 (파일에 없는 항목은 비운다)
// 쓰다가 용량 초과로 실패하면 원래 데이터로 되돌리고 throw
export function importData({ data }) {
  const keys = [...JSON_KEYS, PHOTO_KEY];
  const before = keys.map(key => [key, localStorage.getItem(key)]);
  try {
    for (const key of keys) localStorage.removeItem(key);
    for (const key of JSON_KEYS) {
      if (key in data) localStorage.setItem(key, JSON.stringify(data[key]));
    }
    if (typeof data[PHOTO_KEY] === "string") localStorage.setItem(PHOTO_KEY, data[PHOTO_KEY]);
  } catch {
    for (const [key, raw] of before) {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    }
    throw new Error("저장 공간이 모자라서 가져오지 못했어요");
  }
}
