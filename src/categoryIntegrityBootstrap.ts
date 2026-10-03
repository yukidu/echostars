const HOME_CACHE_KEY = 'echostars_home_cache_v3_3';
const LIVE_CATEGORY_CACHE_KEY = 'echostars_live_categories_v71';
const nativeFetch = window.fetch.bind(window);

let liveCategories: string[] = [];
let liveCategoriesLoaded = false;

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
  return [...new Set(raw)].filter(name => allowed.has(name)).slice(0, 3);
}

function reconcileHomeCache() {
  if (!liveCategoriesLoaded) return;
  try {
    const expectedCategories = ['全部', ...liveCategories];
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : { tracks: [], categories: [], savedAt: 0 };
    if (!cached || typeof cached !== 'object') return;

    let changed = !raw;
    if (JSON.stringify(cached.categories || []) !== JSON.stringify(expectedCategories)) {
      cached.categories = expectedCategories;
      changed = true;
    }

    if (!Array.isArray(cached.tracks)) {
      cached.tracks = [];
      changed = true;
    } else {
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

function rememberLiveCategories(categories: string[]) {
  liveCategories = normalizeCategoryList(categories);
  liveCategoriesLoaded = true;
  try {
    localStorage.setItem(LIVE_CATEGORY_CACHE_KEY, JSON.stringify(liveCategories));
  } catch {}
  reconcileHomeCache();
}

async function refreshLiveCategories() {
  try {
    const response = await nativeFetch('/api/categories', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (response.ok) {
      const data = await response.json();
      rememberLiveCategories(normalizeCategoryList(data));
      return;
    }
  } catch {
    // handled by the offline fallback below
  }

  // Offline fallback: use the last authoritative category list if available.
  // An empty list is a valid authoritative state and must not revive defaults.
  try {
    const raw = localStorage.getItem(LIVE_CATEGORY_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : [];
    rememberLiveCategories(normalizeCategoryList(cached));
  } catch {
    rememberLiveCategories([]);
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

  if (!liveCategoriesLoaded) await refreshLiveCategories();

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

async function sanitizeTrackListResponse(response: Response): Promise<Response> {
  if (!response.ok || !liveCategoriesLoaded) return response;
  try {
    const data = await response.clone().json();
    if (!Array.isArray(data)) return response;
    const sanitized = data.map(track => (
      track && typeof track === 'object'
        ? { ...track, categories: sanitizeTrackCategories(track.categories) }
        : track
    ));
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    return new Response(JSON.stringify(sanitized), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch {
    return response;
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const info = requestInfo(input, init);
  const [nextInput, nextInit] = await rewriteTrackWrite(input, init);
  let response = await nativeFetch(nextInput, nextInit);

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

  if (
    info.url.origin === window.location.origin &&
    info.url.pathname === '/api/tracks' &&
    info.method === 'GET'
  ) {
    response = await sanitizeTrackListResponse(response);
  }

  return response;
};

// Resolve the authoritative category list before React starts. This prevents a
// deleted category from flashing back during initial render or stale-cache use.
await refreshLiveCategories();
await import('./main');
