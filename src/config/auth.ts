/**
 * Google OAuth 2.0 Client ID Configuration
 *
 * 專案已綁定 Google Cloud Console 用戶端 ID (echostars 專案)。
 * 無需一般用戶手動輸入，直接內建生效。
 */
export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '400699489182-lb412nhvj4s6t1qr5ovkg40hc646dq79.apps.googleusercontent.com';
