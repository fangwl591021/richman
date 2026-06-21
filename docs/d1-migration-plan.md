# Google Sheets 到 Cloudflare D1 遷移計畫

## 目標

把 `richman` 的正式資料來源從 Google Sheets / Apps Script 形態，逐步遷移到 Cloudflare D1。前端 action 名稱保持相容，降低一次性改版風險。

## 已新增檔案

- `wrangler.jsonc`：Worker + D1 binding 設定草案。
- `migrations/0001_init.sql`：D1 schema。
- `src/worker.js`：相容現有前端 action 的 D1-backed Worker。

## D1 資料表

| table | 用途 |
| --- | --- |
| `users` | LINE LIFF 使用者與補充資料 |
| `shops` | 店家資料、分類、審核狀態、優惠內容 |
| `coupons` | 使用者收藏、核銷、放棄的優惠券 |
| `cell_configs` | 大富翁格子設定，未來可取代 Google Sheets gviz 讀取 |
| `operation_logs` | 店家審核、刪除、優惠券操作等營運紀錄 |
| `product_categories` | 商品分類，可綁定店家 |
| `products` | 商品/品項資料、價格、庫存、上下架 |

## 相容 action

Worker 保留現有前端用到的 action：

- `getShops`
- `addShop`
- `updateShopStatus`
- `deleteShop`
- `saveUserProfile`
- `checkProfileComplete`
- `updateUserProfile`
- `saveCoupon`
- `getUserCoupons`
- `verifyCoupon`
- `abandonCoupon`
- `getProductCategories`
- `saveProductCategory`
- `getProducts`
- `saveProduct` / `addProduct`
- `updateProductStatus`
- `deleteProduct`

## 建議遷移順序

1. 建立 D1 database。
2. 把 `wrangler.jsonc` 的 `database_id` 換成真實 D1 ID。
3. 套用 migration。
4. 從 Google Sheet 匯出 CSV。
5. 清洗欄位並匯入 `shops`、`cell_configs`，必要時匯入既有 `users` / `coupons`。
6. 先用 staging Worker 驗證 action 回應格式。
7. 將 `config.js` 的 `API_BASE` 指向新的 Worker URL。
8. 驗證首頁、優惠券頁、店家申請、後台。
9. 停止 Google Sheets 寫入，只保留備份匯出。

## Wrangler 指令範例

```powershell
npx.cmd wrangler d1 create richman-db
npx.cmd wrangler d1 migrations apply richman-db --local
npx.cmd wrangler d1 migrations apply richman-db --remote
npx.cmd wrangler deploy --dry-run
```

正式部署前請確認 `wrangler.jsonc` 的 `database_id` 已替換，不要使用 `REPLACE_WITH_D1_DATABASE_ID`。

## 從 Google Sheet 匯入資料

目前 repo 尚未包含 Sheet 匯出檔。建議先匯出：

- 店家資料 -> `data/shops.csv`
- 格子設定 -> `data/cell_configs.csv`
- 既有優惠券或會員資料，如有 -> 分別匯出 CSV

匯入前需要做欄位對應：

| Sheet 欄位 | D1 欄位 |
| --- | --- |
| 店家名稱 / name | `shops.name` |
| 分類 / 店家分類 / category | `shops.category` |
| 圖示 / icon | `shops.icon` |
| 優惠內容 / discount | `shops.discount` |
| 地址 / mapUrl | `shops.address` |
| 加LINE連繫 / 加LINE 建模 / lineUrl | `shops.line_contact` |
| 圖片網址 / imageUrl | `shops.image_url` |
| 狀態 / status | `shops.status` |

## 注意事項

- `coupons.status` 只允許 `available`、`used`、`abandoned`。
- `shops.status` 只允許 `待核准`、`啟用`、`停用`、`已刪除`。
- 前端仍有 fallback 常數；正式切換時優先修改 `config.js`。
- 現有 Worker URL `https://richman.fangwl591021.workers.dev/` 是否已由別處管理尚未確認，部署前需避免覆蓋錯誤 Worker。
- D1 管理 action 已加入 admin token 驗證；正式使用前需設定 Worker secret ADMIN_TOKEN。
## 遠端 D1 建立紀錄

建立時間：2026-06-21

- database name：`richman-db`
- database id：`4e1edba6-f1b4-4057-b620-2457945b9a9d`
- region：APAC
- `wrangler.jsonc` 已填入 database id
- `npx.cmd wrangler d1 migrations apply richman-db --remote` 已成功套用 `0001_init.sql`
- `npx.cmd wrangler deploy --dry-run` 已通過，binding 為 `env.DB (richman-db)`
- 遠端表格已確認存在：`users`、`shops`、`coupons`、`cell_configs`、`operation_logs`

注意：尚未正式 `wrangler deploy`。部署前需確認目前 `richman.fangwl591021.workers.dev` 是否就是要被這份 Worker 接管的 production Worker。
## 商品資料表補充

已新增第二個 migration：`migrations/0002_product_catalog.sql`

商品資料設計：

- `product_categories`：商品分類，可選擇綁定 `shop_id`
- `products`：商品/品項主表，包含 `shop_id`、`category_id`、`sku`、名稱、說明、圖片、價格、幣別、庫存、單位、狀態、排序

商品狀態允許：

- `draft`
- `active`
- `inactive`
- `sold_out`
- `deleted`

建議用法：店家先在 `shops` 建立，再用 `shopId` 建立商品分類與商品。優惠券仍維持 `coupons`，不要把優惠券和商品混在同一張表。
## 商品表遠端部署紀錄

更新時間：2026-06-21

- 已套用 `migrations/0002_product_catalog.sql`
- 已部署 Worker version：`6f1fe2c5-68d9-49ce-8d23-6d830b56fa6b`
- 遠端 D1 已確認存在：`product_categories`、`products`
- Live smoke test 已通過：
  - `addShop` 建立測試店家
  - `saveProduct` 建立測試商品
  - `getProducts` 可讀回測試商品
  - `deleteProduct` soft-delete 測試商品
  - `deleteShop` soft-delete 測試店家

## D1 後台與匯入

新增頁面：`data_admin.html`

可直接查看：

- `shops`：店家
- `product_categories`：商品分類
- `products`：商品

需要 `ADMIN_TOKEN`：

- `getUsers`：會員清單
- `getCoupons`：全部優惠券，支援 `userId` 過濾
- `getOperationLogs`：操作紀錄
- `saveProductCategory`：新增/更新商品分類
- `saveProduct` / `addProduct`：新增/更新商品
- `updateProductStatus` / `deleteProduct`：商品上下架與刪除
- `updateShopStatus` / `deleteShop`：店家審核與刪除

設定方式：

```powershell
npx.cmd wrangler secret put ADMIN_TOKEN
npx.cmd wrangler deploy
```

CSV 匯入欄位：

- 店家：`id,name,category,icon,discount,address,lineContact,imageUrl,status,couponCount`
- 商品分類：`categoryId,shopId,name,description,status,sortOrder`
- 商品：`productId,shopId,categoryId,sku,name,description,imageUrl,price,currency,stockQty,unit,status,sortOrder`

`shopId` 必須先存在於 `shops`；商品分類的 `shopId` 可以留空，代表全域分類。

## Action 註冊戶名冊匯入

來源：`https://www.lineweb.tw/querycard`

Worker action：

- `previewActionRegistrants`：讀取 Action 註冊戶並轉換成 D1 `shops` 格式，不寫入。
- `importActionRegistrants`：讀取 Action 註冊戶並 upsert 到 `shops`。

兩個 action 都需要 `ADMIN_TOKEN`。舊的 `previewActionTenants` / `importActionTenants` 仍保留為相容別名。預設 Store ID：`5ff3798e9a2ae93e9d8da9a7`。

欄位對應：

| Action Flex JSON | D1 shops |
| --- | --- |
| 名片標題 | `name` |
| 查詢縣市/關鍵字 | `category`, `address` |
| 名片簡介 | `discount` |
| 第一張圖片 | `image_url` |
| LINE/好友按鈕 URI | `line_contact` |
| 分享 URI 的 `RR` 或穩定 hash | `id` |

預設匯入關鍵字：新北市、台北市、桃園市、新竹縣、新竹市、苗栗縣、南投縣、彰化縣、雲林縣、嘉義縣、嘉義市、台南市、高雄市、宜蘭縣、台東縣。