# Richman 現況盤點

更新日期：2026-06-21

## Repo 狀態

- GitHub repo：`fangwl591021/richman`
- 本地分支：`main`
- 目前已有未提交修改：README、`common.js`、`coupon.html`、`index.html`、Ruflo 文件與 agent workflow。

## 技術型態

這是純靜態前端專案，沒有 package.json/build step。主要頁面直接以 HTML + inline JavaScript + `common.js` 運作。

正式 runtime 邊界：

```text
HTML / LIFF 前端
  -> Cloudflare Worker API
  -> Google Sheets / 後端資料
```

Ruflo 只建議作為工程流程與審查層，不進入正式 LIFF/Worker runtime。前端共用常數集中於 `config.js`。

## 頁面入口

| 檔案 | 用途 | 主要依賴 |
| --- | --- | --- |
| `index.html` | 遊戲主頁、骰子、格子事件、收藏優惠 | LIFF SDK、`common.js?v=2.1`、Worker API、Google Sheets 格子設定 |
| `coupon.html` | 我的優惠券、核銷、放棄、LINE/地圖按鈕 | LIFF SDK、`common.js?v=2.1`、Worker API |
| `login.html` | 獨立 LINE LIFF 登入與補充資料 | LIFF SDK、Worker API |
| `register.html` | 註冊資料頁 | `common.js?v=2.1` |
| `shop_apply.html` | 店家進駐申請 | Worker API |
| `Admin.html` | 店家審核、上架名單、刪除、診斷 | Worker API |

## 外部端點與常數

| 項目 | 值 |
| --- | --- |
| Worker API | `https://richman.fangwl591021.workers.dev/`，來源集中於 `config.js` |
| LIFF ID | `2008231249-7DlMkygo` |
| Google Sheet ID | `1-qvp5x8VJa_vFULJy8dfT3FjQwLDkGV8ECyeCiwJpkU` |
| 格子設定 GID | `106466612` |
| 店家地圖 | `https://aiwe.cc/index.php/linecard_12/1460/?share=1` |

## Worker API action 清單

| action | 呼叫來源 | 方法 | 用途 |
| --- | --- | --- | --- |
| `getShops` | `common.js`, `Admin.html` | GET | 取得店家資料 |
| `getUserCoupons` | `common.js` | GET | 取得使用者優惠券 |
| `saveCoupon` | `common.js` | POST FormData | 收藏優惠券 |
| `verifyCoupon` | `common.js` | POST FormData | 核銷優惠券 |
| `abandonCoupon` | `common.js`, `coupon.html` | POST FormData | 放棄優惠券 |
| `saveUserProfile` | `login.html` | POST FormData | 儲存 LIFF 使用者資料 |
| `checkProfileComplete` | `login.html` | GET | 檢查補充資料是否完整 |
| `updateUserProfile` | `login.html` | POST FormData | 更新性別/地區 |
| `addShop` | `shop_apply.html` | POST FormData | 店家申請，初始 `待核准` |
| `updateShopStatus` | `Admin.html` | POST urlencoded | 核准店家、改成 `啟用` |
| `deleteShop` | `Admin.html` | POST urlencoded | 刪除店家 |

## 已發現的優先問題

1. 已完成：`register.html` 已同步載入 `common.js?v=2.1`。
2. 已完成：`Admin.html` 店家資料輸出已補 HTML escape。
3. 已完成：`Admin.html` 刪除失敗已補 alert。
4. 已完成：`shop_apply.html` 已補 HTTP 非 2xx 與 JSON parse 錯誤處理。
5. 已完成：`coupon.html` 的 fallback 模擬 `verifyCoupon/loadCoupons` 已限制為 `DEV_MODE`，正式模式不再顯示假優惠券或假核銷成功。
6. 多個檔案重複硬編 Worker URL，後續可集中到 `common.js` 或文件化更新規則。

## 下一步建議

第 2 階段「安全修正」建議先做：

1. 已完成：同步 `register.html` 的 `common.js?v=2.1`。
2. 已完成：為 `Admin.html` 補 HTML escape 與安全 onclick 參數。
3. 已完成：為 `Admin.html` 刪除失敗補明確 alert。
4. 已完成：為 `shop_apply.html` 補 `response.ok` 檢查。
5. 已完成：保留 `coupon.html` 模擬資料 fallback，但只在 URL `?dev=1` 或 `localStorage.richmanDevMode=1` 時啟用。
## 第 2 階段完成紀錄

已完成安全修正 1-5：

1. `register.html` 已同步為 `common.js?v=2.1`。
2. `Admin.html` 已補 `escapeHtml()`，店家名稱、分類、優惠內容、狀態、圖示輸出前會先轉義。
3. `Admin.html` 的 `approveShop()` / `deleteShop()` inline onclick 參數已改用安全轉義。
4. `Admin.html` 的 `deleteShop()` 失敗時會顯示明確錯誤訊息。
5. `shop_apply.html` 已補 `response.ok` 與 JSON parse 錯誤處理，避免 Worker 非 2xx 或非 JSON 回應時產生不明錯誤。

尚未處理：

- 已決策：`coupon.html` demo fallback 保留，但只允許 DEV_MODE 啟用。
- 已完成：Worker URL、LIFF ID、地圖 URL 已集中於 `config.js`，各頁保留 fallback 常數。
## DEV_MODE 使用方式

`coupon.html` 的模擬優惠券 fallback 只在開發模式啟用：

- URL 加上 `?dev=1`
- 或在瀏覽器 console 設定 `localStorage.setItem('richmanDevMode', '1')`

正式模式下，如果 `common.js` 未載入，優惠券頁會回傳空資料並拒絕模擬核銷，避免使用者看到假資料。
## 共用前端設定

`config.js` 提供：

- `window.RICHMAN_CONFIG.API_BASE`
- `window.RICHMAN_CONFIG.LIFF_ID`
- `window.RICHMAN_CONFIG.MAP_URL`

目前已載入於 `index.html`、`coupon.html`、`register.html`、`login.html`、`Admin.html`、`shop_apply.html`。各頁仍保留原始常數 fallback，避免 `config.js` 載入失敗時立即中斷。
## 第 2 階段第 7 項完成紀錄

已新增 `config.js` 統一前端常數：

- `API_BASE`
- `LIFF_ID`
- `MAP_URL`

已接入頁面與檔案：

- `common.js` 使用 `window.RICHMAN_CONFIG.API_BASE` 與 `LIFF_ID`
- `index.html`、`coupon.html`、`register.html` 先載入 `config.js` 再載入 `common.js`
- `login.html` 使用 `RICHMAN_CONFIG.LIFF_ID` 與 `RICHMAN_CONFIG.API_BASE`
- `Admin.html` 使用 `RICHMAN_CONFIG.API_BASE`
- `shop_apply.html` 使用 `RICHMAN_CONFIG.API_BASE`

各檔仍保留原始常數 fallback，避免 `config.js` 載入失敗時立即中斷頁面流程。
