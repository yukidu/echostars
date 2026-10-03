import { GOOGLE_CLIENT_ID } from './config/auth';

declare global {
  interface Window {
    google?: any;
    __echostarsFetchPatched?: boolean;
  }
}

const USER_KEY = 'sq_current_user_v1';
const SESSION_CHECK_KEY = 'echostars_auth_session_checked_at';
const SESSION_CHECK_TTL = 10 * 60 * 1000;
const originalFetch = window.fetch.bind(window);

function readCachedUser(): any | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function authToken() {
  const user = readCachedUser();
  return typeof user?._authToken === 'string' ? user._authToken : '';
}

function sameOriginApi(input: RequestInfo | URL) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function installAuthenticatedFetch() {
  if (window.__echostarsFetchPatched) return;
  window.__echostarsFetchPatched = true;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const token = authToken();
    if (!token || !sameOriginApi(input)) return originalFetch(input, init);

    const baseHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init?.headers || baseHeaders || undefined);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    if (input instanceof Request) {
      return originalFetch(new Request(input, { ...init, headers }));
    }
    return originalFetch(input, { ...init, headers });
  }) as typeof window.fetch;
}

async function validateCachedSession() {
  const user = readCachedUser();
  if (!user) return;

  // Security migration: legacy localStorage identities were never backed by a
  // verified Google session. Force one clean Google sign-in after this release.
  if (!user._authToken) {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_CHECK_KEY);
    return;
  }

  const lastChecked = Number(sessionStorage.getItem(SESSION_CHECK_KEY) || 0);
  if (Date.now() - lastChecked < SESSION_CHECK_TTL) return;

  try {
    const response = await originalFetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${user._authToken}` },
      cache: 'no-store'
    });
    if (!response.ok) {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(SESSION_CHECK_KEY);
      window.location.reload();
      return;
    }
    sessionStorage.setItem(SESSION_CHECK_KEY, String(Date.now()));
  } catch {
    // Offline use remains available. Do not sign a user out merely because the
    // network is temporarily unavailable.
  }
}

let initialized = false;
let activeStatus: HTMLElement | null = null;

function setStatus(message: string, isError = false) {
  if (!activeStatus) return;
  activeStatus.textContent = message;
  activeStatus.style.display = message ? 'block' : 'none';
  activeStatus.style.color = isError ? '#e11d48' : '#64748b';
}

async function handleGoogleCredential(response: any) {
  const credential = String(response?.credential || '');
  if (!credential) {
    setStatus('Google 沒有回傳身分憑證，請再試一次。', true);
    return;
  }

  setStatus('正在驗證 Google 帳號…');
  try {
    const result = await originalFetch('/api/users/google-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
      cache: 'no-store'
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok || !data?.user || !data?.authToken) {
      throw new Error(data?.error || 'Google 登入失敗，請稍後重試。');
    }

    const user = {
      ...data.user,
      _authToken: data.authToken,
      _sessionExpiresAt: data.sessionExpiresAt
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(SESSION_CHECK_KEY, String(Date.now()));
    setStatus('登入成功，正在載入會員資料…');
    window.location.reload();
  } catch (error) {
    console.error('Secure Google sign-in failed:', error);
    setStatus(error instanceof Error ? error.message : 'Google 登入失敗，請稍後重試。', true);
  }
}

function ensureGoogleInitialized() {
  if (initialized) return true;
  if (!window.google?.accounts?.id) return false;
  try {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    initialized = true;
    return true;
  } catch (error) {
    console.error('Google Identity Services initialization failed:', error);
    return false;
  }
}

function isLegacyGoogleButton(button: HTMLButtonElement) {
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  return text.includes('使用 Google 帳戶登入 / 註冊') || text.includes('正在連線至 Google 授權');
}

function renderOfficialButton(legacyButton: HTMLButtonElement) {
  if (legacyButton.dataset.googleIdentityReplaced === '1') return;
  legacyButton.dataset.googleIdentityReplaced = '1';

  const wrapper = document.createElement('div');
  wrapper.dataset.echostarsGoogleIdentity = '1';
  wrapper.style.width = '100%';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';

  const buttonHost = document.createElement('div');
  buttonHost.style.minHeight = '44px';
  buttonHost.style.display = 'flex';
  buttonHost.style.justifyContent = 'center';
  buttonHost.style.alignItems = 'center';
  buttonHost.style.width = '100%';

  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.style.display = 'none';
  status.style.fontSize = '12px';
  status.style.lineHeight = '1.5';
  status.style.textAlign = 'center';
  wrapper.append(buttonHost, status);
  legacyButton.insertAdjacentElement('beforebegin', wrapper);
  legacyButton.style.display = 'none';
  activeStatus = status;

  const render = () => {
    if (!wrapper.isConnected) return;
    if (!ensureGoogleInitialized()) {
      setTimeout(render, 250);
      return;
    }
    const measured = Math.round(legacyButton.getBoundingClientRect().width || wrapper.getBoundingClientRect().width || 320);
    const width = Math.max(240, Math.min(400, measured));
    try {
      window.google.accounts.id.renderButton(buttonHost, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width
      });
    } catch (error) {
      console.error('Google sign-in button render failed:', error);
      setStatus('Google 登入元件載入失敗，請重新整理後再試。', true);
    }
  };
  render();
}

function scanForGoogleButton() {
  if (readCachedUser()) return;
  document.querySelectorAll('button').forEach(node => {
    const button = node as HTMLButtonElement;
    if (isLegacyGoogleButton(button)) renderOfficialButton(button);
  });
}

installAuthenticatedFetch();
void validateCachedSession();

const observer = new MutationObserver(scanForGoogleButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanForGoogleButton, { once: true });
} else {
  scanForGoogleButton();
}
