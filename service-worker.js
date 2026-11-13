// 툴바 아이콘을 누르면 대시보드를 연다. 이미 열려 있으면 그 탭으로 이동
const PAGE = chrome.runtime.getURL("index.html");

chrome.action.onClicked.addListener(async () => {
  // tabs 권한 없이 내 확장 페이지가 열린 탭을 찾는다
  const [open] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [PAGE] });
  if (open) {
    await chrome.tabs.update(open.tabId, { active: true });
    await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: PAGE });
  }
});
