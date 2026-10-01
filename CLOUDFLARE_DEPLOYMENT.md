# 繁星的回聲 - Cloudflare 全端架構部屬指南

本專案已完整支援以 **Cloudflare Workers (後端執行環境) + D1 (分散式 SQLite 資料庫) + R2 (音訊與圖檔物件儲存) + KV (極速鍵值快取)** 架構部屬。

- **線上正式運行網址 (Cloudflare Workers)**: [https://echostars.yukidu.workers.dev](https://echostars.yukidu.workers.dev)
- **已綁定 R2 儲存桶**: `echoes-audio-bucket`
- **已綁定 D1 資料庫**: `echoes_db` (ID: `e0a696a9-0233-4186-be4d-229435b19a27`)
- **已綁定 KV 命名空間**: `KV` (ID: `a2e345e244cb40b4a804be3f89584b90`)

---

## 🛠️ 常見問題排查：解決 Cloudflare Pages / Workers CI「npm ci / EUSAGE」錯誤

如果在 Cloudflare 控制台的「組建」紀錄中看到：
```text
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @tailwindcss/oxide-android-arm64...
```

### 發生原因
Cloudflare 預設在偵測到 `package-lock.json` 時會執行嚴格的比對指令 `npm clean-install` (`npm ci`)。當跨平台原生可選依賴（如 macOS / Android / Linux 之 `@tailwindcss/oxide-*`、`lightningcss-*`）在不同系統生成時，npm 10 在 Node 24 環境下會嚴格中斷。

### 解決方案（已內建與控制台設定）
1. **專案內建修正**：
   - 專案已加入 `.npmrc`，設定 `legacy-peer-deps=true` 與 `package-lock=false`。
   - `.gitignore` 已將 `package-lock.json` 排除，避免將單一作業系統鎖定的相依版本推上 GitHub。

2. **Cloudflare 控制台「組建設定」調整**（若使用 GitHub 自動連動）：
   - 進入 Cloudflare 控制台 > **Workers 和 Pages** > 專案 `echostars` > **設定** > **組建與部署**。
   - 將 **組建命令 (Build command)** 修改為：
     ```bash
     npm install --legacy-peer-deps && npm run build
     ```
   - 或者在 **環境變數 (建置變數)** 中新增：
     ```text
     NPM_FLAGS = --legacy-peer-deps --no-package-lock
     ```
   - 儲存後點擊「重新組建」即可順暢部署！

---

## 🚀 手動一鍵部屬 (Wrangler CLI)

在已配置 `CLOUDFLARE_API_TOKEN` 或登入 Wrangler 的環境中，只需執行：

```bash
# 1. 編譯前端 React SPA
npm run build

# 2. 一鍵部屬至 Cloudflare Workers
npx wrangler deploy
```

---

## 🌟 架構特點與配對說明

| 元件 | 服務名稱 | 用途與說明 |
| :--- | :--- | :--- |
| **運算執行** | **Cloudflare Workers** | 處理 `/api/*` REST API 與邊緣路由分發，極速毫秒響應。 |
| **資料庫** | **Cloudflare D1** | 儲存會員名冊、音檔詳細中繼資料、評價星星、留言討論串與審核狀態。 |
| **物件儲存** | **Cloudflare R2** | 儲存大容量演講音訊 (MP3) 與講員頭像、自訂教材檔案，0 輸出傳輸費 (Zero Egress)。本機 dev server 與線上環境皆已支援直接同步上傳至 R2 儲存桶。 |
| **高速快取** | **Cloudflare KV** | 儲存每位會員的即時收聽進度秒數、VIP 專屬臨時連結驗證權杖。 |
| **前端靜態** | **Workers Assets / Pages** | 直接託管 Vite React 應用，支援全自動 PWA、音訊懸浮播放與離線快取。 |
