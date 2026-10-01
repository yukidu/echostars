/**
 * Google OAuth 2.0 Client ID Configuration
 *
 * 此處直接寫入專案的 Google OAuth Client ID，無需一般用戶手動輸入。
 * 若日後有新網域或更新的 Client ID，可在此檔案中修改，或透過環境變數 VITE_GOOGLE_CLIENT_ID 覆蓋。
 */
export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '1023793086940-echostars.apps.googleusercontent.com';
