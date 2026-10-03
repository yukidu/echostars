const HOME_CACHE_KEY = 'echostars_home_cache_v3_3';
const LIVE_CATEGORY_CACHE_KEY = 'echostars_live_categories_v57';
const nativeFetch = window.fetch.bind(window);

let liveCategories: string[] = [];

function normalizeCategoryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.map(item => String(item || '').trim()).filter(Boolean)
  )];
}

function sanitizeTrackCategories(value: unknown): string[] {
  const allowed = new Set(liveCategories);
  const raw = Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const next = [...new Set(raw)].filter(name => allowed.has(name)).slice(0, 3);
  if (next.length) return next;
  return allowed.has('未分類') ? ['未分類'] : [];
}

function rememberLiveCategories(categories: string[]) {
  liveCategories = normalizeCategoryList(categories);
  try {
    localStorage.setItem(LIVE_CATEGORY_CACHE_KEY, JSON.stringify(liveCategories));
  } catch {}
  reconcileHomeCache();
}

function reconcileHomeCache() {
  if (!liveCategories.length) return;
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') return;

    let changed = false;
    const expectedCategories = ['全部', ...liveCategories];
    if (JSON.stringify(cached.categories || []) !== JSON.stringify(expectedCategories)) {
      cached.categories = expectedCategories;
      changed = true;
    }

    if (Array.isArray(cached.tracks)) {
      cached.tracks = cached.tracks.map((track: any) => {
        if (!track || typeof track !== 'object') return track;
        const next = sanitizeTrackCategories(track.categories);
        if (JSON.stringify(next) === JSON.stringify(track.categories || [])) return track;
        changed = true;
        return { ...track, categories: next };
      });
    }

    if (changed) {
      // Force one authoritative refresh after a category mutation instead of
      // trusting the old five-minute home cache.
      cached.savedAt = 0;
      localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(cached));
    }
  } catch {}
}

async function refreshLiveCategories() {
  try {
    const response = await nativeFetch('/api/categories', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) return;
    const data = await response.json();
    rememberLiveCategories(normalizeCategoryList(data));
  } catch {
    // Offline fallback: use the last authoritative category list if available.
    try {
      const cached = JSON.parse(localStorage.getItem(LIVE_CATEGORY_CACHE_KEY) || '[]');
      liveCategories = normalizeCategoryList(cached);
      reconcileHomeCache();
    } catch {}
  }
}

function requestInfo(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request ? input : null;
  const url = new URL(request?.url || String(input), window.location.href);
  const method = String(init?.method || request?.method || 'GET').toUpperCase();
  return { request, url, method };
}

async function rewriteTrackWrite(input: RequestInfo | URL, init?: RequestInit): Promise<[RequestInfo | URL, RequestInit | undefined]> {
  const { request, url, method } = requestInfo(input, init);
  const isCreate = url.origin === window.location.origin && url.pathname === '/api/tracks' && method === 'POST';
  const isUpdate = url.origin === window.location.origin && /^\/api\/tracks\/[^/]+$/.test(url.pathname) && method === 'PUT';
  if (!isCreate && !isUpdate) return [input, init];

  if (!liveCategories.length) await refreshLiveCategories();

  try {
    let body: any = null;
    if (typeof init?.body === 'string') {
      body = JSON.parse(init.body);
    } else if (request) {
      body = await request.clone().json();
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [input, init];

    const hasCategories = Object.prototype.hasOwnProperty.call(body, 'categories');
    if (!isCreate && !hasCategories) return [input, init];
    body.categories = sanitizeTrackCategories(body.categories);

    if (request && init?.body === undefined) {
      const headers = new Headers(request.headers);
      headers.set('Content-Type', 'application/json');
      headers.delete('Content-Length');
      return [new Request(request, { headers, body: JSON.stringify(body) }), undefined];
    }

    return [input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }];
  } catch {
    return [input, init];
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const info = requestInfo(input, init);
  const [nextInput, nextInit] = await rewriteTrackWrite(input, init);
  const response = await nativeFetch(nextInput, nextInit);

  if (
    info.url.origin === window.location.origin &&
    info.url.pathname.startsWith('/api/categories') &&
    response.ok
  ) {
    void response.clone().json().then((data: any) => {
      const categories = Array.isArray(data) ? data : data?.categories;
      if (Array.isArray(categories)) rememberLiveCategories(categories);
    }).catch(() => undefined);
  }

  return response;
};

await refreshLiveCategories();
await import('./main');
