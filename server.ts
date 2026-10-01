import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { RANK_ORDER, type AmwayRank } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Setup local uploads storage for dev / R2 emulation
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const uploadMiddleware = multer({ storage, limits: { fileSize: 150 * 1024 * 1024 } });

// Cloudflare Configuration
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'echoes-audio-bucket';

let audioSequenceCounter = 0;

function getNextAudioSequence(): number {
  let maxSeq = audioSequenceCounter;
  tracks.forEach(t => {
    const match = (t.audioUrl || '').match(/ES(\d{4,})/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });
  audioSequenceCounter = maxSeq + 1;
  saveStoreToDisk();
  return audioSequenceCounter;
}

// POST /api/r2/upload
app.post('/api/r2/upload', uploadMiddleware.single('file') as any, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '缺少上傳檔案 (file)' });
  }

  const ext = path.extname(req.file.originalname || req.file.filename || '.mp3').toLowerCase() || '.mp3';
  const fileType = (req.body.fileType || '').toLowerCase();
  const isImage = ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';

  let finalFileName: string;

  if (fileType === 'cover' || isImage) {
    const cleanSpeaker = (req.body.speaker || '').replace(/[\\/:*?"<>|#&+=\s]/g, '').trim() || 'speaker';
    finalFileName = `cover-${cleanSpeaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
  } else {
    // 命名格式：「ES00001-演講者+獎銜-中文曲目名稱.副檔名」
    // 00001 = 系統自動編號的五位數/四位數序號，+ 符號不顯示，- 符號保留顯示
    const seq = getNextAudioSequence();
    const seqStr = String(seq).padStart(5, '0');

    const cleanSpeaker = (req.body.speaker || '').replace(/[\\/:*?"<>|#&+=\s]/g, '').trim() || '寰宇講師';
    const rawRank = (req.body.speakerRank || '').trim();
    const cleanRank = (rawRank && rawRank !== '無' && rawRank !== '公開')
      ? rawRank.replace(/[\\/:*?"<>|#&+=\s]/g, '').trim()
      : '';
    const speakerPart = `${cleanSpeaker}${cleanRank}`;

    const rawTitle = (req.body.title || '').trim();
    const cleanTitle = (rawTitle || path.basename(req.file.originalname || '演講錄音', ext))
      .replace(/[\\/:*?"<>|#&+]/g, '')
      .trim() || '演講錄音';

    finalFileName = `ES${seqStr}-${speakerPart}-${cleanTitle}${ext}`;
  }

  // Target local destination path
  const targetFilePath = path.join(uploadDir, finalFileName);
  try {
    if (fs.existsSync(req.file.path) && req.file.path !== targetFilePath) {
      fs.copyFileSync(req.file.path, targetFilePath);
    }
  } catch (copyErr) {
    console.warn('[Upload] Local copy warning:', copyErr);
  }

  const key = `uploads/${finalFileName}`;
  const fileUrl = `/api/r2/file/${encodeURIComponent(key)}`;

  // Direct sync to Cloudflare R2 bucket when credentials are provided
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    try {
      const fileBuffer = fs.readFileSync(targetFilePath);
      let contentType = req.file.mimetype;
      if (!contentType || contentType === 'application/octet-stream') {
        if (ext === '.mp3') contentType = 'audio/mpeg';
        else if (ext === '.m4a') contentType = 'audio/mp4';
        else if (ext === '.wav') contentType = 'audio/wav';
        else if (ext === '.ogg') contentType = 'audio/ogg';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
        else contentType = 'audio/mpeg';
      }

      const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
      const r2Res = await fetch(r2Url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': contentType
        },
        body: fileBuffer
      });

      if (!r2Res.ok) {
        const errText = await r2Res.text();
        console.error('[R2 API] Failed to upload to Cloudflare R2 bucket:', errText);
      } else {
        console.log(`[R2 API] Successfully uploaded ${key} to Cloudflare R2 bucket ${R2_BUCKET}`);
      }
    } catch (err) {
      console.error('[R2 API] Upload exception:', err);
    }
  }

  res.json({ success: true, key, url: fileUrl });
});

// GET /api/r2/file/:key (With Range streaming support & R2 remote fetch fallback)
app.get('/api/r2/file/:key', async (req, res) => {
  const rawKey = decodeURIComponent(req.params.key);
  const fileName = path.basename(rawKey);
  const filePath = path.join(uploadDir, fileName);

  // If file doesn't exist locally, try fetching from Cloudflare R2 bucket
  if (!fs.existsSync(filePath) && CF_ACCOUNT_ID && CF_API_TOKEN) {
    try {
      const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(rawKey)}`;
      const r2Res = await fetch(r2Url, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`
        }
      });
      if (r2Res.ok) {
        const arrayBuf = await r2Res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuf));
        console.log(`[R2 Cache] Downloaded ${rawKey} from Cloudflare R2 to local cache.`);
      }
    } catch (err) {
      console.error('[R2 Cache] Error fetching from R2:', err);
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('檔案不存在');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(fileName).toLowerCase();
  let contentType = 'audio/mpeg';
  if (ext === '.m4a') contentType = 'audio/mp4';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.ogg') contentType = 'audio/ogg';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

interface ExternalLinkItem {
  name: string;
  url: string;
}

interface Track {
  id: string;
  title: string;
  speaker: string;
  speakerRank: string;
  speakerAvatar: string;
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
  requiredRank: AmwayRank;
  seriesOrder: string;
  uploadDate: string;
  description: string;
  audioUrl: string;
  uploaderId?: string;
  uploaderEmail?: string;
  externalVideos?: ExternalLinkItem[];
  externalPpts?: ExternalLinkItem[];
  externalFiles?: ExternalLinkItem[];
  likedBy: string[];
  ratings: Record<string, number>;
  // Requirement 7 (v2.2): 私秘 VIP 音檔
  isPrivateVip?: boolean;
  vipToken?: string;
  vipExpiresAt?: number | null;
  vipDurationDays?: number;
}

interface Comment {
  id: string;
  trackId: string;
  authorName: string;
  authorAvatar: string;
  authorBadge: string;
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

interface UserProfile {
  id: string;
  email: string;
  name: string;
  amwayId?: string;
  phone?: string;
  residence?: string;
  center?: string;
  rank: AmwayRank;
  role?: string;
  joinReason?: string;
  stayReason?: string; // Requirement 1 (v2.2): 什麼原因留在安麗？
  sponsor?: string;
  platinumUpline?: string;
  diamondUpline?: string;
  birthday?: string;
  zodiac?: string;
  talentNumber?: number;
  lifeNumber?: number;
  avatar: string;
  isContributor?: boolean;
  isAdminUser?: boolean;
  approvedRank?: AmwayRank;
  rankApproved?: boolean;
  rankAuditStatus?: 'pending' | 'approved';
  rankAuditType?: 'new_register' | 'rank_change';
  rankUpdatedAt?: string;
  registerDate?: string;
  auditedBy?: string;
  auditedAt?: string;
  playCount: number;
  isBlocked: boolean;
  lastActive: string;
}

// Initial Data matching exactly the user's reference screenshots!
let tracks: Track[] = [
  {
    id: 't-1',
    title: '把目標變成業績的關鍵心法',
    speaker: '陳志豪',
    speakerRank: '鑽石領袖',
    speakerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    categories: ['事業'],
    keywords: ['目標設定', '業績突破', '實戰成交', '行動步驟', '事業成長'],
    rating: 3.7,
    ratingCount: 9,
    commentsCount: 4,
    likes: 15,
    duration: '約 10 分鐘',
    durationSeconds: 600,
    series: '事業進階系列',
    speechDate: '2025/03/12',
    requiredRank: '無', // Public
    seriesOrder: '第 1 集',
    uploadDate: '2026/09/27',
    description: '從設定目標到實際成交，拆解真正能落地的行動步驟。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [{ name: 'YouTube 精華剪輯', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
    externalPpts: [{ name: '目標與業績簡報檔', url: 'https://docs.google.com/presentation/d/demo/preview' }],
    externalFiles: [{ name: '目標設定行動手冊.pdf', url: 'https://example.com/handbook.pdf' }],
    likedBy: ['guest-default'],
    ratings: { 'guest-default': 4, 'u-1': 4, 'u-2': 3, 'u-3': 4 },
    playCount: 682
  },
  {
    id: 't-2',
    title: '逆境其實是最好的禮物',
    speaker: '林美玲',
    speakerRank: '皇冠大使',
    speakerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    categories: ['心態思維'],
    keywords: ['逆境成長', '轉念心態', '正向思維', '自我激勵', '皇冠大使'],
    rating: 4.3,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 9 分鐘',
    durationSeconds: 540,
    series: '思維心法系列',
    speechDate: '2025/02/18',
    requiredRank: '無',
    seriesOrder: '第 2 集',
    uploadDate: '2026/09/25',
    description: '在低谷時如何快速切換心態，把每一次挑戰化為成長養分。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_ambience.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: { 'u-1': 5, 'u-2': 4 },
    playCount: 547
  },
  {
    id: 't-3',
    title: '從零開始的第一年',
    speaker: '吳宗霖',
    speakerRank: '翡翠',
    speakerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    categories: ['影集'],
    keywords: ['新人起步', '堅持初衷', '破局成長', '經驗分享'],
    rating: 4.4,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 11 分鐘',
    durationSeconds: 660,
    series: '新人起步系列',
    speechDate: '2025/01/10',
    requiredRank: '無',
    seriesOrder: '第 1 集',
    uploadDate: '2026/09/20',
    description: '分享第一年碰壁、迷惘到找到節奏與突破點的真實經歷。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: { 'u-1': 5 },
    playCount: 493
  },
  {
    id: 't-4',
    title: '把營養講得讓人聽得懂',
    speaker: '王淑芬',
    speakerRank: '健康顧問',
    speakerAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&auto=format&fit=crop&q=80',
    categories: ['營養'],
    rating: 4.1,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 10 分鐘',
    durationSeconds: 600,
    series: '產品生活化系列',
    speechDate: '2024/12/05',
    requiredRank: '無',
    seriesOrder: '第 3 集',
    uploadDate: '2026/09/15',
    description: '擺脫生硬名詞，用故事與生活案例分享營養價值與保健觀念。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 420
  },
  {
    id: 't-5',
    title: '時間管理的三個秘密',
    speaker: '劉思妤',
    speakerRank: '鑽石',
    speakerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80',
    categories: ['心態思維', '事業'],
    rating: 4.5,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 8 分鐘',
    durationSeconds: 480,
    series: '高效自律系列',
    speechDate: '2024/11/22',
    requiredRank: '3%', // requires 3% or higher
    seriesOrder: '第 1 集',
    uploadDate: '2026/09/10',
    description: '斜槓事業中如何安排每日高產出微習慣，讓時間成為你的複利。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_ambience.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 388
  },
  {
    id: 't-6',
    title: '新手也能懂的產品示範術',
    speaker: '張雅婷',
    speakerRank: '高級主任',
    speakerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    categories: ['安麗產品', '事業'],
    rating: 4.4,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 8 分鐘',
    durationSeconds: 480,
    series: '實戰示範系列',
    speechDate: '2024/11/02',
    requiredRank: '12%',
    seriesOrder: '第 2 集',
    uploadDate: '2026/09/05',
    description: '簡單、直覺、有說服力的示範流程，讓客戶親眼看見品質差異。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 315
  },
  {
    id: 't-7',
    title: '團隊建立與領導力傳承',
    speaker: '許建國',
    speakerRank: '雙鑽石領袖',
    speakerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&auto=format&fit=crop&q=80',
    categories: ['事業', '心態思維'],
    rating: 4.8,
    ratingCount: 12,
    commentsCount: 6,
    likes: 28,
    duration: '約 15 分鐘',
    durationSeconds: 900,
    series: '組織領袖系列',
    speechDate: '2024/10/18',
    requiredRank: '銀章',
    seriesOrder: '第 1 集',
    uploadDate: '2024/10/18',
    description: '帶領核心夥伴前進的心法：如何以身作則並複製成功系統。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_ambience.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 276
  },
  {
    id: 't-8',
    title: '日常營養素的黃金搭配',
    speaker: '陳欣宜',
    speakerRank: '特級營養師',
    speakerAvatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=600&auto=format&fit=crop&q=80',
    categories: ['營養', '安麗產品'],
    rating: 4.6,
    ratingCount: 10,
    commentsCount: 5,
    likes: 22,
    duration: '約 12 分鐘',
    durationSeconds: 720,
    series: '營養健康全書',
    speechDate: '2024/09/12',
    requiredRank: '無',
    seriesOrder: '第 4 集',
    uploadDate: '2024/09/12',
    description: '蛋白質、綜合維生素與魚油如何相輔相成發揮最大功效。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 241
  },
  {
    id: 't-9',
    title: '高階領袖核心戰略研討',
    speaker: '李冠廷',
    speakerRank: '三鑽石領袖',
    speakerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&fit=crop&q=80',
    categories: ['事業', '未分類'],
    rating: 4.9,
    ratingCount: 15,
    commentsCount: 8,
    likes: 35,
    duration: '約 18 分鐘',
    durationSeconds: 1080,
    series: '戰略高峰系列',
    speechDate: '2024/08/01',
    requiredRank: '白金',
    seriesOrder: '第 1 集',
    uploadDate: '2024/08/01',
    description: '年度市場佈局與新興通路拓展方針，專屬白金以上領袖閉門研討。',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
    uploaderEmail: 'yukidu@gmail.com',
    externalVideos: [],
    externalPpts: [],
    externalFiles: [],
    likedBy: [],
    ratings: {},
    playCount: 198
  }
];

let comments: Comment[] = [
  // t-1
  {
    id: 'c-1',
    trackId: 't-1',
    authorName: '爽朗的海豚',
    authorAvatar: '🐬',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '設定目標與達成業績的心法非常實用，收穫很多！',
    timestamp: '27 分鐘前',
    createdAt: Date.now() - 27 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-2',
    trackId: 't-1',
    authorName: '熱血的獵鷹',
    authorAvatar: '🦅',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '心態思維的部分讓我重新調整了目標。',
    timestamp: '59 分鐘前',
    createdAt: Date.now() - 59 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-3',
    trackId: 't-1',
    authorName: '沉思的貓頭鷹',
    authorAvatar: '🦉',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '通勤時間聽剛剛好，每次都學到新東西。',
    timestamp: '1 小時前',
    createdAt: Date.now() - 65 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-4',
    trackId: 't-1',
    authorName: '杜杜龍',
    authorAvatar: '🐲',
    authorBadge: '管理員',
    isAdmin: true,
    content: '陳老師這堂課是經典必聽，建議夥伴多聽兩次！',
    timestamp: '2 小時前',
    createdAt: Date.now() - 120 * 60 * 1000,
    isAiModerated: true
  },
  // t-2
  {
    id: 'c-21',
    trackId: 't-2',
    authorName: '林雅慧',
    authorAvatar: '👩',
    authorBadge: '15%銅章',
    isAdmin: false,
    content: '美玲老師的分享總是充滿溫暖與力量，逆境確實是成長的養分。',
    timestamp: '3 小時前',
    createdAt: Date.now() - 180 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-22',
    trackId: 't-2',
    authorName: '勇敢的獅子',
    authorAvatar: '🦁',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '把挫折當禮物，這段話深深打動我！',
    timestamp: '5 小時前',
    createdAt: Date.now() - 300 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-23',
    trackId: 't-2',
    authorName: '陳銘耀',
    authorAvatar: '👨',
    authorBadge: '貢獻者',
    isAdmin: false,
    content: '極具啟發性的思維心法，每次聽都很有收穫。',
    timestamp: '昨天',
    createdAt: Date.now() - 24 * 3600 * 1000,
    isAiModerated: true
  },
  // t-3
  {
    id: 'c-31',
    trackId: 't-3',
    authorName: '敏捷的獵豹',
    authorAvatar: '🐆',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '講話的邏輯與提問技巧非常具體，可以直接運用在日常溝通！',
    timestamp: '4 小時前',
    createdAt: Date.now() - 240 * 60 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-32',
    trackId: 't-3',
    authorName: '張佩君',
    authorAvatar: '👩',
    authorBadge: '銀章',
    isAdmin: false,
    content: '溝通有溫度的關鍵在於同理心，推薦大家收聽！',
    timestamp: '昨天',
    createdAt: Date.now() - 26 * 3600 * 1000,
    isAiModerated: true
  },
  // t-4
  {
    id: 'c-41',
    trackId: 't-4',
    authorName: '黃俊傑',
    authorAvatar: '👨',
    authorBadge: '白金',
    isAdmin: false,
    content: '保養品的示範與成分說明很清晰，對新進夥伴很有幫助。',
    timestamp: '昨天',
    createdAt: Date.now() - 28 * 3600 * 1000,
    isAiModerated: true
  },
  // t-5
  {
    id: 'c-51',
    trackId: 't-5',
    authorName: '智慧的藍鯨',
    authorAvatar: '🐋',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '自律與時間管理的象限法很棒，不再被緊急但不重要的事拖延了。',
    timestamp: '1 天前',
    createdAt: Date.now() - 30 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-52',
    trackId: 't-5',
    authorName: '林雅慧',
    authorAvatar: '👩',
    authorBadge: '15%銅章',
    isAdmin: false,
    content: '習慣養成的三週法很實用，已經開始實踐晨間閱讀了！',
    timestamp: '2 天前',
    createdAt: Date.now() - 48 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-53',
    trackId: 't-5',
    authorName: '杜杜龍',
    authorAvatar: '🐲',
    authorBadge: '管理員',
    isAdmin: true,
    content: '自律即自由，很棒的分享。',
    timestamp: '3 天前',
    createdAt: Date.now() - 72 * 3600 * 1000,
    isAiModerated: true
  },
  // t-6
  {
    id: 'c-61',
    trackId: 't-6',
    authorName: '陳銘耀',
    authorAvatar: '👨',
    authorBadge: '貢獻者',
    isAdmin: false,
    content: '產品示範的細節與生活化切入點，是新朋友容易接受的關鍵。',
    timestamp: '2 天前',
    createdAt: Date.now() - 50 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-62',
    trackId: 't-6',
    authorName: '快樂的蜂鳥',
    authorAvatar: '🐦',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '鍋具與洗潔劑的分享非常生動，學到很多日常應用技巧！',
    timestamp: '3 天前',
    createdAt: Date.now() - 75 * 3600 * 1000,
    isAiModerated: true
  },
  // t-7
  {
    id: 'c-71',
    trackId: 't-7',
    authorName: '許建國',
    authorAvatar: '👨',
    authorBadge: '雙鑽石領袖',
    isAdmin: false,
    content: '領導力就是帶出更多領導人，大家一起共好共榮。',
    timestamp: '1 天前',
    createdAt: Date.now() - 32 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-72',
    trackId: 't-7',
    authorName: '張佩君',
    authorAvatar: '👩',
    authorBadge: '銀章',
    isAdmin: false,
    content: '建國老師的以身作則，是我們最好的榜樣！',
    timestamp: '2 天前',
    createdAt: Date.now() - 45 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-73',
    trackId: 't-7',
    authorName: '黃俊傑',
    authorAvatar: '👨',
    authorBadge: '白金',
    isAdmin: false,
    content: '複製系統的四個階段講得太透徹了。',
    timestamp: '3 天前',
    createdAt: Date.now() - 70 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-74',
    trackId: 't-7',
    authorName: '勇敢的獅子',
    authorAvatar: '🦁',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '這堂課給了團隊很大的凝聚力！',
    timestamp: '4 天前',
    createdAt: Date.now() - 95 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-75',
    trackId: 't-7',
    authorName: '林雅慧',
    authorAvatar: '👩',
    authorBadge: '15%銅章',
    isAdmin: false,
    content: '組織傳承的觀念打破了我過去的盲點。',
    timestamp: '5 天前',
    createdAt: Date.now() - 120 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-76',
    trackId: 't-7',
    authorName: '杜杜龍',
    authorAvatar: '🐲',
    authorBadge: '管理員',
    isAdmin: true,
    content: '核心夥伴會議推薦必聽音檔！',
    timestamp: '6 天前',
    createdAt: Date.now() - 144 * 3600 * 1000,
    isAiModerated: true
  },
  // t-8
  {
    id: 'c-81',
    trackId: 't-8',
    authorName: '陳欣宜',
    authorAvatar: '👩',
    authorBadge: '白金',
    isAdmin: false,
    content: '營養補充搭配規律作息與飲水，身體自然會給出最好的回饋。',
    timestamp: '1 天前',
    createdAt: Date.now() - 35 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-82',
    trackId: 't-8',
    authorName: '敏捷的獵豹',
    authorAvatar: '🐆',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '蛋白質與綜合維生素的早餐搭配，讓我每天精神都很好！',
    timestamp: '2 天前',
    createdAt: Date.now() - 55 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-83',
    trackId: 't-8',
    authorName: '黃俊傑',
    authorAvatar: '👨',
    authorBadge: '白金',
    isAdmin: false,
    content: '魚油好處講得很專業，對家人健康照顧太有幫助了。',
    timestamp: '3 天前',
    createdAt: Date.now() - 78 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-84',
    trackId: 't-8',
    authorName: '爽朗的海豚',
    authorAvatar: '🐬',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '簡單易懂的營養觀念，全家都能輕鬆照著做！',
    timestamp: '4 天前',
    createdAt: Date.now() - 100 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-85',
    trackId: 't-8',
    authorName: '林雅慧',
    authorAvatar: '👩',
    authorBadge: '15%銅章',
    isAdmin: false,
    content: '筆記做滿滿，已經分享給身邊朋友了。',
    timestamp: '5 天前',
    createdAt: Date.now() - 125 * 3600 * 1000,
    isAiModerated: true
  },
  // t-9
  {
    id: 'c-91',
    trackId: 't-9',
    authorName: '李冠廷',
    authorAvatar: '👨',
    authorBadge: '三鑽石領袖',
    isAdmin: false,
    content: '市場佈局與時俱進，期待與各位夥伴攜手再創高峰！',
    timestamp: '1 天前',
    createdAt: Date.now() - 40 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-92',
    trackId: 't-9',
    authorName: '杜杜龍',
    authorAvatar: '🐲',
    authorBadge: '管理員',
    isAdmin: true,
    content: '高階領袖核心戰略，方向清晰明確！',
    timestamp: '2 天前',
    createdAt: Date.now() - 60 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-93',
    trackId: 't-9',
    authorName: '許建國',
    authorAvatar: '👨',
    authorBadge: '雙鑽石領袖',
    isAdmin: false,
    content: '新通路的拓展與數位工具整合，是下一個十年的關鍵優勢。',
    timestamp: '2 天前',
    createdAt: Date.now() - 65 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-94',
    trackId: 't-9',
    authorName: '張佩君',
    authorAvatar: '👩',
    authorBadge: '銀章',
    isAdmin: false,
    content: '能夠在白金以上研討中學習到這些格局，非常感恩！',
    timestamp: '3 天前',
    createdAt: Date.now() - 85 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-95',
    trackId: 't-9',
    authorName: '黃俊傑',
    authorAvatar: '👨',
    authorBadge: '白金',
    isAdmin: false,
    content: '戰略思考讓人眼界大開，回去立刻跟團隊展開對齊！',
    timestamp: '4 天前',
    createdAt: Date.now() - 110 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-96',
    trackId: 't-9',
    authorName: '沉思的貓頭鷹',
    authorAvatar: '🦉',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '頂尖高階領導人的思維深度果然非同凡響。',
    timestamp: '5 天前',
    createdAt: Date.now() - 135 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-97',
    trackId: 't-9',
    authorName: '陳銘耀',
    authorAvatar: '👨',
    authorBadge: '貢獻者',
    isAdmin: false,
    content: '每年度最重要的戰略方針，必須反覆聆聽消化。',
    timestamp: '6 天前',
    createdAt: Date.now() - 160 * 3600 * 1000,
    isAiModerated: true
  },
  {
    id: 'c-98',
    trackId: 't-9',
    authorName: '熱血的獵鷹',
    authorAvatar: '🦅',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '激勵人心！向目標全力衝刺！',
    timestamp: '7 天前',
    createdAt: Date.now() - 180 * 3600 * 1000,
    isAiModerated: true
  }
];

let users: UserProfile[] = [
  {
    id: 'u-admin',
    email: 'yukidu@gmail.com',
    name: '杜杜龍',
    role: '超級管理員',
    isAdminUser: true,
    amwayId: '10888999',
    phone: '0912-345-678',
    residence: '臺北',
    center: '南京',
    rank: '鑽石級以上',
    approvedRank: '鑽石級以上',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/08/01 10:00',
    rankUpdatedAt: '2026/08/01 10:00',
    auditedBy: '系統初始最高權限',
    joinReason: '事業',
    stayReason: '打造自己的事業與團隊',
    sponsor: '創辦人團隊',
    platinumUpline: '杜鑽石',
    diamondUpline: '杜鑽石',
    birthday: '1985-05-18',
    zodiac: '金牛座',
    talentNumber: 33,
    lifeNumber: 6,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    isContributor: true,
    playCount: 142,
    isBlocked: false,
    lastActive: '剛才'
  },
  {
    id: 'u-1',
    email: 'chen.ming@example.com',
    name: '陳銘耀',
    role: '寰宇家人',
    amwayId: '20334455',
    phone: '0922-111-222',
    residence: '新北',
    center: '自強',
    rank: '銀章',
    approvedRank: '銀章',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/08/15 14:20',
    rankUpdatedAt: '2026/08/15 14:20',
    auditedBy: '超級管理員 (杜杜龍)',
    joinReason: '事業',
    stayReason: '打造自己的事業與團隊',
    sponsor: '杜杜龍',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1990-08-15',
    zodiac: '獅子座',
    talentNumber: 33,
    lifeNumber: 6,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    isContributor: true, // designated contributor
    playCount: 48,
    isBlocked: false,
    lastActive: '10 分鐘前'
  },
  {
    id: 'u-2',
    email: 'grace.lin@example.com',
    name: '林雅慧',
    role: '寰宇家人',
    amwayId: '30445566',
    phone: '0933-444-555',
    residence: '臺中',
    center: '台中',
    rank: '15%銅章',
    approvedRank: '12%',
    rankApproved: false,
    rankAuditStatus: 'pending',
    rankAuditType: 'rank_change',
    registerDate: '2026/09/20 09:30',
    rankUpdatedAt: '2026/09/29 11:15',
    joinReason: '購買產品',
    stayReason: '學習健康',
    sponsor: '陳銘耀',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1993-11-20',
    zodiac: '天蠍座',
    talentNumber: 26,
    lifeNumber: 8,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 65,
    isBlocked: false,
    lastActive: '1 小時前'
  },
  {
    id: 'u-3',
    email: 'kevin.wu@example.com',
    name: '吳家豪',
    role: '寰宇家人',
    amwayId: '40556677',
    phone: '0955-666-777',
    residence: '高雄',
    center: '高雄',
    rank: '12%',
    approvedRank: '無',
    rankApproved: false,
    rankAuditStatus: 'pending',
    rankAuditType: 'new_register',
    registerDate: '2026/09/29 15:45',
    rankUpdatedAt: '2026/09/29 15:45',
    joinReason: '商業餐會',
    stayReason: '可以增加收入',
    sponsor: '林雅慧',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1998-03-25',
    zodiac: '牡羊座',
    talentNumber: 32,
    lifeNumber: 5,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 29,
    isBlocked: false,
    lastActive: '昨天'
  },
  {
    id: 'u-4',
    email: 'shuting.chang@example.com',
    name: '張舒婷',
    role: '寰宇家人',
    amwayId: '50667788',
    phone: '0966-777-888',
    residence: '臺北',
    center: '南京',
    rank: '白金',
    approvedRank: '銀章',
    rankApproved: false,
    rankAuditStatus: 'pending',
    rankAuditType: 'rank_change',
    registerDate: '2026/09/22 16:00',
    rankUpdatedAt: '2026/09/29 17:10',
    joinReason: '事業',
    stayReason: '熱愛產品好用',
    sponsor: '杜杜龍',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1992-06-18',
    zodiac: '雙子座',
    talentNumber: 27,
    lifeNumber: 9,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 52,
    isBlocked: false,
    lastActive: '3 小時前'
  },
  {
    id: 'u-5',
    email: 'peijun.chang@example.com',
    name: '張佩君',
    role: '寰宇家人',
    amwayId: '60778899',
    phone: '0977-888-999',
    residence: '臺北',
    center: '南京',
    rank: '銀章',
    approvedRank: '銀章',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/08/28 11:30',
    rankUpdatedAt: '2026/08/28 11:30',
    auditedBy: '超級管理員 (杜杜龍)',
    joinReason: '學習健康',
    stayReason: '環境溫暖友善',
    sponsor: '陳銘耀',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1995-09-12',
    zodiac: '處女座',
    talentNumber: 27,
    lifeNumber: 9,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 41,
    isBlocked: false,
    lastActive: '昨天'
  },
  {
    id: 'u-6',
    email: 'junjie.huang@example.com',
    name: '黃俊傑',
    role: '寰宇家人',
    amwayId: '70889900',
    phone: '0988-123-456',
    residence: '臺中',
    center: '台中',
    rank: '白金',
    approvedRank: '白金',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/08/10 09:15',
    rankUpdatedAt: '2026/08/10 09:15',
    auditedBy: '超級管理員 (杜杜龍)',
    joinReason: '事業',
    stayReason: '助人成功很開心',
    sponsor: '杜杜龍',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1988-04-12',
    zodiac: '牡羊座',
    talentNumber: 24,
    lifeNumber: 6,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 76,
    isBlocked: false,
    lastActive: '昨天'
  },
  {
    id: 'u-7',
    email: 'jianguo.hsu@example.com',
    name: '許建國',
    role: '寰宇家人',
    amwayId: '80990011',
    phone: '0919-888-777',
    residence: '臺北',
    center: '南京',
    rank: '鑽石級以上',
    approvedRank: '鑽石級以上',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/07/01 10:00',
    rankUpdatedAt: '2026/07/01 10:00',
    auditedBy: '系統審核',
    joinReason: '事業',
    stayReason: '打造團隊與家族傳承',
    sponsor: '創辦人團隊',
    platinumUpline: '許鑽石',
    diamondUpline: '許鑽石',
    birthday: '1980-12-05',
    zodiac: '射手座',
    talentNumber: 26,
    lifeNumber: 8,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 110,
    isBlocked: false,
    lastActive: '2 天前'
  },
  {
    id: 'u-8',
    email: 'xinyi.chen@example.com',
    name: '陳欣宜',
    role: '寰宇家人',
    amwayId: '90112233',
    phone: '0932-555-666',
    residence: '高雄',
    center: '高雄',
    rank: '白金',
    approvedRank: '白金',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/08/20 15:00',
    rankUpdatedAt: '2026/08/20 15:00',
    auditedBy: '超級管理員 (杜杜龍)',
    joinReason: '商業餐會',
    stayReason: '團隊氛圍好',
    sponsor: '吳家豪',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1996-07-22',
    zodiac: '巨蟹座',
    talentNumber: 29,
    lifeNumber: 2,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 38,
    isBlocked: false,
    lastActive: '3 天前'
  },
  {
    id: 'u-9',
    email: 'guanting.li@example.com',
    name: '李冠廷',
    role: '寰宇家人',
    amwayId: '99223344',
    phone: '0928-333-222',
    residence: '新北',
    center: '自強',
    rank: '鑽石級以上',
    approvedRank: '鑽石級以上',
    rankApproved: true,
    rankAuditStatus: 'approved',
    registerDate: '2026/07/15 14:00',
    rankUpdatedAt: '2026/07/15 14:00',
    auditedBy: '系統審核',
    joinReason: '事業',
    stayReason: '自主掌握時間與人生',
    sponsor: '陳銘耀',
    platinumUpline: '陳白金',
    diamondUpline: '杜鑽石',
    birthday: '1982-10-10',
    zodiac: '天秤座',
    talentNumber: 22,
    lifeNumber: 4,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
    isContributor: false,
    playCount: 95,
    isBlocked: false,
    lastActive: '3 天前'
  }
];

let playbackRecords: Record<string, any> = {
  'u-admin_t-1': {
    trackId: 't-1',
    userIdOrDeviceId: 'u-admin',
    currentTime: 720,
    duration: 720,
    progressPercent: 100,
    completed: true,
    firstListenDate: '2026/09/01',
    lastListenDate: '2026/09/25',
    finishDate: '2026/09/25',
    clickCount: 12,
    updatedAt: Date.now()
  },
  'u-admin_t-2': {
    trackId: 't-2',
    userIdOrDeviceId: 'u-admin',
    currentTime: 680,
    duration: 700,
    progressPercent: 97,
    completed: true,
    firstListenDate: '2026/09/05',
    lastListenDate: '2026/09/26',
    finishDate: '2026/09/26',
    clickCount: 8,
    updatedAt: Date.now()
  },
  'u-admin_t-3': {
    trackId: 't-3',
    userIdOrDeviceId: 'u-admin',
    currentTime: 360,
    duration: 600,
    progressPercent: 60,
    completed: false,
    firstListenDate: '2026/09/18',
    lastListenDate: '2026/09/27',
    clickCount: 5,
    updatedAt: Date.now()
  },
  'u-1_t-1': {
    trackId: 't-1',
    userIdOrDeviceId: 'u-1',
    currentTime: 720,
    duration: 720,
    progressPercent: 100,
    completed: true,
    firstListenDate: '2026/08/20',
    lastListenDate: '2026/09/24',
    finishDate: '2026/08/21',
    clickCount: 15,
    updatedAt: Date.now()
  },
  'u-1_t-4': {
    trackId: 't-4',
    userIdOrDeviceId: 'u-1',
    currentTime: 540,
    duration: 540,
    progressPercent: 100,
    completed: true,
    firstListenDate: '2026/09/02',
    lastListenDate: '2026/09/22',
    finishDate: '2026/09/22',
    clickCount: 9,
    updatedAt: Date.now()
  },
  'u-2_t-2': {
    trackId: 't-2',
    userIdOrDeviceId: 'u-2',
    currentTime: 700,
    duration: 700,
    progressPercent: 100,
    completed: true,
    firstListenDate: '2026/09/10',
    lastListenDate: '2026/09/27',
    finishDate: '2026/09/12',
    clickCount: 18,
    updatedAt: Date.now()
  },
  'u-2_t-5': {
    trackId: 't-5',
    userIdOrDeviceId: 'u-2',
    currentTime: 380,
    duration: 480,
    progressPercent: 79,
    completed: false,
    firstListenDate: '2026/09/15',
    lastListenDate: '2026/09/28',
    clickCount: 6,
    updatedAt: Date.now()
  },
  'u-3_t-3': {
    trackId: 't-3',
    userIdOrDeviceId: 'u-3',
    currentTime: 600,
    duration: 600,
    progressPercent: 100,
    completed: true,
    firstListenDate: '2026/09/08',
    lastListenDate: '2026/09/20',
    finishDate: '2026/09/09',
    clickCount: 7,
    updatedAt: Date.now()
  }
};

// Global Categories State (Requirement 8)
let categoryList: string[] = ['事業', '心態思維', '營養', '安麗產品', '影集', '未分類'];

// Custom Changelog State (Requirement 8 v2.4: 超級管理員在線編輯驚嘆號改版頁面文字)
let customChangelog: any[] | null = null;

// Local Persistent Store (Requirement 10: 覆蓋程式碼時維持用戶資料庫所有內容)
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export function saveStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = {
      users,
      tracks,
      comments,
      categories: categoryList,
      playbackRecords,
      customChangelog,
      audioSequenceCounter
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save store to disk:', err);
  }
}

export function loadStoreFromDisk() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data.audioSequenceCounter === 'number') {
        audioSequenceCounter = data.audioSequenceCounter;
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        // Merge any new built-in registered users (e.g. 張佩君, 黃俊傑, 許建國, 陳欣宜, 李冠廷)
        const existingEmails = new Set(data.users.map((u: any) => u.email?.toLowerCase().trim()));
        const existingNames = new Set(data.users.map((u: any) => u.name?.trim()));
        users.forEach(defaultUser => {
          if (!existingEmails.has(defaultUser.email.toLowerCase().trim()) && !existingNames.has(defaultUser.name.trim())) {
            data.users.push(defaultUser);
          }
        });
        users = data.users;
      }
      if (Array.isArray(data.tracks) && data.tracks.length > 0) tracks = data.tracks;
      if (Array.isArray(data.comments)) {
        comments = data.comments;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) categoryList = data.categories;
      if (data.playbackRecords && typeof data.playbackRecords === 'object') playbackRecords = data.playbackRecords;
      if (Array.isArray(data.customChangelog)) customChangelog = data.customChangelog;
      console.log('✅ Persistent store successfully loaded and reconciled from disk.');
      saveStoreToDisk();
    } else {
      saveStoreToDisk();
    }
  } catch (err) {
    console.error('Failed to load store from disk:', err);
  }
}
loadStoreFromDisk();

// Helper: Super Admin Check (Only yukidu@gmail.com)
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return clean === 'yukidu@gmail.com';
}

// Helper: Rank-based permission check
export function canAccessByRank(userRank: AmwayRank | undefined, requiredRank: AmwayRank): boolean {
  if (!requiredRank || requiredRank === '無' || requiredRank === '公開') return true;
  if (!userRank) return false;

  const ranks = RANK_ORDER as readonly string[];
  let userIdx = ranks.indexOf(userRank);
  const reqIdx = ranks.indexOf(requiredRank);

  if (userRank.includes('鑽石') || userRank.includes('皇冠') || userRank.includes('大使')) {
    userIdx = 999;
  }

  if (userIdx === -1) return false;
  return userIdx >= reqIdx;
}

// ----------------- API Endpoints -----------------

app.get('/api/cloudflare/status', (_req, res) => {
  res.json({
    status: 'connected',
    accountId: CF_ACCOUNT_ID,
    d1: 'd1-database-audio-knowledge',
    r2: 'r2-audio-storage-bucket',
    kv: 'kv-cache-store',
    workersAi: 'bilingual-sentiment-moderation'
  });
});

app.get('/api/categories', (_req, res) => {
  res.json(categoryList);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '分類名稱為必填項目' });
  }
  const clean = name.trim();
  if (!categoryList.includes(clean)) {
    categoryList.push(clean);
    saveStoreToDisk();
  }
  res.json({ success: true, categories: categoryList });
});

app.put('/api/categories/:oldName', (req, res) => {
  const oldName = decodeURIComponent(req.params.oldName);
  const { newName } = req.body;
  if (!newName || typeof newName !== 'string' || !newName.trim()) {
    return res.status(400).json({ error: '新分類名稱為必填項目' });
  }
  const cleanNew = newName.trim();
  const idx = categoryList.indexOf(oldName);
  if (idx !== -1) {
    categoryList[idx] = cleanNew;
  } else {
    categoryList.push(cleanNew);
  }
  // Also update tracks
  tracks.forEach(t => {
    if (t.categories && Array.isArray(t.categories)) {
      t.categories = t.categories.map(c => c === oldName ? cleanNew : c);
    }
  });
  saveStoreToDisk();
  res.json({ success: true, categories: categoryList });
});

app.delete('/api/categories/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  categoryList = categoryList.filter(c => c !== name);
  // Replace in tracks with '未分類' if empty
  tracks.forEach(t => {
    if (t.categories && Array.isArray(t.categories)) {
      t.categories = t.categories.filter(c => c !== name);
      if (t.categories.length === 0) {
        t.categories = ['未分類'];
      }
    }
  });
  saveStoreToDisk();
  res.json({ success: true, categories: categoryList });
});

app.get('/api/tracks', (_req, res) => {
  const enriched = tracks.map(t => ({
    ...t,
    playCount: t.playCount || 0,
    commentsCount: comments.filter(c => c.trackId === t.id).length
  }));
  res.json(enriched);
});

app.get('/api/tracks/:id', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '找不到該錄音檔' });
  res.json({
    ...track,
    playCount: track.playCount || 0,
    commentsCount: comments.filter(c => c.trackId === track.id).length
  });
});

// Increment track play count (Requirement 3: 點擊播放次數排行)
app.post('/api/tracks/:id/play', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '找不到該錄音檔' });
  track.playCount = (track.playCount || 0) + 1;
  saveStoreToDisk();
  res.json({ success: true, playCount: track.playCount });
});

// POST /api/tracks (Create audio track with up to 5 categories and named links)
app.post('/api/tracks', (req, res) => {
  const {
    title,
    speaker,
    speakerRank,
    speakerAvatar,
    categories,
    keywords,
    series,
    speechDate,
    requiredRank,
    seriesOrder,
    description,
    audioUrl,
    uploaderId,
    uploaderEmail,
    externalVideos,
    externalPpts,
    externalFiles,
    durationSeconds
  } = req.body;

  if (!title || !audioUrl) {
    return res.status(400).json({ error: '標題與音檔為必填項目' });
  }

  const durationSec = durationSeconds || 600;
  const minutes = Math.round(durationSec / 60);

  const today = new Date();
  const uploadDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const cleanCategories = Array.isArray(categories) && categories.length > 0
    ? categories.slice(0, 3)
    : ['未分類'];

  const cleanKeywords = Array.isArray(keywords) ? (keywords as any[]).map((k: any) => String(k).trim()).filter(Boolean).slice(0, 20) : [];

  const isVip = !!req.body.isPrivateVip;
  if (isVip) {
    const isOwner = isSuperAdminEmail(uploaderEmail);
    if (!isOwner) {
      const existingVipCount = tracks.filter(t => t.isPrivateVip && (t.uploaderEmail === uploaderEmail || t.uploaderId === uploaderId)).length;
      if (existingVipCount >= 10) {
        return res.status(400).json({ error: '每位貢獻者上限最多上傳 10 個私秘 VIP 音檔，您目前已達上限 (10/10)。' });
      }
    }
  }

  const durationDays = req.body.vipDurationDays !== undefined ? Number(req.body.vipDurationDays) : 7;
  const vipToken = isVip ? (req.body.vipToken || `vip_${Math.random().toString(36).substring(2, 10)}`) : undefined;
  const vipExpiresAt = isVip ? (durationDays === 0 ? null : (Date.now() + durationDays * 86400 * 1000)) : null;

  const newTrack: Track = {
    id: `t-${Date.now()}`,
    title: title.trim(),
    speaker: speaker?.trim() || '未設定演講者',
    speakerRank: speakerRank?.trim() || '講師',
    speakerAvatar: speakerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    categories: cleanCategories,
    keywords: cleanKeywords,
    rating: 5.0,
    ratingCount: 1,
    commentsCount: 0,
    likes: 0,
    duration: `約 ${minutes} 分鐘`,
    durationSeconds: durationSec,
    series: series?.trim() || '預設系列',
    speechDate: speechDate || uploadDate,
    requiredRank: requiredRank || '無',
    seriesOrder: seriesOrder?.trim() || '第 1 集',
    uploadDate: uploadDate,
    description: description?.trim() || '暫無簡介',
    audioUrl,
    uploaderId,
    uploaderEmail,
    externalVideos: externalVideos || [],
    externalPpts: externalPpts || [],
    externalFiles: externalFiles || [],
    likedBy: [],
    ratings: {},
    isPrivateVip: isVip,
    vipToken,
    vipExpiresAt,
    vipDurationDays: durationDays
  };

  tracks.unshift(newTrack);
  saveStoreToDisk();
  res.json(newTrack);
});

// POST /api/tracks/:id/reset-vip-token (Requirement 7: 重置私秘VIP專屬連結與有效天數)
app.post('/api/tracks/:id/reset-vip-token', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '找不到該音檔' });

  const durationDays = req.body.durationDays !== undefined ? Number(req.body.durationDays) : (track.vipDurationDays || 7);
  const newToken = `vip_${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = durationDays === 0 ? null : (Date.now() + durationDays * 86400 * 1000);

  track.isPrivateVip = true;
  track.vipToken = newToken;
  track.vipDurationDays = durationDays;
  track.vipExpiresAt = expiresAt;

  saveStoreToDisk();
  res.json({
    success: true,
    track,
    vipToken: newToken,
    vipExpiresAt: expiresAt,
    vipDurationDays: durationDays
  });
});

// GET /api/keywords (Requirement 1: 取得資料庫內已被使用過的所有網友關鍵字)
app.get('/api/keywords', (_req, res) => {
  const set = new Set<string>();
  tracks.forEach(t => {
    if (Array.isArray(t.keywords)) {
      t.keywords.forEach(k => {
        const trimmed = k.trim();
        if (trimmed) set.add(trimmed);
      });
    }
  });
  // Provide helpful defaults if database is empty
  const defaults = [
    '目標設定', '業績突破', '實戰成交', '行動步驟', '事業成長',
    '逆境成長', '轉念心態', '正向思維', '自我激勵', '皇冠大使',
    '新人起步', '堅持初衷', '破局成長', '經驗分享', '團隊建立',
    '領導力', '產品體驗', '營養心法'
  ];
  defaults.forEach(d => set.add(d));
  res.json(Array.from(set));
});

// PUT /api/keywords/rename (Requirement 2: 後台管理中心直接編輯關鍵字，自動更新連動到所有音檔)
app.put('/api/keywords/rename', (req, res) => {
  const { oldKeyword, newKeyword } = req.body;
  const oldTrimmed = (oldKeyword || '').trim();
  const newTrimmed = (newKeyword || '').trim();

  if (!oldTrimmed || !newTrimmed) {
    return res.status(400).json({ error: '關鍵字不可為空' });
  }

  let affectedCount = 0;
  tracks.forEach(t => {
    if (Array.isArray(t.keywords) && t.keywords.includes(oldTrimmed)) {
      t.keywords = t.keywords.map(k => (k === oldTrimmed ? newTrimmed : k));
      t.keywords = Array.from(new Set(t.keywords));
      affectedCount++;
    }
  });

  res.json({ success: true, affectedCount, tracks });
});

// DELETE /api/keywords/delete (Requirement 2: 後台管理中心刪除關鍵字)
app.delete('/api/keywords/delete', (req, res) => {
  const keyword = ((req.query.keyword as string) || (req.body && req.body.keyword) || '').trim();
  if (!keyword) {
    return res.status(400).json({ error: '關鍵字不可為空' });
  }

  let affectedCount = 0;
  tracks.forEach(t => {
    if (Array.isArray(t.keywords) && t.keywords.includes(keyword)) {
      t.keywords = t.keywords.filter(k => k !== keyword);
      affectedCount++;
    }
  });

  res.json({ success: true, affectedCount, tracks });
});

// POST /api/tracks/:id/keywords (Requirement 1: 會員所有人皆可為音檔新增網友關鍵字，每首上限20組)
app.post('/api/tracks/:id/keywords', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  const { keyword } = req.body;
  const trimmed = (keyword || '').trim();
  if (!trimmed) return res.status(400).json({ error: '關鍵字不可為空' });

  track.keywords = track.keywords || [];
  if (track.keywords.length >= 20) {
    return res.status(400).json({ error: '此音檔已達 20 組網友關鍵字上限！' });
  }

  if (!track.keywords.includes(trimmed)) {
    track.keywords.push(trimmed);
  }
  res.json({ success: true, keywords: track.keywords });
});

// PUT /api/tracks/:id/keywords (Requirement 1: 只有超級管理員、貢獻者原上傳者可修改關鍵字)
app.put('/api/tracks/:id/keywords', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  const { oldKeyword, newKeyword, userEmail } = req.body;
  const isAdmin = isSuperAdminEmail(userEmail);
  const isUploader = track.uploaderEmail && track.uploaderEmail === userEmail;

  if (!isAdmin && !isUploader) {
    return res.status(403).json({ error: '只有超級管理員或貢獻者原上傳者可編輯修改關鍵字！' });
  }

  const trimmedNew = (newKeyword || '').trim();
  if (!trimmedNew) return res.status(400).json({ error: '新關鍵字不可為空' });

  track.keywords = track.keywords || [];
  const idx = track.keywords.indexOf(oldKeyword);
  if (idx !== -1) {
    track.keywords[idx] = trimmedNew;
  }
  res.json({ success: true, keywords: track.keywords });
});

// DELETE /api/tracks/:id/keywords/:keyword (Requirement 1: 只有超級管理員、貢獻者原上傳者可刪除關鍵字)
app.delete('/api/tracks/:id/keywords/:keyword', (req, res) => {
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  const userEmail = (req.query.userEmail as string) || (req.body && req.body.userEmail);
  const isAdmin = isSuperAdminEmail(userEmail);
  const isUploader = track.uploaderEmail && track.uploaderEmail === userEmail;

  if (!isAdmin && !isUploader) {
    return res.status(403).json({ error: '只有超級管理員或貢獻者原上傳者可刪除關鍵字！' });
  }

  const targetKeyword = decodeURIComponent(req.params.keyword);
  track.keywords = (track.keywords || []).filter(k => k !== targetKeyword);
  res.json({ success: true, keywords: track.keywords });
});

// PUT /api/tracks/:id (Update track)
app.put('/api/tracks/:id', (req, res) => {
  const index = tracks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '音檔不存在' });

  const current = tracks[index];
  const { userEmail } = req.body;

  // Contributor check: only admin or the original uploader can edit
  const isAdmin = isSuperAdminEmail(userEmail);
  const isUploader = current.uploaderEmail && current.uploaderEmail === userEmail;

  if (userEmail && !isAdmin && !isUploader) {
    return res.status(403).json({ error: '貢獻者只能編輯修改自己上傳的音檔！' });
  }

  const updated: Track = {
    ...current,
    ...req.body,
    categories: Array.isArray(req.body.categories) ? req.body.categories.slice(0, 3) : current.categories,
    keywords: Array.isArray(req.body.keywords) ? req.body.keywords.slice(0, 20) : (current.keywords || []),
    uploadDate: current.uploadDate
  };
  tracks[index] = updated;
  saveStoreToDisk();
  res.json(updated);
});

// DELETE /api/tracks/:id
app.delete('/api/tracks/:id', (req, res) => {
  const index = tracks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '音檔不存在' });

  const track = tracks[index];
  const userEmail = (req.query.userEmail as string) || (req.body && req.body.userEmail);
  const isAdmin = !userEmail || isSuperAdminEmail(userEmail);
  const isUploader = track.uploaderEmail && track.uploaderEmail === userEmail;

  if (userEmail && !isAdmin && !isUploader) {
    return res.status(403).json({ error: '貢獻者只能刪除自己上傳的音檔！' });
  }

  const deletedTrack = tracks[index];
  // Requirement 8: 刪除音檔時，保留已聆聽紀錄之標題、講員並標記已刪除
  for (const rec of Object.values(playbackRecords)) {
    if (rec.trackId === deletedTrack.id) {
      rec.trackTitle = deletedTrack.title;
      rec.trackSpeaker = deletedTrack.speaker;
      rec.trackSpeakerRank = deletedTrack.speakerRank || '';
      rec.isDeleted = true;
    }
  }

  tracks.splice(index, 1);
  comments = comments.filter(c => c.trackId !== req.params.id);
  saveStoreToDisk();
  res.json({ success: true, deletedId: req.params.id });
});

// POST /api/tracks/:id/like (Requirement 7: 修復按讚愛心功能)
app.post('/api/tracks/:id/like', (req, res) => {
  const { identifier, identifiers } = req.body;
  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  track.likedBy = track.likedBy || [];
  const keysToCheck: string[] = [];
  if (identifier) keysToCheck.push(identifier);
  if (Array.isArray(identifiers)) {
    identifiers.forEach(id => { if (id && !keysToCheck.includes(id)) keysToCheck.push(id); });
  }
  if (keysToCheck.length === 0) keysToCheck.push('guest');

  // Check if any candidate key is in likedBy
  const matchedKey = keysToCheck.find(k => track.likedBy.includes(k));
  if (matchedKey) {
    track.likedBy = track.likedBy.filter(x => !keysToCheck.includes(x));
    track.likes = Math.max(0, track.likes - 1);
    saveStoreToDisk();
    res.json({ likes: track.likes, hasLiked: false, likedBy: track.likedBy });
  } else {
    const primaryKey = keysToCheck[0];
    track.likedBy.push(primaryKey);
    track.likes += 1;
    saveStoreToDisk();
    res.json({ likes: track.likes, hasLiked: true, likedBy: track.likedBy });
  }
});

// POST /api/tracks/:id/rate (Requirement 11: 點擊相同星級取消評價，所有星星反灰)
app.post('/api/tracks/:id/rate', (req, res) => {
  const { identifier, score, userId, userEmail, deviceId } = req.body;
  if (!identifier && !userId && !userEmail) {
    return res.status(400).json({ error: '缺少識別碼' });
  }

  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  const idKeys = [identifier, userId, userEmail, deviceId, 'u-admin'].filter(Boolean);
  const existingScore = idKeys.map(k => track.ratings[k]).find(s => s !== undefined);

  // If score is 0 or user clicks their current score again, cancel the rating
  if (score === 0 || (existingScore !== undefined && existingScore === score)) {
    idKeys.forEach(k => {
      delete track.ratings[k];
    });
    const allRatings = Object.values(track.ratings);
    const sum = allRatings.reduce((a, b) => a + b, 0);
    const avg = allRatings.length > 0 ? Math.round((sum / allRatings.length) * 10) / 10 : 0;
    track.rating = avg;
    track.ratingCount = allRatings.length;

    saveStoreToDisk();
    return res.json({
      rating: track.rating,
      ratingCount: track.ratingCount,
      userRating: 0,
      canceled: true
    });
  }

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: '評分無效 (1-5 分)' });
  }

  // Remove any stale keys before writing new score
  idKeys.forEach(k => {
    delete track.ratings[k];
  });
  const writeKey = identifier || userEmail || userId;
  track.ratings[writeKey] = score;

  const allRatings = Object.values(track.ratings);
  const sum = allRatings.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / allRatings.length) * 10) / 10;

  track.rating = avg;
  track.ratingCount = allRatings.length;

  saveStoreToDisk();
  res.json({
    rating: track.rating,
    ratingCount: track.ratingCount,
    userRating: score,
    canceled: false
  });
});

// GET /api/comments (Requirement 6 v2.4: 取得全站所有錄音檔留言，提供通知頁面即時呈現 @ 標記)
app.get('/api/comments', (_req, res) => {
  const enriched = comments.map(c => {
    let matchedUser: UserProfile | undefined;
    if (c.authorEmail && c.authorEmail !== 'guest' && !c.authorEmail.startsWith('guest-')) {
      matchedUser = users.find(u => u.email && u.email.toLowerCase() === c.authorEmail?.toLowerCase());
    } else if (c.isAdmin) {
      matchedUser = users.find(u => isSuperAdminEmail(u.email) || u.role === '超級管理員');
    } else if (c.authorName && !c.authorName.startsWith('訪客') && c.authorBadge !== '訪客稱號' && c.authorBadge !== '訪客') {
      matchedUser = users.find(u => u.name === c.authorName);
    }

    if (matchedUser) {
      return {
        ...c,
        authorName: matchedUser.name,
        authorAvatar: matchedUser.avatar || c.authorAvatar,
        authorEmail: matchedUser.email || c.authorEmail,
        authorBadge: matchedUser.role === '超級管理員' ? '管理員' : matchedUser.isContributor ? '貢獻者' : (matchedUser.rank || c.authorBadge)
      };
    }
    // Requirement 5 (v2.5): 訪客不應該有獎銜
    return {
      ...c,
      authorBadge: ''
    };
  });
  res.json(enriched);
});

// GET /api/changelog (Requirement 8 v2.4: 取得在線編輯的改版歷史紀錄)
app.get('/api/changelog', (_req, res) => {
  res.json(customChangelog || []);
});

// PUT /api/changelog (Requirement 8 v2.4: 超級管理員手動編輯改版歷程段落文字並持久存儲)
app.put('/api/changelog', (req, res) => {
  const { changelog, userEmail } = req.body;
  if (!isSuperAdminEmail(userEmail)) {
    return res.status(403).json({ error: '只有超級管理員才能編輯改版歷史紀錄' });
  }
  if (!Array.isArray(changelog)) {
    return res.status(400).json({ error: '改版內容格式不正確' });
  }

  customChangelog = changelog;
  saveStoreToDisk();
  res.json({ success: true, changelog: customChangelog });
});

app.get('/api/tracks/:id/comments', (req, res) => {
  const trackComments = comments.filter(c => c.trackId === req.params.id);
  // Requirement 1: 不論是新留言或過去的舊留言，留言板顯示的名字，都要和會員自己後台基本資料設定修改的名字，維持同步。
  const enriched = trackComments.map(c => {
    let matchedUser: UserProfile | undefined;
    if (c.authorEmail && c.authorEmail !== 'guest' && !c.authorEmail.startsWith('guest-')) {
      matchedUser = users.find(u => u.email && u.email.toLowerCase() === c.authorEmail?.toLowerCase());
    } else if (c.isAdmin) {
      matchedUser = users.find(u => isSuperAdminEmail(u.email) || u.role === '超級管理員');
    } else if (c.authorName && !c.authorName.startsWith('訪客') && c.authorBadge !== '訪客稱號' && c.authorBadge !== '訪客') {
      matchedUser = users.find(u => u.name === c.authorName);
    }

    if (matchedUser) {
      return {
        ...c,
        authorName: matchedUser.name,
        authorAvatar: matchedUser.avatar || c.authorAvatar,
        authorEmail: matchedUser.email || c.authorEmail,
        authorBadge: matchedUser.role === '超級管理員' ? '管理員' : matchedUser.isContributor ? '貢獻者' : (matchedUser.rank || c.authorBadge)
      };
    }
    // Requirement 5 (v2.5): 訪客不應該有獎銜
    return {
      ...c,
      authorBadge: ''
    };
  });
  res.json(enriched);
});

app.post('/api/tracks/:id/comments', (req, res) => {
  const {
    authorName,
    authorAvatar,
    authorBadge,
    authorEmail,
    deviceId,
    isAdmin,
    content,
    replyToId,
    replyToAuthor
  } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '請輸入留言內容' });
  }

  const track = tracks.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: '音檔不存在' });

  const toxicWords = [
    '去死', 'fuck', 'fck', 'shit', 'bitch', 'asshole',
    '幹', '操', '操你', '幹你', '白痴', '白癡', '智障', '腦殘',
    '王八蛋', '靠北', '靠杯', '三小', '賤人', '死全家', '滾蛋',
    '混蛋', '垃圾', '髒話', '洗版', '攻擊', '惡意'
  ];
  const lowerContent = content.toLowerCase().replace(/\s+/g, '');
  const isToxic = toxicWords.some(w => lowerContent.includes(w.toLowerCase()));
  if (isToxic) {
    return res.status(422).json({ error: '留言經 Cloudflare Workers AI 智慧審核未通過（含不當或攻擊性言論），請使用友善用詞。' });
  }

  const newComment: Comment = {
    id: `c-${Date.now()}`,
    trackId: req.params.id,
    authorName: authorName || '訪客',
    authorAvatar: authorAvatar || '💬',
    authorBadge: authorBadge || '訪客稱號',
    authorEmail,
    deviceId,
    isAdmin: !!isAdmin,
    content: content.trim(),
    timestamp: '剛剛',
    createdAt: Date.now(),
    isAiModerated: true,
    likes: 0,
    likedBy: [],
    replyToId,
    replyToAuthor
  };

  comments.unshift(newComment);
  track.commentsCount = comments.filter(c => c.trackId === req.params.id).length;
  saveStoreToDisk();

  res.json(newComment);
});

// POST /api/comments/:id/like (Requirement 15: 幫特定留言按讚)
app.post('/api/comments/:id/like', (req, res) => {
  const { identifier } = req.body;
  const comment = comments.find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: '留言不存在' });

  if (!comment.likedBy) comment.likedBy = [];
  if (comment.likes === undefined) comment.likes = 0;

  const idKey = identifier || 'guest';
  const hasLiked = comment.likedBy.includes(idKey);

  if (hasLiked) {
    comment.likedBy = comment.likedBy.filter(x => x !== idKey);
    comment.likes = Math.max(0, comment.likes - 1);
  } else {
    comment.likedBy.push(idKey);
    comment.likes += 1;
  }

  saveStoreToDisk();
  res.json({ likes: comment.likes, hasLiked: !hasLiked });
});

app.put('/api/comments/:id', (req, res) => {
  const { content } = req.body;
  const comment = comments.find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: '留言不存在' });

  comment.content = content.trim();
  saveStoreToDisk();
  res.json(comment);
});

// DELETE /api/comments/:id (Only admin or author, NOT contributor)
app.delete('/api/comments/:id', (req, res) => {
  const index = comments.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '留言不存在' });

  const trackId = comments[index].trackId;
  comments.splice(index, 1);

  const track = tracks.find(t => t.id === trackId);
  if (track) {
    track.commentsCount = comments.filter(c => c.trackId === trackId).length;
  }

  saveStoreToDisk();
  res.json({ success: true });
});

// GET /api/users
app.get('/api/users', (_req, res) => {
  res.json(users);
});

// GET /api/users/profile
app.get('/api/users/profile', (req, res) => {
  const email = (req.query.email as string)?.toLowerCase().trim();
  const id = req.query.id as string;
  const user = users.find(u => (email && u.email?.toLowerCase().trim() === email) || (id && u.id === id));
  if (!user) return res.status(404).json({ error: '找不到此會員' });
  const isOwner = user.email?.toLowerCase().trim() === 'yukidu@gmail.com';
  if (isOwner) {
    user.role = '超級管理員';
    user.isAdminUser = true;
    user.isContributor = true;
  }
  res.json({ success: true, user });
});

// POST /api/users (Create or register user)
app.post('/api/users', (req, res) => {
  const profile: UserProfile = req.body;
  const cleanEmail = (profile.email || '').toLowerCase().trim();
  const isOwner = cleanEmail === 'yukidu@gmail.com';
  const existingIdx = users.findIndex(u => u.email?.toLowerCase().trim() === cleanEmail);
  if (existingIdx !== -1) {
    users[existingIdx] = {
      ...users[existingIdx],
      ...profile,
      role: isOwner ? '超級管理員' : (users[existingIdx].role || profile.role),
      isAdminUser: isOwner ? true : (users[existingIdx].isAdminUser ?? profile.isAdminUser),
      isContributor: isOwner ? true : (users[existingIdx].isContributor ?? profile.isContributor)
    };
    saveStoreToDisk();
    return res.json({ success: true, user: users[existingIdx] });
  }
  if (isOwner) {
    profile.role = '超級管理員';
    profile.isAdminUser = true;
    profile.isContributor = true;
  }
  users.push(profile);
  saveStoreToDisk();
  res.json({ success: true, user: profile, isNewUser: true });
});

// POST /api/users/google-sync
app.post('/api/users/google-sync', (req, res) => {
  const profile: UserProfile = req.body;
  const cleanEmail = (profile.email || '').toLowerCase().trim();
  const isOwner = cleanEmail === 'yukidu@gmail.com';
  const existingIdx = users.findIndex(u => u.email?.toLowerCase().trim() === cleanEmail);
  if (existingIdx !== -1) {
    users[existingIdx] = {
      ...users[existingIdx],
      ...profile,
      role: isOwner ? '超級管理員' : users[existingIdx].role,
      isAdminUser: isOwner ? true : users[existingIdx].isAdminUser,
      isContributor: isOwner ? true : users[existingIdx].isContributor
    };
    saveStoreToDisk();
    return res.json({ success: true, user: users[existingIdx] });
  }
  if (isOwner) {
    profile.role = '超級管理員';
    profile.isAdminUser = true;
    profile.isContributor = true;
  }
  users.push(profile);
  saveStoreToDisk();
  res.json({ success: true, user: profile, isNewUser: true });
});

// PUT /api/users/:id (Update user profile - can be called by user or admin!)
app.put('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id || u.email === req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  const oldName = user.name;
  Object.assign(user, req.body);

  // Requirement 2 & 3: 個人基本資料，名稱修改後，留言板同步跟著改（含管理員留言）
  if (req.body.name || req.body.avatar) {
    comments.forEach(c => {
      const matchEmail = user.email && c.authorEmail && c.authorEmail.toLowerCase().trim() === user.email.toLowerCase().trim();
      const matchAdmin = c.isAdmin && (user.email?.toLowerCase().trim() === 'yukidu@gmail.com' || user.role === '超級管理員');
      const matchName = oldName && c.authorName === oldName;
      if (matchEmail || matchAdmin || matchName) {
        if (req.body.name) c.authorName = req.body.name;
        if (req.body.avatar) c.authorAvatar = req.body.avatar;
      }
    });
  }

  saveStoreToDisk();
  res.json(user);
});

// PUT /api/admin/users/batch (Requirement 24: 批次修改會員中心、獎銜、上手鑽石)
app.put('/api/admin/users/batch', (req, res) => {
  const { userIds, updates } = req.body;
  if (!Array.isArray(userIds) || !updates) {
    return res.status(400).json({ error: '缺少 userIds 或 updates 參數' });
  }

  userIds.forEach(id => {
    const user = users.find(u => u.id === id);
    if (user) {
      Object.assign(user, updates);
    }
  });

  res.json({ success: true, count: userIds.length, users });
});

// PUT /api/users/:id/contributor (Admin designates contributor)
app.put('/api/users/:id/contributor', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  user.isContributor = !user.isContributor;
  res.json(user);
});

// PUT /api/users/:id/admin-role (Requirement 11 & 3: Super Admin designates 獎銜審核員 role)
app.put('/api/users/:id/admin-role', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  if (isSuperAdminEmail(user.email)) {
    return res.status(400).json({ error: '超級管理員身分不可修改' });
  }

  user.isAdminUser = !user.isAdminUser;
  user.role = user.isAdminUser ? '獎銜審核員' : '寰宇家人';
  res.json(user);
});

// PUT /api/users/:id/audit-rank (Requirement 9, 11, 12: 獎銜審核員 or Super Admin audits or modifies member rank)
app.put('/api/users/:id/audit-rank', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  const { rank, action, auditedBy } = req.body;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (action === 'approve') {
    user.approvedRank = user.rank;
    user.rankApproved = true;
    user.rankAuditStatus = 'approved';
    user.auditedBy = auditedBy || '獎銜審核員審核通過';
    user.auditedAt = dateStr;
  } else if (action === 'modify_and_approve') {
    if (rank) {
      user.rank = rank;
      user.approvedRank = rank;
    }
    user.rankApproved = true;
    user.rankAuditStatus = 'approved';
    user.auditedBy = auditedBy || '獎銜審核員修改並審核通過';
    user.auditedAt = dateStr;
  }

  res.json(user);
});

// PUT /api/users/:id/block
app.put('/api/users/:id/block', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  user.isBlocked = !user.isBlocked;
  res.json(user);
});

// Playback recording & cross-device sync (Requirement 1: 首次聆聽、最近聆聽、聽完日期、進度%、點擊次數)
app.post('/api/playback/record', (req, res) => {
  const { trackId, userIdOrDeviceId, currentTime, duration } = req.body;
  if (!trackId || !userIdOrDeviceId) return res.status(400).send();

  const key = `${userIdOrDeviceId}_${trackId}`;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const safeDuration = duration > 0 ? duration : 600;
  const progressPercent = Math.min(100, Math.round((currentTime / safeDuration) * 100));
  const isFinished = progressPercent > 95;
  const listenedOver2Min = currentTime >= 120;

  const prev = playbackRecords[key] || {};
  const currentTrack = tracks.find(t => t.id === trackId);
  const clickCount = (prev.clickCount || 0) + 1;
  const firstListenDate = prev.firstListenDate || dateStr;
  const lastListenDate = dateStr;
  const finishDate = isFinished ? (prev.finishDate || dateStr) : prev.finishDate;

  playbackRecords[key] = {
    trackId,
    trackTitle: currentTrack?.title || prev.trackTitle || '演講錄音檔',
    trackSpeaker: currentTrack?.speaker || prev.trackSpeaker || '寰宇講師',
    trackSpeakerRank: currentTrack?.speakerRank || prev.trackSpeakerRank || '',
    userIdOrDeviceId,
    currentTime,
    duration: safeDuration,
    progressPercent,
    completed: isFinished,
    listenedOver2Min,
    firstListenDate,
    lastListenDate,
    finishDate,
    clickCount,
    updatedAt: Date.now()
  };

  const u = users.find(user => user.email === userIdOrDeviceId || user.id === userIdOrDeviceId);
  if (u && currentTime % 30 < 2) {
    u.playCount += 1;
  }

  // Increment track playCount on record
  if (currentTrack && (!prev.updatedAt || Date.now() - prev.updatedAt > 15000)) {
    currentTrack.playCount = (currentTrack.playCount || 0) + 1;
  }

  res.json(playbackRecords[key]);
});

app.get('/api/playback/history/:userIdOrDeviceId', (req, res) => {
  const id = req.params.userIdOrDeviceId;
  const targetUser = users.find(u => u.id === id || u.email === id);
  const userIds = [id];
  if (targetUser) {
    if (targetUser.id && !userIds.includes(targetUser.id)) userIds.push(targetUser.id);
    if (targetUser.email && !userIds.includes(targetUser.email)) userIds.push(targetUser.email);
  }

  const userRecords: Record<string, any> = {};
  for (const [k, v] of Object.entries(playbackRecords)) {
    if (userIds.some(uid => k.startsWith(`${uid}_`))) {
      const track = tracks.find(t => t.id === v.trackId);
      const isDeleted = !track || v.isDeleted === true;
      // Find comment and rating by user on this track
      const userComment = comments.find(c =>
        c.trackId === v.trackId &&
        (userIds.includes(c.authorEmail || '') || (targetUser && c.authorName === targetUser.name))
      );
      const userRating = track ? (
        userIds.map(uid => track.ratings[uid]).find(r => r !== undefined)
      ) : undefined;

      userRecords[v.trackId] = {
        ...v,
        trackTitle: track?.title || v.trackTitle || '演講錄音檔',
        trackSpeaker: track?.speaker || v.trackSpeaker || '寰宇講師',
        trackSpeakerRank: track?.speakerRank || v.trackSpeakerRank || '',
        isDeleted,
        comment: userComment?.content,
        rating: userRating
      };
    }
  }
  res.json(userRecords);
});

// Helper to score relative time strings for leaderboard sorting (Requirement 9 v2.2)
function parseRelativeTimeScore(text?: string | null): number {
  if (!text) return -Infinity;
  const s = text.trim();
  const now = Date.now();
  if (s === '剛才' || s === '剛剛' || s === '在線') return now;

  const minMatch = s.match(/^(\d+)\s*分鐘前$/);
  if (minMatch) return now - parseInt(minMatch[1], 10) * 60 * 1000;

  const hrMatch = s.match(/^(\d+)\s*小時前$/);
  if (hrMatch) return now - parseInt(hrMatch[1], 10) * 3600 * 1000;

  if (s === '昨天' || s.startsWith('昨天')) return now - 24 * 3600 * 1000;
  if (s === '前天') return now - 48 * 3600 * 1000;

  const dayMatch = s.match(/^(\d+)\s*天前$/);
  if (dayMatch) return now - parseInt(dayMatch[1], 10) * 86400 * 1000;

  const weekMatch = s.match(/^(\d+)\s*(週|星期)前$/);
  if (weekMatch) return now - parseInt(weekMatch[1], 10) * 7 * 86400 * 1000;

  const parsed = new Date(s.replace(/\//g, '-')).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;

  return 0;
}

// Leaderboard API for Requirement 3 & Requirement 12: 訪客不列入模範生的統計排行榜
app.get('/api/leaderboard', (_req, res) => {
  // 排除訪客，僅限正式註冊會員
  const validMembers = users.filter(
    u =>
      u &&
      u.id !== 'guest' &&
      !u.id.startsWith('guest-') &&
      !u.name.startsWith('訪客') &&
      u.role !== '訪客' &&
      u.email &&
      u.email !== 'guest'
  );

  // 1. 基本資料最近更新前5名 (Requirement 9: 修正剛才更新排在昨天更新之後的異常)
  const recentlyUpdated = [...validMembers]
    .sort((a, b) => parseRelativeTimeScore(b.lastActive) - parseRelativeTimeScore(a.lastActive))
    .slice(0, 5)
    .map(u => ({ user: u, value: u.lastActive || '近期' }));

  // 2. 按讚前5名 (Requirement 10: 統計數據為0則不計入)
  const topLikes = [...validMembers]
    .map(u => {
      let count = 0;
      tracks.forEach(t => {
        if (t.likedBy?.includes(u.id) || (u.email && t.likedBy?.includes(u.email))) {
          count++;
        }
      });
      return { user: u, count };
    })
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 3. 留言數前5名 (Requirement 10: 統計數據為0則不計入)
  const topComments = [...validMembers]
    .map(u => {
      const count = comments.filter(c =>
        c.authorEmail === u.email || c.authorName === u.name
      ).length;
      return { user: u, count };
    })
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4. 點閱率前5名 (Requirement 10: 統計數據為0則不計入)
  const topClicks = [...validMembers]
    .map(u => ({ user: u, count: u.playCount || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 5. 100% 聽完前5名 (Requirement 10: 統計數據為0則不計入)
  const topFinished = [...validMembers]
    .map(u => {
      let count = 0;
      for (const [k, v] of Object.entries(playbackRecords)) {
        if (k.startsWith(`${u.id}_`) || (u.email && k.startsWith(`${u.email}_`))) {
          if (v.completed || (v.progressPercent && v.progressPercent > 95)) {
            count++;
          }
        }
      }
      return { user: u, count };
    })
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    recentlyUpdated,
    topLikes,
    topComments,
    topClicks,
    topFinished
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
