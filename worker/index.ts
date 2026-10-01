/**
 * Cloudflare Workers Entry Point for 繁星的回聲 (Echoes of Stars)
 * 架構: Cloudflare Workers + D1 資料庫 + R2 物件儲存 + KV 快取
 */

import { communityApi } from './community';

export interface Env {
  DB?: any; // Cloudflare D1Database
  R2_BUCKET?: any; // Cloudflare R2Bucket
  KV?: any; // Cloudflare KVNamespace
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8'
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: CORS_HEADERS
  });
}

// 預設示範音檔清單 (D1 初次為空時之完整保底資料)
const DEFAULT_TRACKS = [
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
    requiredRank: '無',
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
    keywords: ['營養保健', '日常分享', '產品生活化'],
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
    keywords: ['時間管理', '自律生活', '高效率'],
    rating: 4.5,
    ratingCount: 8,
    commentsCount: 3,
    likes: 14,
    duration: '約 8 分鐘',
    durationSeconds: 480,
    series: '高效自律系列',
    speechDate: '2024/11/22',
    requiredRank: '3%',
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
  }
];

// 預設會員清單 (含超級管理員杜杜龍)
const DEFAULT_USERS = [
  {
    id: 'u-admin',
    email: 'yukidu@gmail.com',
    name: '杜杜龍',
    role: '超級管理員',
    isAdminUser: true,
    amwayId: 'TW-888888',
    phone: '0912-345-678',
    residence: '臺北',
    center: '台北旗艦中心',
    rank: '鑽石',
    approvedRank: '鑽石',
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
    birthday: '1985-07-15',
    avatar: '🐉',
    isContributor: true,
    playCount: 142,
    isBlocked: false,
    lastActive: '剛才'
  },
  {
    id: 'u-1',
    email: 'chen.ming@example.com',
    name: '陳銘耀',
    role: '繁星家人',
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
    avatar: '👨‍💼',
    isContributor: false,
    playCount: 98,
    isBlocked: false,
    lastActive: '10 分鐘前'
  }
];

// 預設留言清單
const DEFAULT_COMMENTS = [
  {
    id: 'c-1',
    trackId: 't-1',
    authorName: '爽朗的海豚',
    authorAvatar: '🐬',
    authorBadge: '訪客稱號',
    isAdmin: false,
    content: '設定目標與達成業績的心法非常實用，收穫很多！',
    timestamp: '27 分鐘前',
    createdAt: Date.now() - 27 * 60 * 1000
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
    createdAt: Date.now() - 59 * 60 * 1000
  },
  {
    id: 'c-4',
    trackId: 't-1',
    authorName: '杜杜龍',
    authorAvatar: '🐲',
    authorBadge: '管理員',
    isAdmin: true,
    authorEmail: 'yukidu@gmail.com',
    content: '陳老師這堂課是經典必聽，建議夥伴多聽兩次！',
    timestamp: '2 小時前',
    createdAt: Date.now() - 120 * 60 * 1000
  }
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const communityResponse = await communityApi(request, env, DEFAULT_TRACKS);
    if (communityResponse) return communityResponse;

    // 2. Cloudflare 架構狀態確認
    if (path === '/api/cloudflare/status' && method === 'GET') {
      return jsonResponse({
        status: 'online',
        environment: env.ENVIRONMENT || 'production',
        d1: env.DB ? 'connected' : 'not_bound',
        r2: env.R2_BUCKET ? 'connected' : 'not_bound',
        kv: env.KV ? 'connected' : 'not_bound',
        timestamp: new Date().toISOString()
      });
    }

    if (path === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    // 3. R2 物件儲存: 上傳檔案
    if (path === '/api/r2/upload' && method === 'POST') {
      if (!env.R2_BUCKET) {
        return errorResponse('Cloudflare R2 儲存桶未綁定 (請確認 wrangler.toml 中的 R2_BUCKET 綁定名稱與 Cloudflare 控制台的儲存桶 echoes-audio-bucket 是否相符)', 503);
      }
      try {
        const formData = await request.formData();
        const file = (formData.get('file') || formData.get('audio')) as File | null;
        if (!file) return errorResponse('缺少上傳檔案 (file)', 400);

        const fileName = file.name || 'audio.mp3';
        const ext = (fileName.split('.').pop()?.toLowerCase() || 'mp3').replace(/^\./, '');
        const fileType = ((formData.get('fileType') as string) || '').toLowerCase();
        const isImage = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';

        let finalFileName: string;

        if (fileType === 'cover' || isImage) {
          const speaker = ((formData.get('speaker') as string) || '').replace(/[\\/:*?"<>|#&+=\s]/g, '').trim() || 'speaker';
          finalFileName = `cover-${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        } else {
          // 命名格式：「ES00001-演講者+獎銜-中文曲目名稱.副檔名」
          // 00001 = 系統自動編號序號，+ 符號不顯示，- 符號保留顯示
          let nextSeq = 1;
          if (env.KV) {
            const currentSeqStr = await env.KV.get('AUDIO_SEQUENCE_COUNTER');
            const currentSeq = currentSeqStr ? parseInt(currentSeqStr, 10) : 0;
            nextSeq = (isNaN(currentSeq) ? 0 : currentSeq) + 1;
            await env.KV.put('AUDIO_SEQUENCE_COUNTER', String(nextSeq));
          } else if (env.DB) {
            try {
              const res = await env.DB.prepare('SELECT COUNT(*) as count FROM tracks').first();
              nextSeq = ((res?.count as number) || 0) + 1;
            } catch {
              nextSeq = 1;
            }
          }

          const seqStr = String(nextSeq).padStart(5, '0');

          const cleanSpeaker = ((formData.get('speaker') as string) || '').replace(/[\\/:*?"<>|#&+=\s]/g, '').trim() || '繁星講師';
          const rawRank = ((formData.get('speakerRank') as string) || '').trim();
          const cleanRank = (rawRank && rawRank !== '無' && rawRank !== '公開')
            ? rawRank.replace(/[\\/:*?"<>|#&+=\s]/g, '').trim()
            : '';
          const speakerPart = `${cleanSpeaker}${cleanRank}`;

          const rawTitle = ((formData.get('title') as string) || '').trim();
          const cleanTitle = (rawTitle || fileName.replace(/\.[^/.]+$/, ''))
            .replace(/[\\/:*?"<>|#&+]/g, '')
            .trim() || '演講錄音';

          finalFileName = `ES${seqStr}-${speakerPart}-${cleanTitle}.${ext}`;
        }

        const key = `uploads/${finalFileName}`;
        
        let contentType = file.type;
        if (!contentType || contentType === 'application/octet-stream') {
          if (ext === 'mp3') contentType = 'audio/mpeg';
          else if (ext === 'm4a') contentType = 'audio/mp4';
          else if (ext === 'wav') contentType = 'audio/wav';
          else if (ext === 'ogg') contentType = 'audio/ogg';
          else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
          else if (ext === 'png') contentType = 'image/png';
          else if (ext === 'webp') contentType = 'image/webp';
          else contentType = 'audio/mpeg';
        }

        await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType }
        });

        const fileUrl = `/api/r2/file/${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, key, url: fileUrl });
      } catch (err: any) {
        return errorResponse(err.message || 'R2 上傳失敗', 500);
      }
    }

    // 4. R2 物件儲存: 串流讀取檔案 (支援 Range 串流，確保 iPhone / Safari / Android 網路裝置皆能順暢播放)
    if (path.startsWith('/api/r2/file/') && (method === 'GET' || method === 'HEAD')) {
      if (!env.R2_BUCKET) {
        return new Response('R2 儲存桶未綁定', { status: 503, headers: CORS_HEADERS });
      }
      const key = decodeURIComponent(path.replace('/api/r2/file/', ''));
      const rangeHeader = request.headers.get('Range');

      try {
        const object = await env.R2_BUCKET.get(key, {
          range: rangeHeader ? request.headers : undefined,
          onlyIf: request.headers
        });

        if (!object) {
          return new Response('檔案不存在', { status: 404, headers: CORS_HEADERS });
        }

        const headers = new Headers(CORS_HEADERS);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        const ext = key.split('.').pop()?.toLowerCase();
        if (!headers.get('Content-Type')) {
          if (ext === 'mp3') headers.set('Content-Type', 'audio/mpeg');
          else if (ext === 'm4a') headers.set('Content-Type', 'audio/mp4');
          else if (ext === 'wav') headers.set('Content-Type', 'audio/wav');
          else if (ext === 'ogg') headers.set('Content-Type', 'audio/ogg');
          else if (ext === 'jpg' || ext === 'jpeg') headers.set('Content-Type', 'image/jpeg');
          else if (ext === 'png') headers.set('Content-Type', 'image/png');
        }

        if (rangeHeader && object.range) {
          const { offset, length } = object.range as any;
          const total = object.size;
          headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${total}`);
          headers.set('Content-Length', String(length));
          return new Response(method === 'HEAD' ? null : object.body, {
            status: 206,
            headers
          });
        }

        headers.set('Content-Length', String(object.size));
        return new Response(method === 'HEAD' ? null : object.body, { headers });
      } catch (err: any) {
        return new Response(err.message || '讀取 R2 檔案錯誤', { status: 500, headers: CORS_HEADERS });
      }
    }

    // 5. API 路由處理 (D1 / KV / Fallback)
    if (path.startsWith('/api/')) {
      // 5.1 分類標籤 (/api/categories)
      if (path === '/api/categories') {
        if (method === 'GET') {
          if (env.DB) {
            try {
              const { results } = await env.DB.prepare('SELECT name FROM categories ORDER BY createdAt ASC').all();
              if (results && results.length > 0) {
                return jsonResponse(results.map((r: any) => r.name));
              }
            } catch (e) {
              console.error('D1 categories query error:', e);
            }
          }
          return jsonResponse(['事業', '心態思維', '營養', '安麗產品', '影集', '未分類']);
        }

        if (method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const name = body.name?.trim();
          if (!name) return errorResponse('標籤名稱不可為空');
          if (env.DB) {
            try {
              await env.DB.prepare('INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)').bind(name, Date.now()).run();
              const { results } = await env.DB.prepare('SELECT name FROM categories ORDER BY createdAt ASC').all();
              return jsonResponse({ success: true, categories: results.map((r: any) => r.name) });
            } catch (e) {
              console.error('D1 categories insert error:', e);
            }
          }
          return jsonResponse({ success: true, categories: ['事業', '心態思維', '營養', '安麗產品', '影集', '未分類', name] });
        }
      }

      // 5.2 網友關鍵字清單 (/api/keywords)
      if (path === '/api/keywords' && method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare('SELECT keywords FROM tracks').all();
            const set = new Set<string>();
            for (const row of results) {
              if (row.keywords) {
                try {
                  const list = JSON.parse(row.keywords);
                  if (Array.isArray(list)) list.forEach(k => set.add(String(k).trim()));
                } catch {}
              }
            }
            if (set.size > 0) return jsonResponse(Array.from(set));
          } catch (e) {
            console.error('D1 keywords error:', e);
          }
        }
        return jsonResponse(['目標設定', '業績突破', '實戰成交', '行動步驟', '事業成長', '逆境成長', '轉念心態', '正向思維', '新人起步']);
      }

      // 5.3 錄音檔清單 (GET, POST, PUT, DELETE /api/tracks)
      if (path === '/api/tracks' || path.startsWith('/api/tracks/')) {
        if (path === '/api/tracks' && method === 'GET') {
          if (env.DB) {
            try {
              const { results } = await env.DB.prepare('SELECT * FROM tracks ORDER BY uploadDate DESC').all();
              if (results && results.length > 0) {
                const parsed = results.map((t: any) => ({
                  ...t,
                  categories: t.categories ? JSON.parse(t.categories) : [],
                  keywords: t.keywords ? JSON.parse(t.keywords) : [],
                  externalVideos: t.externalVideos ? JSON.parse(t.externalVideos) : [],
                  externalPpts: t.externalPpts ? JSON.parse(t.externalPpts) : [],
                  externalFiles: t.externalFiles ? JSON.parse(t.externalFiles) : [],
                  likedBy: t.likedBy ? JSON.parse(t.likedBy) : [],
                  ratings: t.ratings ? JSON.parse(t.ratings) : {},
                  isPrivateVip: Boolean(t.isPrivateVip)
                }));
                return jsonResponse(parsed);
              }
            } catch (e) {
              console.error('D1 tracks query error:', e);
            }
          }
          // 初次資料庫無資料時，返回預設資料
          return jsonResponse(DEFAULT_TRACKS);
        }

        if (path === '/api/tracks' && method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || `t-${Date.now()}`;
          const cleanCategories = Array.isArray(body.categories) && body.categories.length > 0 ? body.categories : ['未分類'];
          const cleanKeywords = Array.isArray(body.keywords) ? body.keywords : [];
          const cleanVideos = Array.isArray(body.externalVideos) ? body.externalVideos : [];
          const cleanPpts = Array.isArray(body.externalPpts) ? body.externalPpts : [];
          const cleanFiles = Array.isArray(body.externalFiles) ? body.externalFiles : [];
          const cleanLikedBy = Array.isArray(body.likedBy) ? body.likedBy : [];
          const cleanRatings = typeof body.ratings === 'object' && body.ratings !== null ? body.ratings : {};

          const newTrack = {
            ...body,
            id,
            uploadDate: body.uploadDate || new Date().toISOString().split('T')[0],
            categories: cleanCategories,
            keywords: cleanKeywords,
            rating: typeof body.rating === 'number' ? body.rating : 5.0,
            ratingCount: typeof body.ratingCount === 'number' ? body.ratingCount : 1,
            commentsCount: typeof body.commentsCount === 'number' ? body.commentsCount : 0,
            likes: typeof body.likes === 'number' ? body.likes : 0,
            playCount: typeof body.playCount === 'number' ? body.playCount : 0,
            externalVideos: cleanVideos,
            externalPpts: cleanPpts,
            externalFiles: cleanFiles,
            likedBy: cleanLikedBy,
            ratings: cleanRatings
          };

          if (env.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO tracks (
                  id, title, speaker, speakerRank, speakerAvatar, categories, keywords,
                  rating, ratingCount, commentsCount, likes, duration, durationSeconds,
                  audioUrl, series, speechDate, requiredRank, seriesOrder, uploadDate,
                  description, uploaderId, uploaderEmail, playCount, isPrivateVip,
                  externalVideos, externalPpts, externalFiles, likedBy, ratings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                id, newTrack.title || '無標題', newTrack.speaker || '未知講者', newTrack.speakerRank || '無',
                newTrack.speakerAvatar || '', JSON.stringify(newTrack.categories), JSON.stringify(newTrack.keywords),
                newTrack.rating, newTrack.ratingCount, newTrack.commentsCount, newTrack.likes,
                newTrack.duration || '約 10 分鐘', newTrack.durationSeconds || 600, newTrack.audioUrl || '',
                newTrack.series || '', newTrack.speechDate || '', newTrack.requiredRank || '無', newTrack.seriesOrder || '',
                newTrack.uploadDate, newTrack.description || '', newTrack.uploaderId || '', newTrack.uploaderEmail || '',
                newTrack.playCount, newTrack.isPrivateVip ? 1 : 0, JSON.stringify(newTrack.externalVideos),
                JSON.stringify(newTrack.externalPpts), JSON.stringify(newTrack.externalFiles),
                JSON.stringify(newTrack.likedBy), JSON.stringify(newTrack.ratings)
              ).run();
            } catch (e) {
              console.error('D1 insert track error:', e);
            }
          }
          return jsonResponse({ success: true, track: newTrack, ...newTrack });
        }

        // 5.3.0 更新錄音檔 (PUT /api/tracks/:id)
        if (/^\/api\/tracks\/[^/]+$/.test(path) && method === 'PUT') {
          const trackId = path.split('/api/tracks/')[1];
          const body: any = await request.json().catch(() => ({}));
          if (env.DB && trackId) {
            try {
              await env.DB.prepare(`
                UPDATE tracks SET
                  title = ?, speaker = ?, speakerRank = ?, speakerAvatar = ?,
                  categories = ?, keywords = ?, series = ?, speechDate = ?,
                  requiredRank = ?, seriesOrder = ?, description = ?,
                  externalVideos = ?, externalPpts = ?, externalFiles = ?
                WHERE id = ?
              `).bind(
                body.title || '無標題', body.speaker || '未知講者', body.speakerRank || '無',
                body.speakerAvatar || '', JSON.stringify(body.categories || []), JSON.stringify(body.keywords || []),
                body.series || '', body.speechDate || '', body.requiredRank || '無', body.seriesOrder || '',
                body.description || '', JSON.stringify(body.externalVideos || []), JSON.stringify(body.externalPpts || []),
                JSON.stringify(body.externalFiles || []), trackId
              ).run();
            } catch (e) {
              console.error('D1 update track error:', e);
            }
          }
          const updatedTrack = {
            ...body,
            id: trackId,
            categories: Array.isArray(body.categories) ? body.categories : ['未分類'],
            keywords: Array.isArray(body.keywords) ? body.keywords : [],
            likedBy: Array.isArray(body.likedBy) ? body.likedBy : [],
            ratings: typeof body.ratings === 'object' && body.ratings !== null ? body.ratings : {}
          };
          return jsonResponse({ success: true, track: updatedTrack, ...updatedTrack });
        }

        // 5.3.3 音檔播放計數 (POST /api/tracks/:id/play)
        if (path.match(/^\/api\/tracks\/[^/]+\/play$/) && method === 'POST') {
          const trackId = path.split('/')[3];
          if (env.DB && trackId) {
            try {
              await env.DB.prepare('UPDATE tracks SET playCount = playCount + 1 WHERE id = ?').bind(trackId).run();
            } catch (e) {
              console.error('D1 play count update error:', e);
            }
          }
          return jsonResponse({ success: true, trackId });
        }

        if (/^\/api\/tracks\/[^/]+$/.test(path) && method === 'DELETE') {
          const trackId = path.split('/api/tracks/')[1];
          if (env.DB && trackId) {
            try {
              await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(trackId).run();
            } catch (e) {
              console.error('D1 delete track error:', e);
            }
          }
          return jsonResponse({ success: true, deletedId: trackId });
        }
      }

      // 5.4 會員名冊清單 (GET /api/users)
      if (path === '/api/users' && method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY registerDate DESC').all();
            if (results && results.length > 0) {
              const parsed = results.map((u: any) => ({
                ...u,
                rankApproved: Boolean(u.rankApproved),
                isContributor: Boolean(u.isContributor),
                isAdminUser: Boolean(u.isAdminUser),
                isBlocked: Boolean(u.isBlocked),
                playCount: u.playCount || 0
              }));
              return jsonResponse(parsed);
            }
          } catch (e) {
            console.error('D1 users query error:', e);
          }
        }
        return jsonResponse(DEFAULT_USERS);
      }

      // 5.4.4 會員行為與變更紀錄查詢 (GET /api/users/activity-logs)
      if (path === '/api/users/activity-logs' && method === 'GET') {
        const email = url.searchParams.get('email');
        if (env.DB && email) {
          try {
            const { results } = await env.DB.prepare('SELECT * FROM user_activity_logs WHERE userEmail = ? ORDER BY timestamp DESC LIMIT 100').bind(email).all();
            return jsonResponse(results || []);
          } catch (e) {
            console.error('D1 activity logs error:', e);
          }
        }
        return jsonResponse([]);
      }

      // 5.5 管理員批次更新會員 (/api/admin/users/batch)
      if (path === '/api/admin/users/batch' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const usersList: any[] = body.users || [];
        if (env.DB && usersList.length > 0) {
          try {
            for (const u of usersList) {
              await env.DB.prepare(`
                UPDATE users SET 
                  rank = ?, approvedRank = ?, rankApproved = ?, rankAuditStatus = ?,
                  auditedBy = ?, auditedAt = ?, role = ?, isContributor = ?, isAdminUser = ?, isBlocked = ?
                WHERE id = ?
              `).bind(
                u.rank || '3%', u.approvedRank || u.rank || '3%', u.rankApproved ? 1 : 0,
                u.rankAuditStatus || 'approved', u.auditedBy || '', u.auditedAt || '',
                u.role || '一般夥伴', u.isContributor ? 1 : 0, u.isAdminUser ? 1 : 0,
                u.isBlocked ? 1 : 0, u.id
              ).run();
            }
          } catch (e) {
            console.error('D1 batch update users error:', e);
          }
        }
        return jsonResponse({ success: true, count: usersList.length });
      }

      // 5.7 播放進度記憶與跨裝置永久紀錄 (POST /api/playback/record & GET /api/playback/history/:id)
      if (path === '/api/playback/record' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { trackId, userIdOrDeviceId, currentTime, duration } = body;
        if (!trackId || !userIdOrDeviceId) {
          return errorResponse('缺少必要參數 (trackId, userIdOrDeviceId)', 400);
        }

        const key = `${userIdOrDeviceId}_${trackId}`;
        const safeDuration = duration > 0 ? duration : 600;
        const progressPercent = Math.min(100, Math.round((currentTime / safeDuration) * 100));
        const isCompleted = progressPercent >= 95 ? 1 : 0;
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

        const record = {
          key,
          trackId,
          userIdentifier: userIdOrDeviceId,
          currentTime,
          duration: safeDuration,
          progressPercent,
          completed: isCompleted,
          lastPlayedAt: Date.now(),
          lastListenDate: dateStr,
          finishDate: isCompleted ? dateStr : null
        };

        if (env.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO playback_memories (
                key, trackId, userIdentifier, currentTime, duration, progressPercent,
                lastPlayedAt, completed, lastListenDate, finishDate
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                currentTime = excluded.currentTime,
                duration = excluded.duration,
                progressPercent = excluded.progressPercent,
                lastPlayedAt = excluded.lastPlayedAt,
                completed = CASE WHEN excluded.completed = 1 THEN 1 ELSE playback_memories.completed END,
                lastListenDate = excluded.lastListenDate,
                finishDate = CASE WHEN excluded.completed = 1 AND playback_memories.finishDate IS NULL THEN excluded.finishDate ELSE playback_memories.finishDate END
            `).bind(
              key, trackId, userIdOrDeviceId, currentTime, safeDuration, progressPercent,
              Date.now(), isCompleted, dateStr, isCompleted ? dateStr : null
            ).run();

            // Increment user play count if playing actively
            if (currentTime % 30 < 2) {
              await env.DB.prepare('UPDATE users SET playCount = playCount + 1 WHERE email = ? OR id = ?').bind(userIdOrDeviceId, userIdOrDeviceId).run();
            }
          } catch (e) {
            console.error('D1 playback memory save error:', e);
          }
        }

        if (env.KV) {
          try {
            await env.KV.put(`playback_rec:${key}`, JSON.stringify(record));
          } catch {}
        }

        return jsonResponse({ success: true, record });
      }

      if (path.startsWith('/api/playback/history/')) {
        const id = decodeURIComponent(path.replace('/api/playback/history/', ''));
        const recordsMap: Record<string, any> = {};

        if (env.DB && id) {
          try {
            const { results } = await env.DB.prepare(`
              SELECT * FROM playback_memories
              WHERE userIdentifier = ? OR key LIKE ?
            `).bind(id, `${id}_%`).all();

            if (results && results.length > 0) {
              for (const r of results) {
                recordsMap[r.trackId] = {
                  ...r,
                  completed: Boolean(r.completed),
                  updatedAt: r.lastPlayedAt || Date.now()
                };
              }
            }
          } catch (e) {
            console.error('D1 playback history query error:', e);
          }
        }

        return jsonResponse(recordsMap);
      }

      // 5.8 改版歷程紀錄 (/api/changelog)
      if (path === '/api/changelog') {
        if (method === 'GET') {
          if (env.KV) {
            const stored = await env.KV.get('changelog');
            if (stored) return jsonResponse(JSON.parse(stored));
          }
          return jsonResponse([
            {
              version: 'v2.8',
              date: '2026/10/01',
              title: 'v2.8 功能修正與全面體驗升級',
              description: 'Cloudflare 邊緣雲端全面整合、音檔詳細頁全方位體驗升級（匯出圖卡、五星評價緊湊響應、留言圖示化）、小螢幕關閉防遮擋與訪客去暱稱化、播放器緊湊化、個人圖卡去生日電話、多組網友關鍵字交叉複合搜尋、首頁與詳細頁左下角浮動回頂按鈕，以及高解析度手機字體 3 倍放大適配。',
              author: '杜杜龍 (超級管理員)'
            }
          ]);
        }
        if (method === 'PUT') {
          const body: any = await request.json().catch(() => ({}));
          const { changelog } = body;
          if (env.KV && Array.isArray(changelog)) {
            await env.KV.put('changelog', JSON.stringify(changelog));
          }
          return jsonResponse({ success: true, changelog });
        }
      }

      // 5.9 排行榜統計資料 (/api/leaderboard)
      if (path === '/api/leaderboard' && method === 'GET') {
        return jsonResponse({
          totalListens: 18450,
          totalUsers: 24,
          topTracks: DEFAULT_TRACKS.slice(0, 3),
          topSpeakers: [
            { name: '陳志豪', rank: '鑽石領袖', plays: 1240 },
            { name: '林美玲', rank: '皇冠大使', plays: 980 }
          ]
        });
      }

      // 安全機制：未宣告之 /api/* 一律返回 404 JSON，不可返回物件偽裝成功造成前端陣列操作崩潰
      return errorResponse(`API endpoint not found: ${path}`, 404);
    }

    // 6. 前端靜態資源分發 (SPA Fallback)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
