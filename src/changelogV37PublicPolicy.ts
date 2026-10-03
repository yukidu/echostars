import { DEFAULT_CHANGELOG_DATA, VersionLog } from './components/ChangelogModal';

export const PUBLIC_V37_CHANGELOG: VersionLog = {
  version: 'v3.7',
  date: '2026/10/02',
  summary: '這一版主要改善手機與電腦的使用體驗：安裝到桌面更直覺、首頁排序與篩選更好操作、評價與權限顯示更穩定，新手教學與版面也更加清楚。',
  added: [
    '「安裝到桌面」入口固定顯示：支援的 Android 與電腦瀏覽器可直接開啟安裝；iPhone、iPad 會顯示簡單的加入主畫面教學。',
    '首頁加入更完整的新手提示，會說明如何回首頁、註冊會員、播放或暫停音檔，也可以選擇以後不再提醒。',
    '首頁調色盤增加更多顏色選擇，網站標誌、音波與主要按鈕會跟著目前選擇的主色變化。'
  ],
  modified: [
    '首頁排序與篩選重新整理，手機直式畫面也能完整操作，不會因螢幕較小而把重要按鈕藏起來。',
    '播放清單預設先依閱讀權限排列，再依新舊時間排列，較容易先看到自己可以直接收聽的內容。',
    '修正五星評價偶爾被誤算成 0 分的問題；沒有權限或尚未解鎖的私秘 VIP 音檔，也不會誤送評價。',
    '沒有閱讀權限的音檔會更明顯淡化，讓可收聽與不可收聽內容更容易分辨。',
    '首頁的網友關鍵字改得更簡潔，移除多餘符號與說明文字，選取與清除條件更直覺。',
    '訪客名稱改用較友善的隨機名稱；每次重新整理可能換一個暱稱，但同一裝置仍能維持原本的使用紀錄。',
    '首頁搜尋、排序、主選單與音檔資訊的間距重新調整，手機與桌面版面更整齊。',
    '新手教學的位置、箭頭與提示框重新設計，減少遮住畫面內容的情況。',
    '網站更新改為背景自動完成，不再突然跳出更新詢問，也不會因更新而中斷正在播放的音檔。',
    'iPhone、iPad 的加入主畫面說明重新簡化，避免出現一直停在「準備安裝」的情況。'
  ],
  removed: [
    '移除首頁排序列中不再需要的「講者」排序。',
    '移除會打斷使用者的版本更新確認視窗，改為安靜地在背景更新。',
    '移除安裝流程中重複、過長或容易讓人混淆的技術說明。'
  ]
};

const runtime = window as Window &
  typeof globalThis & {
    __ECHOSTARS_V37_CHANGELOG_PATCH__?: boolean;
  };

const replaceV37 = (log: VersionLog): VersionLog =>
  log.version === 'v3.7'
    ? {
        ...log,
        ...PUBLIC_V37_CHANGELOG,
        isLatest: log.isLatest
      }
    : log;

// Keep the shipped fallback safe even when /api/changelog is unavailable.
const shippedV37Index = DEFAULT_CHANGELOG_DATA.findIndex(log => log.version === 'v3.7');
if (shippedV37Index >= 0) {
  DEFAULT_CHANGELOG_DATA[shippedV37Index] = replaceV37(DEFAULT_CHANGELOG_DATA[shippedV37Index]);
}

const normalizePayload = (data: unknown): VersionLog[] => {
  const list = Array.isArray(data)
    ? data.filter(item => item && typeof item === 'object') as VersionLog[]
    : [];

  const normalized = list.map(replaceV37);
  if (!normalized.some(log => log.version === 'v3.7')) {
    normalized.push({ ...PUBLIC_V37_CHANGELOG, isLatest: false });
  }
  return normalized;
};

const isChangelogGet = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => {
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET') return false;

  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/api/changelog';
  } catch {
    return false;
  }
};

if (!runtime.__ECHOSTARS_V37_CHANGELOG_PATCH__) {
  runtime.__ECHOSTARS_V37_CHANGELOG_PATCH__ = true;
  const previousFetch = window.fetch.bind(window);

  window.fetch = (async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    if (!isChangelogGet(input, init)) return previousFetch(...args);

    const response = await previousFetch(...args);
    if (!response.ok) return response;

    try {
      const data = await response.clone().json();
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.delete('Content-Length');
      headers.delete('Content-Encoding');

      return new Response(JSON.stringify(normalizePayload(data)), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  }) as typeof window.fetch;
}
