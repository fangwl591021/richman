# Ruflo 導入分析與改進計畫

## 結論

`ruvnet/ruflo` 適合導入到本專案的工程協作流程，不適合作為 `richman` 的正式執行 runtime。

目前 `richman` 是靜態 LIFF/HTML 前端，正式資料流是：

```text
LINE LIFF / GitHub Pages HTML
  -> Cloudflare Worker API
  -> Google Sheets / 後端資料
```

Ruflo 的定位應放在這條正式資料流之外：協助拆任務、產生測試、做安全審查、維護文件、規劃改版與檢查部署前風險。玩家登入、優惠券收藏/核銷、店家申請、後台審核仍應維持由 LIFF + Worker API 負責。

## Ruflo 可帶來的價值

依照 `ruvnet/ruflo` README，Ruflo 是 Claude Code / Codex 的 multi-agent AI harness，重點能力包含 agents、swarm coordination、memory、RAG、workflow、browser testing、test generation、docs、security audit、observability 與 cost tracking。

對 `richman` 最有價值的是下列幾類：

1. `ruflo-workflows`：把常見改版流程固化，例如「新增優惠券欄位」「調整店家申請欄位」「發布前檢查」。
2. `ruflo-browser`：用瀏覽器自動測首頁、優惠券頁、後台頁是否能載入、按鈕是否存在、關鍵流程是否中斷。
3. `ruflo-testgen`：補靜態頁內 JavaScript 的語法與資料轉換測試。
4. `ruflo-docs`：維護 README、API 欄位對照、營運交接文件。
5. `ruflo-security-audit` / `ruflo-aidefence`：檢查外部資料輸出到 HTML、管理後台操作、token/secret 洩漏風險。
6. `ruflo-observability`：規劃 Worker 端的操作記錄、錯誤回報與診斷欄位，但實作仍放在 Worker。

## 不建議導入的部分

- 不把 Ruflo 放進 `index.html`、`coupon.html` 或 LIFF 頁面。
- 不讓 Ruflo 直接處理 LINE Webhook reply 或 coupon verify runtime。
- 不把使用者資料、LINE UID、優惠券核銷狀態存進 Ruflo memory。
- 不用 Ruflo 取代 Cloudflare Worker、Google Sheets 或正式資料庫。

原因是這些屬於正式線上交易流程，需要可控、可回放、可部署、可監控的 runtime。Ruflo 更適合做開發與營運輔助層。

## 建議導入方式

### 第 1 階段：只導入工程流程，不安裝到 production

在開發機或 agent 環境使用 Ruflo。Windows PowerShell 可依官方 README 使用：

```powershell
npx ruflo@latest init wizard
```

若只想試 Claude Code plugin 路徑，README 也列出 marketplace/plugin install 方式；但它是 lite 模式，不會註冊完整 MCP server。完整 loop 需要 CLI init。

### 第 2 階段：建立 Richman 專用工作流

建議把 Ruflo 任務固定成這些工作流：

- `richman-release-check`：發布前檢查 HTML script 語法、連結、版本參數、README 是否更新。
- `coupon-flow-review`：檢查核銷/放棄是否只在後端成功時改本地狀態。
- `liff-login-review`：檢查頁面是否覆蓋 `common.js` 的 LIFF login 函式。
- `merchant-data-safety`：檢查店家名稱、優惠文字、圖片 URL、LINE/地圖連結是否安全輸出。
- `admin-ops-review`：檢查後台刪除/核准操作是否有確認、錯誤訊息與重載狀態。

### 第 3 階段：把 runtime 觀測補在 Worker

Ruflo 可用來規劃與檢查，但真正需要改的是 Worker API：

- 每次 `saveCoupon`、`verifyCoupon`、`abandonCoupon` 都應回傳一致 JSON：`success/status/message/couponId`。
- 後端錯誤應有 request id，前端 alert 可提示營運人員追查。
- 後台操作應記錄 operator、shopId、action、result、timestamp。
- 優惠券狀態以後端為準，本地 `localStorage` 只作 UI 快取。

## 本次已對 Richman 做的配套改進

- README 已補上專案入口、後端依賴、檢查方式與維護注意。
- 首頁已移除假登入覆蓋，改回使用 `common.js` 的正式 LIFF flow。
- 優惠券核銷/放棄已調整為後端失敗不回報成功。
- 優惠券列表已對店家資料做基本 HTML 輸出防護。

## 後續導入清單

```text
[ ] 決定是否在開發機安裝 Ruflo CLI
[ ] 建立 richman-release-check 工作流
[ ] 建立 coupon-flow-review 工作流
[ ] 建立 merchant-data-safety 工作流
[ ] 為 Worker API 補 request id 與操作紀錄
[ ] 用瀏覽器自動化檢查 index/coupon/Admin/shop_apply
[ ] 發布前跑 git diff --check 與 HTML script syntax check
```

## 參考

- https://github.com/ruvnet/ruflo
- https://github.com/fangwl591021/richman