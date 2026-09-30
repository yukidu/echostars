# 繁星的回聲 - Cloudflare 全端架構部屬指南

本專案已完整支援以 **Cloudflare Workers (後端執行環境) + D1 (分散式 SQLite 資料庫) + R2 (音訊與圖檔物件儲存) + KV (極速鍵值快取)** 架構部屬。

---

## 🚀 快速部屬 4 步驟

### 步驟 1：建立 D1 資料庫並匯入資料表結構
在終端機中執行：
```bash
# 1. 建立 D1 資料庫
npx wrangler d1 create echoes_db

# 執行完成後會顯示 database_id (例如: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
# 請將該 database_id 填入 wrangler.toml 中的 [[d1_databases]] database_id 欄位。

# 2. 執行 SQL 結構建立與初始數據種子
npx wrangler d1 execute echoes_db --file=./schema.sql
```

---

### 步驟 2：建立 R2 音訊物件儲存桶 (音檔與封面)
```bash
npx wrangler r2 bucket create echoes-audio-bucket
```

---

### 步驟 3：建立 KV 快取命名空間 (播放記憶與 VIP 權杖)
```bash
npx wrangler kv:namespace create KV

# 執行完成後會顯示 id (例如: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
# 請將該 id 填入 wrangler.toml 中的 [[kv_namespaces]] id 欄位。
```

---

### 步驟 4：編譯前端並一鍵部屬至 Cloudflare
```bash
# 1. 編譯前端 React SPA
npm run build

# 2. 部屬至 Cloudflare Workers
npx wrangler deploy
```

---

## 🌟 架構特點與配對說明

| 元件 | 服務名稱 | 用途與說明 |
| :--- | :--- | :--- |
| **運算執行** | **Cloudflare Workers** | 處理 `/api/*` REST API 與邊緣路由分發，極速毫秒響應。 |
| **資料庫** | **Cloudflare D1** | 儲存會員名冊、音檔詳細中繼資料、評價星星、留言討論串與審核狀態。 |
| **物件儲存** | **Cloudflare R2** | 儲存大容量演講音訊 (MP3) 與講員頭像、自訂教材檔案，0 輸出傳輸費 (Zero Egress)。 |
| **高速快取** | **Cloudflare KV** | 儲存每位會員的即時收聽進度秒數、VIP 專屬臨時連結驗證權杖。 |
| **前端靜態** | **Workers Assets / Pages** | 直接託管 Vite React 應用，支援全自動 PWA、音訊懸浮播放與離線快取。 |
