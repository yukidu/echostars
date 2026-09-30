/**
 * Cloudflare Workers Entry Point for 繁星的回聲 (Echoes of Stars)
 * 架構: Cloudflare Workers + D1 資料庫 + R2 物件儲存 + KV 快取
 */

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

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

    // 3. R2 物件儲存: 上傳檔案
    if (path === '/api/r2/upload' && method === 'POST') {
      if (!env.R2_BUCKET) {
        return errorResponse('R2 儲存桶未設定或未綁定 R2_BUCKET', 503);
      }
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return errorResponse('缺少上傳檔案 (file)', 400);

        const ext = file.name.split('.').pop() || 'mp3';
        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        
        await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || 'audio/mpeg' }
        });

        const fileUrl = `/api/r2/file/${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, key, url: fileUrl });
      } catch (err: any) {
        return errorResponse(err.message || 'R2 上傳失敗', 500);
      }
    }

    // 4. R2 物件儲存: 串流讀取檔案
    if (path.startsWith('/api/r2/file/') && method === 'GET') {
      if (!env.R2_BUCKET) {
        return new Response('R2 儲存桶未綁定', { status: 503 });
      }
      const key = decodeURIComponent(path.replace('/api/r2/file/', ''));
      const object = await env.R2_BUCKET.get(key);
      if (!object) {
        return new Response('檔案不存在', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(object.body, { headers });
    }

    // 5. API 路由處理 (若為 D1 資料庫運作模式)
    if (path.startsWith('/api/')) {
      // 5.1 分類標籤
      if (path === '/api/categories') {
        if (method === 'GET') {
          if (env.DB) {
            const { results } = await env.DB.prepare('SELECT name FROM categories ORDER BY createdAt ASC').all();
            return jsonResponse(results.map((r: any) => r.name));
          }
          return jsonResponse(['事業', '心態思維', '營養', '安麗產品', '影集', '未分類']);
        }

        if (method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const name = body.name?.trim();
          if (!name) return errorResponse('標籤名稱不可為空');
          if (env.DB) {
            await env.DB.prepare('INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)').bind(name, Date.now()).run();
            const { results } = await env.DB.prepare('SELECT name FROM categories ORDER BY createdAt ASC').all();
            return jsonResponse({ success: true, categories: results.map((r: any) => r.name) });
          }
          return jsonResponse({ success: true, categories: ['事業', '心態思維', '營養', '安麗產品', '影集', '未分類', name] });
        }
      }

      // 5.2 網友關鍵字清單
      if (path === '/api/keywords' && method === 'GET') {
        if (env.DB) {
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
          return jsonResponse(Array.from(set));
        }
        return jsonResponse([]);
      }

      // 5.3 錄音檔清單 (GET /api/tracks)
      if (path === '/api/tracks' && method === 'GET') {
        if (env.DB) {
          const { results } = await env.DB.prepare('SELECT * FROM tracks ORDER BY uploadDate DESC').all();
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
        return jsonResponse([]);
      }

      // 5.4 播放進度記憶 (KV / D1)
      if (path === '/api/playback-memory') {
        if (method === 'GET') {
          const identifier = url.searchParams.get('identifier');
          if (env.KV && identifier) {
            const raw = await env.KV.get(`playback:${identifier}`);
            return jsonResponse(raw ? JSON.parse(raw) : []);
          }
          return jsonResponse([]);
        }
        if (method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const { identifier, records } = body;
          if (env.KV && identifier) {
            await env.KV.put(`playback:${identifier}`, JSON.stringify(records || []));
          }
          return jsonResponse({ success: true });
        }
      }

      // 5.5 改版歷程紀錄 (KV / D1)
      if (path === '/api/changelog') {
        if (method === 'GET') {
          if (env.KV) {
            const stored = await env.KV.get('changelog');
            if (stored) return jsonResponse(JSON.parse(stored));
          }
          return jsonResponse([]);
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

      // 預設 fallback 給未明示 API
      return jsonResponse({ status: 'ok', message: 'Cloudflare Worker processed API request' });
    }

    // 6. 前端靜態資源分發 (SPA Fallback)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
