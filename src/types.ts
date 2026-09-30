export const RESIDENCE_OPTIONS = [
  '臺北', '新北', '基隆', '桃園', '新竹', '苗栗', '臺中', '彰化', '南投', '雲林',
  '嘉義', '臺南', '高雄', '屏東', '宜蘭', '花蓮', '臺東', '澎湖', '金門', '連江', '海外'
] as const;

export const CENTER_OPTIONS = [
  '無', '非寰宇體系', '飛登', '南京', '自強', '明星', '民權', '中山', '桃園', '新竹', '台中',
  '彰化', '員林', '嘉義', '台南', '高雄', '屏東', '香港', '澳門', '中國', '美國',
  '澳洲', '加拿大', '英國', '義大利', '日本', '韓國', '馬來西亞', '泰國', '越南', '印尼'
] as const;

// 22 levels in exact order. Later index = higher permission!
export const RANK_ORDER = [
  '無',
  '3%',
  '6%',
  '9%',
  '12%',
  '12%初階',
  '15%',
  '15%銅章',
  '18%',
  '21%',
  '銀章',
  '金章',
  '白金',
  '紅寶石',
  '創辦人白金',
  '創辦人紅寶石',
  '藍寶石',
  '創辦人藍寶石',
  '明珠',
  '翡翠',
  '創辦人翡翠',
  '鑽石級以上'
] as const;

export type AmwayRank = typeof RANK_ORDER[number] | string;

export const JOIN_REASONS = [
  '尚未加入',
  '購買產品',
  '事業',
  '捧場人情',
  '商業餐會',
  '匹克球',
  '參加吃喝玩樂活動',
  '參加營養課',
  '參加美容課',
  '參加生涯規劃',
  '參加其它課程',
  '參加大會',
  '忘記了',
  '其他'
] as const;

export type JoinReason = typeof JOIN_REASONS[number];

// Requirement 1 (v2.2): 個人資料新欄位「什麼原因留在安麗？」
export const STAY_REASONS = [
  '商業餐會',
  '匹克球',
  '可以增加收入',
  '打造自己的事業與團隊',
  '課程活動多元豐富',
  '認識人脈',
  '學習健康',
  '助人',
  '擁有舞台',
  '熱愛產品好用',
  '喜歡分享好東西',
  '其它'
] as const;

export type StayReason = typeof STAY_REASONS[number];

export type CategoryType = '全部' | '事業' | '心態思維' | '營養' | '安麗產品' | '影集' | '未分類' | string;

export type SortField = '時間' | '評價' | '留言' | '按讚' | '演講人';
export type SortDirection = 'asc' | 'desc';
export type SortType = '最新上傳' | '評價最高' | '留言最多' | '按讚最多' | '演講者';

export interface UserListeningRecord {
  trackId: string;
  userIdOrDeviceId: string;
  firstListenDate: string; // 首次聆聽日期
  lastListenDate: string; // 最近一次聆聽日期
  finishDate?: string; // 聽完日期（進度>95%代表聽完）
  progressPercent: number; // 目前聆聽進度％
  clickCount: number; // 聆聽點擊次數
  comment?: string; // 顯示用戶給該音檔的留言
  rating?: number; // 用戶給該音檔的評價
  completed?: boolean;
  isDeleted?: boolean;
  trackTitle?: string;
  trackSpeaker?: string;
  trackSpeakerRank?: string;
  duration?: number;
}

export type UserRole = '超級管理員' | '獎銜審核員' | '管理員' | '寰宇家人' | '銅章' | '銀章' | '白金' | string;

export type PlayerDisplayMode = 'bubble' | 'bar' | 'expanded';

export interface ExternalLinkItem {
  name: string;
  url: string;
}

export interface Track {
  id: string;
  title: string;
  speaker: string;
  speakerRank: string;
  speakerAvatar: string;
  category?: string; // primary or fallback category
  categories: string[]; // up to 3 categories
  keywords?: string[]; // 網友關鍵字 (最多20個)
  rating: number;
  ratingCount: number;
  commentsCount: number;
  likes: number;
  playCount?: number;
  duration: string;
  durationSeconds: number;
  series: string;
  speechDate: string;
  requiredRank: AmwayRank; // Rank = reading permission
  permission?: string; // fallback string
  seriesOrder: string;
  uploadDate: string;
  description: string;
  audioUrl: string;
  uploaderId?: string; // for Contributor permission checking
  uploaderEmail?: string;
  externalVideos?: ExternalLinkItem[];
  externalPpts?: ExternalLinkItem[];
  externalFiles?: ExternalLinkItem[];
  likedBy: string[];
  ratings: Record<string, number>;
  // Requirement 7 (v2.2): 私秘 VIP 音檔專屬欄位
  isPrivateVip?: boolean;
  vipToken?: string;
  vipExpiresAt?: number | null;
  vipDurationDays?: number;
  tags?: string[];
  remarks?: string;
  uploadedBy?: string;
  uploaderName?: string;
}

export interface Comment {
  id: string;
  trackId: string;
  authorName: string;
  authorAvatar: string;
  authorBadge: string;
  authorRank?: string;
  authorEmail?: string;
  deviceId?: string;
  isAdmin: boolean;
  content: string;
  timestamp: string;
  createdAt: number;
  isAiModerated?: boolean;
  likes?: number;
  likedBy?: string[];
  replyToId?: string;
  replyToAuthor?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string; // 姓名或暱稱
  amwayId?: string; // 安麗編號
  phone?: string; // 手機
  residence?: string; // 居住地
  center?: string; // 寰宇中心
  rank: AmwayRank; // 最高獎銜 (also reading permission level)
  role?: UserRole; // 系統權限角色
  systemGroup?: string; // 體系
  joinReason?: JoinReason; // 初次如何認識安麗？(舊稱加入原因)
  stayReason?: StayReason | string; // 什麼原因留在安麗？(Requirement 1 v2.2)
  sponsor?: string; // 推薦人
  platinumUpline?: string; // 上手白金
  diamondUpline?: string; // 上手鑽石
  birthday?: string; // 西元生日 YYYY-MM-DD
  zodiac?: string; // 星座 (系統自動計算)
  zodiacSign?: string;
  talentNumber?: number; // 天賦數
  talentDigits?: number[];
  lifeNumber?: number; // 命數 (系統自動計算)
  avatar: string;
  isContributor?: boolean; // 貢獻者身分
  isAdminUser?: boolean; // 獎銜審核員身分 (可審核獎銜，具備鑽石瀏覽權限)
  approvedRank?: AmwayRank; // 審核通過之生效獎銜
  rankApproved?: boolean; // 獎銜是否審核通過 (通過前僅可聽公開音檔)
  rankAuditStatus?: 'pending' | 'approved'; // 待審核 / 已審核
  rankAuditType?: 'new_register' | 'rank_change'; // 新註冊會員 / 修改獎銜
  rankUpdatedAt?: string; // 註冊或獎銜修改時間
  registerDate?: string; // 註冊時間
  auditedBy?: string; // 審核人
  auditedAt?: string; // 審核時間
  canUpload?: boolean;
  avatarUploadCount?: number; // 每月已上傳次數 (上限 5 次)
  avatarUploadMonth?: string; // 當前月份 YYYY-MM
  profileEditCount?: number; // 每月修改基本資料次數 (上限 5 次)
  profileEditMonth?: string; // 當前月份 YYYY-MM
  playCount: number;
  isBlocked: boolean;
  lastActive: string;
}

export interface PlaybackState {
  trackId: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
}

export interface ThemePalette {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  lightPill: string;
  accentScrubber: string;
  gradientBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
}
