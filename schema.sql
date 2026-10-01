-- Cloudflare D1 Database Schema for 繁星的回聲 (Echoes of Stars)
-- 執行方式: wrangler d1 execute echoes_db --file=./schema.sql

-- 1. 會員表 (users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  amwayId TEXT,
  phone TEXT,
  center TEXT,
  rank TEXT DEFAULT '3%',
  role TEXT DEFAULT '一般夥伴',
  avatar TEXT,
  joinReason TEXT,
  stayReason TEXT,
  sponsor TEXT,
  platinumUpline TEXT,
  diamondUpline TEXT,
  birthDate TEXT,
  notes TEXT,
  registerDate TEXT,
  rankUpdatedAt TEXT,
  lastActive TEXT,
  auditedBy TEXT,
  auditedAt TEXT,
  rankApproved INTEGER DEFAULT 0,
  rankAuditStatus TEXT DEFAULT 'approved',
  isContributor INTEGER DEFAULT 0,
  isAdminUser INTEGER DEFAULT 0,
  isBlocked INTEGER DEFAULT 0,
  residence TEXT,
  birthday TEXT,
  approvedRank TEXT,
  rankAuditType TEXT,
  canUpload INTEGER DEFAULT 0,
  playCount INTEGER DEFAULT 0,
  googleAvatar TEXT,
  avatarUploadCount INTEGER DEFAULT 0,
  avatarUploadMonth TEXT,
  profileEditCount INTEGER DEFAULT 0,
  profileEditMonth TEXT,
  zodiac TEXT,
  talentNumber INTEGER,
  lifeNumber INTEGER
);

-- 2. 音檔表 (tracks)
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  speaker TEXT NOT NULL,
  speakerRank TEXT,
  speakerAvatar TEXT,
  categories TEXT, -- JSON Array: ["事業", "心態思維"]
  keywords TEXT,   -- JSON Array: ["目標", "行動"]
  rating REAL DEFAULT 5.0,
  ratingCount INTEGER DEFAULT 1,
  commentsCount INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  duration TEXT,
  durationSeconds INTEGER DEFAULT 600,
  audioUrl TEXT NOT NULL,
  series TEXT,
  speechDate TEXT,
  requiredRank TEXT DEFAULT '無',
  seriesOrder TEXT,
  uploadDate TEXT,
  description TEXT,
  uploaderId TEXT,
  uploaderEmail TEXT,
  playCount INTEGER DEFAULT 0,
  isPrivateVip INTEGER DEFAULT 0,
  vipToken TEXT,
  vipExpiresAt INTEGER,
  vipDurationDays INTEGER DEFAULT 7,
  externalVideos TEXT, -- JSON Array: [{"name":"...","url":"..."}]
  externalPpts TEXT,   -- JSON Array
  externalFiles TEXT,  -- JSON Array
  likedBy TEXT,        -- JSON Array of user emails/IDs
  ratings TEXT         -- JSON Object: {"user@gmail.com": 5}
);

-- 3. 留言表 (comments)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  trackId TEXT NOT NULL,
  authorName TEXT NOT NULL,
  authorAvatar TEXT,
  authorBadge TEXT,
  authorEmail TEXT,
  content TEXT NOT NULL,
  timestamp TEXT,
  createdAt INTEGER,
  likes INTEGER DEFAULT 0,
  replyToId TEXT,
  replyToAuthor TEXT,
  isAdmin INTEGER DEFAULT 0,
  deviceId TEXT,
  likedBy TEXT -- JSON Array
);

-- 4. 分類標籤表 (categories)
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  createdAt INTEGER
);

-- 5. 播放進度記憶 (playback_memories)
CREATE TABLE IF NOT EXISTS playback_memories (
  key TEXT PRIMARY KEY, -- identifier_trackId
  trackId TEXT NOT NULL,
  userIdentifier TEXT NOT NULL,
  currentTime REAL DEFAULT 0,
  duration REAL DEFAULT 0,
  progressPercent REAL DEFAULT 0,
  lastPlayedAt INTEGER,
  completed INTEGER DEFAULT 0,
  trackTitle TEXT,
  trackSpeaker TEXT,
  trackSpeakerRank TEXT,
  isDeleted INTEGER DEFAULT 0,
  lastListenDate TEXT,
  finishDate TEXT
);

-- 6. 會員行為與異動歷程紀錄表 (user_activity_logs)
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id TEXT PRIMARY KEY,
  userEmail TEXT NOT NULL,
  userId TEXT,
  actionType TEXT NOT NULL, -- 'login', 'register', 'update_profile', 'rate_track', 'like_track'
  details TEXT,             -- JSON 格式詳細異動資訊
  timestamp INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

-- 初始分類標籤
INSERT OR IGNORE INTO categories (name, createdAt) VALUES 
('事業', 1727654400000),
('心態思維', 1727654400000),
('營養', 1727654400000),
('安麗產品', 1727654400000),
('影集', 1727654400000),
('未分類', 1727654400000);

-- 初始超級管理員帳號
INSERT OR IGNORE INTO users (
  id, name, email, amwayId, phone, center, rank, role, avatar, 
  joinReason, stayReason, sponsor, platinumUpline, diamondUpline, 
  birthDate, notes, registerDate, rankUpdatedAt, lastActive, 
  auditedBy, auditedAt, rankApproved, rankAuditStatus, isContributor, isAdminUser, isBlocked
) VALUES (
  'u-admin', '杜杜龍', 'yukidu@gmail.com', 'TW-888888', '0912-345-678', '台北旗艦中心', '鑽石', '超級管理員', '🐉',
  '事業', '打造自己的事業與團隊', '創辦人團隊', '杜鑽石', '杜鑽石',
  '1985-07-15', '全系統最高權限管理者與創作者', '2026/08/01 10:00', '2026/08/01 10:00', '剛才',
  '系統初始最高權限', '2026/08/01 10:00', 1, 'approved', 1, 1, 0
);
