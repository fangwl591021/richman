# Richman 歡樂大富翁

LINE LIFF 靜態前端，用於大富翁式商圈遊戲、優惠券收藏/核銷、店家申請與後台審核。前端直接部署到 GitHub Pages 或任何靜態主機，資料 API 由 Cloudflare Worker 提供。

## 頁面入口

- `index.html`：遊戲主頁、LINE 登入、骰子與格子事件。
- `coupon.html`：我的優惠券、核銷、放棄、LINE 聯繫與地圖開啟。
- `login.html`：獨立 LIFF 登入與補充資料流程。
- `register.html`：註冊資料頁。
- `shop_apply.html`：店家進駐申請。
- `Admin.html`：店家審核與資料診斷後台。
- `common.js`：共用 LIFF、店家、優惠券與通知函式。
- `config.js`：前端共用 Worker API、LIFF ID、地圖 URL 設定。

## 後端與外部依賴

- Worker API：`https://richman.fangwl591021.workers.dev/`（集中於 `config.js`）
- LIFF ID：`2008231249-7DlMkygo`
- 格子設定來源：Google Sheets gviz JSON
- 店家地圖：`https://aiwe.cc/index.php/linecard_12/1460/?share=1`

## 本機檢查

這是純靜態專案，可直接開啟 HTML 檔。若要用本機伺服器檢查：

```powershell
python -m http.server 8080
```

再開啟 `http://localhost:8080/index.html`。

## 維護注意

- `index.html` 不應覆蓋 `common.js` 的 `startLineLogin()`，否則正式 LIFF 登入會變成假登入。
- 優惠券核銷/放棄只有後端成功時才應更新本地狀態，避免營運資料和前端顯示不同步。
- 從 API 或試算表回來的店家名稱、優惠內容、圖片 URL 要先轉義或驗證再輸出到 HTML。
## Ruflo 導入

- 現況盤點：`docs/current-state-inventory.md`
- D1 遷移計畫：`docs/d1-migration-plan.md`
- 導入分析：`docs/ruflo-integration.md`
- Agent 工作流：`.agents/richman-ruflo-workflows.md`

Ruflo 建議作為工程流程與審查層使用，不放進 LIFF 前端或正式 Worker runtime。

共用前端設定由 `config.js?v=1.0` 提供，更新 Worker API、LIFF ID 或地圖 URL 時優先改此檔。
