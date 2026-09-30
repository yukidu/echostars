import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  PlusCircle,
  RefreshCw,
  Trash2,
  Calendar,
  ShieldCheck,
  Database,
  Edit3,
  Check,
  Plus,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UserProfile } from '../types';

export interface VersionLog {
  version: string;
  date: string;
  isLatest?: boolean;
  summary: string;
  added: string[];
  modified: string[];
  removed: string[];
}

export const DEFAULT_CHANGELOG_DATA: VersionLog[] = [
  {
    version: 'v2.7',
    date: '2026/09/30',
    isLatest: true,
    summary: '首頁版面空間大釋放（刪除大框線與上傳鈕、多組關鍵字與網友關鍵字搜尋）、音檔詳細頁動線再優化（分享錄音與匯出圖卡移至留言板上方、參考資料移至備註上方、緊湊評價留言、放大快轉倒退、上傳者顯示、跳轉後台全功能編輯）、通知頁快速回覆/跳轉自動消失強化、學員學習檔案卡生命靈數九宮格靠右對齊與極致緊湊學習進度匯出、私秘VIP專屬連結守護與真實Google帳號授權登入。',
    added: [
      '首頁搜尋框升級：支援空格同時輸入多組關鍵字檢索，全面納入「網友關鍵字」比對搜尋，並於搜尋框同一排增加專屬「搜尋」按鈕。',
      '音檔詳細介紹頁新增顯示「上傳者」姓名於演講資訊與備註中。',
      '音檔詳細介紹頁點選「網友關鍵字」，直接跳轉首頁篩選該關鍵字相關內容。',
      '音檔詳細介紹頁按下「編輯演講資訊與連結」，改為跳轉後台管理相同之「編輯音檔」全功能視窗介面。',
      '私秘VIP音檔專屬權限守護：首頁與詳細頁顯示鎖頭與「私秘VIP」，未持有專屬連結者點擊播放會跳出「此音檔為私秘VIP專屬，請聯絡上傳者給您專屬連結」；曾點選過上傳者專屬網址者自動解鎖播放。',
      '學員學習檔案卡圖片匯出功能升級：包含該會員音檔學習進度、給予評價、心得留言內容，生命靈數九宮格移至頂端右側與基本資料對齊，去除鑽石與皇冠符號及說明文字，排版更緊密節省空間。'
    ],
    modified: [
      '音檔詳細介紹頁按鈕「推薦分享此演講」文字更名為「分享錄音」，按鈕「匯出資訊圖卡」更名為「匯出圖卡」，位置統一移動至留言板的上方。',
      '音檔詳細介紹頁區塊標題「相關外部學習資源」文字更名為「參考資料」，位置向下移動至「演講資訊與備註」的正上方。',
      '音檔詳細介紹頁「評價、留言、按讚」整列左右排列更緊密，五顆星星更加靠近，留言按鈕順序往前移至按讚前面。',
      '網友關鍵字區塊移至音檔詳細介紹頁的最頂部，並優化手機小裝置新增關鍵字時 X 取消按鈕的觸控點擊與佈局。',
      '播放器快轉與倒退按鈕符號顯著放大，操作更俐落醒目。',
      '後台管理中心網友關鍵字之「網友關鍵字清單與直接編輯」區塊重新設計排版，完美適配手機小螢幕瀏覽與操作。',
      'Google 帳號登入註冊採用標準 Google Identity Services 認證授權流程，杜絕無認證任意切換。',
      '針對手機小螢幕（寬度小於 360px）加入動態自適應字體與 CSS 變數等比縮放，確保所有元件不溢出螢幕邊框。'
    ],
    removed: [
      '刪除網頁最下方的右下角「v版本號」標籤。',
      '刪除首頁播放清單包圍所有單獨音檔的外層更大區塊框線與多餘邊距，騰出更多瀏覽空間。',
      '刪除首頁播放清單頂部的「上傳錄音檔」按鈕。',
      '刪除首頁搜尋建議下拉框中的「音檔詳細資料」，維持推薦簡潔。',
      '刪除音檔詳細介紹頁右上角「縮小、底部、放大」三個按鈕。',
      '刪除播放器快轉 30 秒與倒退 30 秒按鈕，僅保留俐落的 10 秒微調。',
      '刪除主選單「通知」頁面的「個人卡」按鈕，並修復按「快速回覆」或「跳轉留言」後通知百分之百即時消失。',
      '刪除 Google 帳號登入視窗中預設之三組假身分與「或輸入其他指定 Google 帳號綁定」區塊。'
    ]
  },
  {
    version: 'v2.6',
    date: '2026/09/30',
    summary: '音檔詳細介紹頁動線重塑（網友關鍵字置頂、參考資料與備註重整、緊湊評價留言）、分頁標籤左右< >點選捲動、手機小裝置自動縮小適配、首頁多組關鍵字檢索、私秘VIP預設永久有效與專屬權限守護、學員學習檔案卡生命靈數九宮格黑白符號升級。',
    added: [
      '「驚嘆號頁面」、「後台管理中心」與「個人中心」分頁標籤列左右新增 < > 箭頭符號，支援平滑點選向左或向右移動標籤。',
      '學員學習檔案卡圖片匯出功能升級：包含生命靈數九宮格圈圈圖，針對黑白圖特色，天賦數以鑽石符號（◆）標示（如33則顯示二顆鑽石）、加總主命數以皇冠符號（♛）標示，並附註完整圖例說明，同時保留原本圈圈標記。',
      '首頁搜尋框多組關鍵字檢索：支援空格分隔多組關鍵字同時篩選，納入「網友關鍵字」比對搜尋，並於同一排增加「搜尋」按鈕。',
      '音檔詳細資訊與備註新增「上傳者」姓名顯示。',
      '音檔詳細頁點選「網友關鍵字」，可直接跳轉首頁篩選該關鍵字相關內容。',
      '私秘VIP音檔首頁標籤顯示「私秘VIP」，未持專屬連結者點擊放大詳細介紹頁可查看全部內容與功能，唯獨播放時跳出專屬連結說明；曾經持有或造訪該專屬連結者可直接播放。',
      '音檔詳細頁點擊「編輯演講資訊與連結」按鈕，直接跳轉後台管理相同之「編輯音檔」全功能介面。'
    ],
    modified: [
      '「驚嘆號頁面」最上方分頁僅顯示版本號，不再顯示日期，大幅精簡版面空間。',
      '所有頁面大標題底下的小標題頁面說明全面移除，版面更緊湊，降低閱讀疲勞。',
      '音檔詳細頁按鈕「推薦分享此演講」改名為「分享錄音」，按鈕「匯出資訊圖卡」改名為「匯出圖卡」，並統一移至留言板上方。',
      '「相關外部學習資源」更名為「參考資料」，位置向下移動至「演講資訊與備註」上方。',
      '「評價、按讚、留言」排列極致緊密，五顆星星更加靠近，留言按鈕順序往前移至按讚前面。',
      '「網友關鍵字」區塊向上移動至音檔詳細頁的最頂部。',
      '留言板訪客身份「(訪客)」視覺設計框與已註冊會員獎銜同款設計，維持整體視覺一致性。',
      '播放器快轉與倒退符號顯著放大，操作更清晰易點。',
      '上傳音檔視窗「私秘VIP專屬」有效天數預設改為「永久有效」。',
      '頁面標題「學習夥伴個人中心」簡化為「個人中心」；分頁「已聆聽清單」更名為「學習進度」；「基本資料」分頁去除括號姓名直接顯示。'
    ],
    removed: [
      '刪除播放器快轉 30 秒與倒退 30 秒按鈕，僅保留俐落的 10 秒微調。',
      '刪除留言板輸入打字區框框內預設之一長串備註說明文字。',
      '刪除留言板「Cloudflare Workers AI 智慧審核保護中」標語。',
      '刪除「後台管理中心 > 網友關鍵字」之「為音檔指派新關鍵字」功能區塊。',
      '刪除「首頁播放清單」頂部的「上傳按鈕」。',
      '刪除首頁搜尋建議選單中的「音檔詳細資料」，維持推薦簡潔。',
      '通知頁面用戶點擊「快速回覆」或「跳轉留言」後，該則通知自動從通知頁面消失。'
    ]
  },
  {
    version: 'v2.5',
    date: '2026/09/30',
    summary: '個人中心操作動線全面升級、後台分類標籤緊密排列、排行榜全新「熱門關鍵字」統計分頁、留言身分精確區隔（訪客標示與無獎銜防呆）、通知頁面被標記留言版面極致緊湊。',
    added: [
      '排行榜新增「熱門關鍵字」各項統計分頁：呈現關鍵字覆蓋率、累計標記次數、Top 10 熱門關鍵字榜、點擊關聯音檔直接播放與熱度詞雲分佈。',
      '留言板訪客與會員身分嚴格區隔：非註冊訪客之暱稱右側統一標註「（訪客）」標籤，且嚴格禁止顯示獎銜；已註冊會員留言者均可點擊姓名即時彈出個人學習檔案與數字易經資訊卡。',
      '網頁底部右下角版本號更新為 v2.5，連動驚嘆號改版歷程頁面最新資訊。'
    ],
    modified: [
      '個人中心「登出」按鈕移至最上方：移至個人中心最頂部導覽列，跨分頁一目瞭然，點擊更直覺、操作體驗大幅提升。',
      '後台管理中心分類標籤排版優化：由原本一行一個/大網格改成緊密左右排列（橫向流動排版），高度利用螢幕橫向空間，標籤瀏覽與管理更迅速。',
      '主選單通知頁「被標記的留言」版面緊湊化：刪除每則留言框框左上角重複出現的「＠標記了你」大標題，收縮頭像與外框間距，實現極致乾淨緊湊排版。'
    ],
    removed: [
      '刪除通知頁被標記留言每筆卡片左上角重複之「＠標記了你」標籤文字。',
      '刪除非註冊訪客留言中任何誤配之獎銜標籤，杜絕資訊卡誤點與身分混淆。'
    ]
  },
  {
    version: 'v2.4',
    date: '2026/09/30',
    summary: '主選單與後台中心分頁重整、角色權限表主色連動、@標記關聯字演講者與會員精準區隔、通知頁面被標記留言置頂與即時同步修復、驚嘆號改版頁面段落即時手動在線編輯。',
    added: [
      '@或＠標記選單加入「音檔演講者」：輸入 @ 或 ＠ 時，提示選單全面納入全站錄音檔講師姓名，右側清楚標註「音檔演講者」；已註冊會員右側清楚顯示「中心+獎銜」，彼此一目瞭然。',
      '驚嘆號改版歷程段落編輯：超級管理員專屬功能，點擊驚嘆號視窗右上角編輯按鈕，即可自由手動修改每一次改版重點、增加項目、修改項目與刪除項目文字並持久保存。',
      '首頁預覽留言 @ 標記全域即時同步：修復首頁快速預覽留言視窗發表的半形 @ 與全形 ＠ 留言未出現在通知的問題，全站跨音檔留言即時聯網載入。'
    ],
    modified: [
      '置頂主選單名稱重構：選單標題規範為「首頁播放清單」、「排行榜」、「通知與獎銜審核」（無審核權限者僅顯示「通知」）、「上傳音檔」、「個人中心」、「後台管理」。',
      '後台中心分頁順序調整：分頁左右順序重排為「數據中心」、「會員」、「音檔」、「私秘音檔」（原私秘VIP）、「分類標籤」、「網友關鍵字」、「權限表」。',
      '後台權限表視覺優化：一般角色權限黑色豆豆改為低調灰色；當前登入者所屬身分擁有之權限豆豆，自動高亮連動為網站 LOGO 主色系同色。',
      '主選單通知頁面佈局升級：「@被標記的留言」移至第一位成為首要預設焦點，分頁選項排列更加緊密，手機左右太窄時自動等比縮小字體符合全寬。'
    ],
    removed: [
      '通知頁面移除「所有通知」分頁：簡化標籤層級，直接聚焦於「@被標記的留言」、「待審核名冊」與「已通過核准」三項核心動態。'
    ]
  },
  {
    version: 'v2.3',
    date: '2026/09/30',
    summary: 'Cloudflare Workers + D1 + R2 + KV 全端架構部署支援、私秘VIP音檔專屬連結分享與天數設定、訪客留言資訊卡保護。',
    added: [
      'Cloudflare Workers + D1 + R2 + KV 全端架構支援：提供完整 wrangler.toml 與 schema.sql，後端無伺服器架構高效運作。',
      '私秘VIP音檔獨立上傳選項：貢獻者可上傳最多 10 首私秘VIP音檔，專屬加密連結可設定 3/7/14/30 天或永久有效。',
      '後台私秘音檔管理中心：獨立分頁管理私秘音檔，支援重置專屬連結、天數設定與音檔刪除。'
    ],
    modified: [
      '首頁快速瀏覽留言板：點選未登入訪客名字不再出現資訊卡，避免誤觸無效連結。',
      '後台管理中心分頁標籤緊緻排版：標籤左右文字更加緊密美觀。'
    ],
    removed: [
      '移除未登入訪客的卡片彈窗觸發事件。'
    ]
  },
  {
    version: 'v2.1',
    date: '2026/09/30',
    summary: '後台中心介面緊密升級、留言板 @ 標記優化、通知快速回覆與全域資料庫持久維護。',
    added: [
      '@ 標記關鍵字提示：輸入 @ 並鍵入關鍵字時，同步提示網站中相符之「錄音檔名稱」與「演講人姓名」。',
      '主選單通知快捷互動：被 @ 標記的通知項目支援「直接快速回覆」與「一鍵跳轉」至該音檔留言處（保留最新前 50 則）。',
      '留言自主管理：會員可直接於留言板編輯或刪除自己過去發布的留言內容。',
      '低調驚嘆號改版歷程按鈕：左下角常駐低調驚嘆號，隨時查閱全版本增加、修改、刪除紀錄與發布日期。'
    ],
    modified: [
      '後台中心分頁重整：標籤更緊密排列，順序與名稱調整為「數據中心」、「會員」、「音檔」、「分類標籤」、「網友關鍵字」、「權限」。',
      '個人基本資料與留言板即時連動：會員修改基本資料姓名後，留言板歷史發言與身分即時同步修正。',
      '超級管理員留言身分校正：取消「🐲杜杜龍」暱稱，完全與個人基本資料設定名稱同步一致。'
    ],
    removed: [
      '刪除 2.5X 播放倍速：音頻播放控制項全面刪除 2.5X 倍速選項，維持乾淨好點擊的 0.7x ~ 2.0x 節奏。',
      '取消已標記音檔彈窗試聽：留言中被 @ 的錄音檔不再彈出試聽播放對話框，改以高質感音檔標籤呈現。'
    ]
  },
  {
    version: 'v2.0',
    date: '2026/09/28',
    summary: '後台數據中心全面升級、網友關鍵字標籤庫上線、留言板會員標記與學習卡匯出加強。',
    added: [
      '後台數據中心：白金以上權限專屬儀表板，即時監控會員活躍比例、中心分佈與收聽高峰。',
      '網友關鍵字庫：每則音檔支援最多 20 個關鍵字標籤，提供精準多標籤檢索。',
      '黑白個人圖卡分享：支援呼叫行動裝置原生 Web Share API 快速分享個人學習檔案。'
    ],
    modified: [
      '音檔全螢幕詳細頁直接支援音檔資訊、備註與相關影片/簡報學習連結修改。',
      '分類標籤與熱門排行智慧關聯推薦演算法校準。'
    ],
    removed: [
      '移除訪客檢視通知頁中審核人員姓名之顯示，保障隱私。'
    ]
  },
  {
    version: 'v1.9',
    date: '2026/09/25',
    summary: '生命靈數九宮格分析圖、鑽石專屬管理功能與獎銜自動審核名冊。',
    added: [
      '九宮格生命靈數圖：依西元生日自動試算先天數、生日數、星座數、天賦數與命數連線圖。',
      '鑽石級專屬功能：鑽石權限可進行會員名單快速搜尋與分中心瀏覽。',
      '公開審核動態通知：新註冊夥伴與晉升申請公開通知，提高組織透明度。'
    ],
    modified: [
      '會員中心資料編輯機制：每月最多限制修改 5 次並記錄異動歷史。',
      '音檔列表分級權限過濾器流暢度改善。'
    ],
    removed: [
      '移除未具備對應獎銜權限之音檔直接播放連結。'
    ]
  },
  {
    version: 'v1.8',
    date: '2026/09/20',
    summary: '多維權限分級體系建立、Workers AI 智慧審核與留言互動系統。',
    added: [
      '獎銜分級播放控制（鑽石、白金、一般會員、公開訪客）。',
      'Workers AI 智慧留言審核防護機制，自動攔截不當言論。',
      '播放進度精確記憶與跨裝置接續播放。'
    ],
    modified: [
      '迷你播放器與最大化播放介面無縫平滑切換。',
      '會員登入狀態與訪客隨機稱號識別機制。'
    ],
    removed: [
      '取消未驗證訪客直接上傳錄音檔功能。'
    ]
  }
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  isAdmin?: boolean;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isAdmin
}) => {
  const [changelogList, setChangelogList] = useState<VersionLog[]>(DEFAULT_CHANGELOG_DATA);
  const [selectedVersion, setSelectedVersion] = useState<string>('v2.6');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -120 : 120,
        behavior: 'smooth'
      });
    }
  };

  // Check if current user is Super Admin (yukidu@gmail.com or role === '超級管理員')
  const cleanEmail = currentUser?.email?.toLowerCase().trim();
  const isSuperAdmin =
    isAdmin ||
    cleanEmail === 'yukidu@gmail.com' ||
    cleanEmail === 'yukiduhm@gmail.com' ||
    currentUser?.role === '超級管理員' ||
    currentUser?.id === 'u-admin';

  // Fetch persisted changelog from server on mount
  useEffect(() => {
    async function loadChangelog() {
      try {
        const res = await fetch('/api/changelog');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setChangelogList(data);
            setSelectedVersion(data[0].version);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load changelog from server:', e);
      }
      setChangelogList(DEFAULT_CHANGELOG_DATA);
      setSelectedVersion(DEFAULT_CHANGELOG_DATA[0].version);
    }

    if (isOpen) {
      loadChangelog();
      setIsEditing(false);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentLog = changelogList.find(l => l.version === selectedVersion) || changelogList[0];

  // Helper to update field in current log
  const handleUpdateCurrentLog = (field: keyof VersionLog, value: any) => {
    setChangelogList(prev =>
      prev.map(l => (l.version === currentLog.version ? { ...l, [field]: value } : l))
    );
  };

  // Helper to update specific item in bullet array
  const handleUpdateItem = (type: 'added' | 'modified' | 'removed', idx: number, value: string) => {
    const list = [...(currentLog[type] || [])];
    list[idx] = value;
    handleUpdateCurrentLog(type, list);
  };

  // Helper to add new bullet
  const handleAddItem = (type: 'added' | 'modified' | 'removed') => {
    const list = [...(currentLog[type] || []), '新項目說明...'];
    handleUpdateCurrentLog(type, list);
  };

  // Helper to delete bullet
  const handleDeleteItem = (type: 'added' | 'modified' | 'removed', idx: number) => {
    const list = (currentLog[type] || []).filter((_, i) => i !== idx);
    handleUpdateCurrentLog(type, list);
  };

  // Save changes to backend
  const handleSaveChangelog = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/changelog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changelog: changelogList,
          userEmail: currentUser?.email || 'yukidu@gmail.com'
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('儲存改版紀錄失敗，請確認超級管理員身分。');
      }
    } catch (e) {
      console.error(e);
      alert('儲存失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    if (confirm('確定要還原為系統預設的改版歷程文字嗎？')) {
      setChangelogList(DEFAULT_CHANGELOG_DATA);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm">
              !
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">版本改版歷程紀錄</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/25 text-white font-mono font-bold">
                  當前版本 {changelogList[0]?.version || 'v2.6'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Super Admin Edit Toggle (Requirement 8 v2.4: 超級管理員手動編輯每一段落文字) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
                  isEditing
                    ? 'bg-amber-400 text-amber-950 ring-2 ring-white'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
                title={isEditing ? '切換回瀏覽模式' : '進入文字編輯模式 (超級管理員)'}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? '編輯中' : '編輯文字'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Super admin editor top action bar */}
        {isEditing && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>超級管理員段落編輯模式：點擊任何段落文字即可修改</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 hover:bg-amber-100 transition-colors cursor-pointer"
                title="還原為預設紀錄"
              >
                <RotateCcw className="w-3 h-3" />
                <span>還原預設</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveChangelog}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold flex items-center gap-1 hover:bg-rose-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{isSaving ? '儲存中...' : '儲存變更'}</span>
              </button>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border-b border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>改版歷程段落已成功儲存至後端資料庫！全站會員即刻同步看見更新。</span>
          </div>
        )}

        {/* Version Selector Tabs - Requirement 2: 不要顯示日期，顯示版本號即可；Requirement 3: 左右二側增加 < > 符號 */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 px-2 py-1.5 gap-1">
          <button
            type="button"
            onClick={() => handleScrollTabs('left')}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
            title="向左移動標籤"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={tabsContainerRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs px-0.5 scroll-smooth"
          >
            {changelogList.map(log => {
              const isSelected = selectedVersion === log.version;
              return (
                <button
                  key={log.version}
                  onClick={() => setSelectedVersion(log.version)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-rose-300'
                  }`}
                >
                  <span>{log.version}</span>
                  {log.isLatest && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected
                          ? 'bg-white text-rose-600'
                          : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      最新
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => handleScrollTabs('right')}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
            title="向右移動標籤"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Version Detail Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Summary Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50/80 via-white to-amber-50/80 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-slate-800/80 border border-rose-100 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{currentLog.version} 改版重點</span>
              </span>
              <div className="flex items-center gap-1.5">
                {isEditing ? (
                  <input
                    type="text"
                    value={currentLog.date}
                    onChange={e => handleUpdateCurrentLog('date', e.target.value)}
                    className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800"
                  />
                ) : (
                  <span className="text-slate-400 font-mono text-xs flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{currentLog.date} 發布</span>
                  </span>
                )}
              </div>
            </div>

            {isEditing ? (
              <textarea
                value={currentLog.summary}
                onChange={e => handleUpdateCurrentLog('summary', e.target.value)}
                rows={3}
                className="w-full p-2 rounded-xl border border-rose-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 outline-hidden leading-relaxed"
                placeholder="輸入改版重點摘要..."
              />
            ) : (
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                {currentLog.summary}
              </p>
            )}
          </div>

          {/* 🟢 增加功能 */}
          <div className="rounded-2xl p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
            <div className="flex items-center justify-between gap-1.5 text-emerald-700 dark:text-emerald-300 font-black text-xs">
              <div className="flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4" />
                <span>增加功能 ({currentLog.added?.length || 0})</span>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleAddItem('added')}
                  className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增項目</span>
                </button>
              )}
            </div>

            <ul className="space-y-1.5 pl-1">
              {(currentLog.added || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <textarea
                        value={item}
                        onChange={e => handleUpdateItem('added', idx, e.target.value)}
                        rows={2}
                        className="flex-1 p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem('added', idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="刪除此項目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span>{item}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 🟡 修改功能 */}
          <div className="rounded-2xl p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center justify-between gap-1.5 text-amber-700 dark:text-amber-300 font-black text-xs">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" />
                <span>修改功能 ({currentLog.modified?.length || 0})</span>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleAddItem('modified')}
                  className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 hover:bg-amber-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增項目</span>
                </button>
              )}
            </div>

            <ul className="space-y-1.5 pl-1">
              {(currentLog.modified || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <textarea
                        value={item}
                        onChange={e => handleUpdateItem('modified', idx, e.target.value)}
                        rows={2}
                        className="flex-1 p-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem('modified', idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="刪除此項目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span>{item}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 🔴 刪除功能 */}
          <div className="rounded-2xl p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-2">
            <div className="flex items-center justify-between gap-1.5 text-rose-700 dark:text-rose-300 font-black text-xs">
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                <span>刪除功能 ({currentLog.removed?.length || 0})</span>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleAddItem('removed')}
                  className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 hover:bg-rose-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增項目</span>
                </button>
              )}
            </div>

            <ul className="space-y-1.5 pl-1">
              {(currentLog.removed || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <textarea
                        value={item}
                        onChange={e => handleUpdateItem('removed', idx, e.target.value)}
                        rows={2}
                        className="flex-1 p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem('removed', idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="刪除此項目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span>{item}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Persistence Architecture Guarantee notice */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>資料庫持久存儲機制：後端 D1 / 本機 store.json 維護中，改版歷程編輯後立即持久寫入。</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0 ml-2">
              ● 已連線保護中
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>繁星的回聲 知識音檔平台 · 持續維護更新中</span>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveChangelog}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? '儲存中...' : '儲存變更'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
