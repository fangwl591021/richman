const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-token'
};

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function badRequest(message, extra = {}) {
  return json({ success: false, status: 'error', message, ...extra }, 400);
}

function unauthorized() {
  return json({ success: false, status: 'error', message: '需要管理員權限' }, 401);
}

function getLimit(input, fallback = 100, max = 500) {
  const value = Number(getField(input, 'limit'));
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function hasAdminAccess(request, input, env) {
  const token = request.headers.get('x-admin-token') || getField(input, 'adminToken');
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}


const ACTION_MEMBERLIST_STORE_ID = '5ff3798e9a2ae93e9d8da9a7';
const ACTION_MEMBERLIST_KEYWORDS = [
  '新北市', '台北市', '桃園市', '新竹縣', '新竹市', '苗栗縣', '南投縣', '彰化縣',
  '雲林縣', '嘉義縣', '嘉義市', '台南市', '高雄市', '宜蘭縣', '台東縣'
];

function splitKeywords(input) {
  const raw = getField(input, 'keywords', 'keyword', 'city');
  if (!raw) return ACTION_MEMBERLIST_KEYWORDS;
  return raw.split(/[\s,，、]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\\u003cBR\\u003e/gi, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stableHash(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function findFlexText(node, options = {}) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text' && typeof node.text === 'string') {
    if (!options.size || node.size === options.size) return normalizeText(node.text);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFlexText(item, options);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = findFlexText(value, options);
      if (found) return found;
    }
  }
  return '';
}

function findFlexImage(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'image' && typeof node.url === 'string') return node.url;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFlexImage(item);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = findFlexImage(value);
      if (found) return found;
    }
  }
  return '';
}

function collectFlexButtons(node, buttons = []) {
  if (!node || typeof node !== 'object') return buttons;
  if (node.type === 'button' && node.action) buttons.push(node.action);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => collectFlexButtons(item, buttons));
    else if (value && typeof value === 'object') collectFlexButtons(value, buttons);
  }
  return buttons;
}

function extractActionTenant(row, keyword) {
  let flex;
  try {
    flex = JSON.parse(row.DataID || '{}');
  } catch (_) {
    return null;
  }
  const bubble = flex.contents && flex.contents[0] ? flex.contents[0] : flex;
  const title = findFlexText(bubble, { size: 'xl' }) || findFlexText(bubble);
  if (!title) return null;
  const description = normalizeText(findFlexText(bubble, { size: 'xs' }));
  const imageUrl = findFlexImage(bubble);
  const buttons = collectFlexButtons(bubble);
  const lineButton = buttons.find((button) => /line|好友|官方/i.test(`${button.label || ''} ${button.uri || ''}`)) || buttons[0] || {};
  const shareButton = buttons.find((button) => /liff\.line\.me/.test(button.uri || '')) || {};
  const rr = new URL(shareButton.uri || 'https://example.invalid/').searchParams.get('RR') || '';
  const tenantId = `action_${rr || stableHash(`${keyword}:${title}:${imageUrl}`)}`;
  return {
    id: tenantId,
    name: title,
    category: keyword,
    icon: '🏪',
    discount: description || 'Action 註冊戶名冊匯入',
    address: keyword,
    lineContact: lineButton.uri || '',
    imageUrl,
    status: '啟用',
    couponCount: 100
  };
}

async function fetchActionTenants(keyword, storeId = ACTION_MEMBERLIST_STORE_ID) {
  const form = new FormData();
  form.append('edtKeyword', keyword);
  form.append('edtStore', storeId);
  const response = await fetch('https://www.lineweb.tw/querycard', { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ResultStatus !== 'Success') {
    throw new Error(`Action 註冊戶讀取失敗: ${keyword}`);
  }
  return (payload.ResultData || []).map((row) => extractActionTenant(row, keyword)).filter(Boolean);
}
function parseJsonField(input, key) {
  const raw = getField(input, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${key} JSON 格式錯誤: ${error.message}`);
  }
}

function safeJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return {}; }
}

function normalizeLineActionCard(card) {
  const cfg = safeJsonObject(card['自訂名片設定'] || card.customCardConfig || card.cardConfig);
  const rowId = String(card.rowId || card.id || card['名片ID'] || card['會員ID'] || '').trim();
  const name = String(card['公司名稱'] || card.company || card.companyName || card['姓名'] || card.name || '').trim();
  if (!name) return null;
  const person = String(card['姓名'] || card.name || '').trim();
  const title = String(card['職稱'] || card.title || '').trim();
  const desc = String(cfg.desc || card['服務項目'] || card.description || card['備註'] || '').trim();
  const phone = String(card['手機號碼'] || card.phone || card.mobile || card['公司電話'] || '').trim();
  const lineId = String(card['LINE ID'] || card.lineId || card.userId || '').trim();
  const firstButton = Array.isArray(cfg.buttons) ? cfg.buttons.find((button) => button && button.u) : null;
  const lineContact = firstButton?.u || (lineId ? `line:${lineId}` : phone ? `tel:${phone}` : '');
  const imageUrl = String(cfg.imgUrl || cfg.imgUrlLandscape || card['名片圖檔'] || card.imageUrl || '').trim();
  const network = String(card['歸屬網'] || card.networkId || card.storeId || 'Action').trim();
  const shopId = `line_action_${rowId || stableHash(`${name}:${person}:${phone}:${imageUrl}`)}`;
  return {
    id: shopId,
    name,
    category: network,
    icon: '🏪',
    discount: desc || [person, title].filter(Boolean).join(' / ') || 'LINE- Action 註冊戶匯入',
    address: network,
    lineContact,
    imageUrl,
    status: '啟用',
    couponCount: 100,
    source: 'LINE-/admin.html'
  };
}

async function upsertShop(env, shop, timestamp = nowIso()) {
  await env.DB.prepare(`
    INSERT INTO shops (id, name, category, icon, discount, address, line_contact, image_url, status, coupon_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      icon = excluded.icon,
      discount = excluded.discount,
      address = excluded.address,
      line_contact = excluded.line_contact,
      image_url = excluded.image_url,
      status = excluded.status,
      coupon_count = excluded.coupon_count,
      updated_at = excluded.updated_at
  `).bind(
    shop.id,
    shop.name,
    shop.category,
    shop.icon || '🏪',
    shop.discount || '',
    shop.address || '',
    shop.lineContact || '',
    shop.imageUrl || '',
    shop.status || '啟用',
    Number(shop.couponCount) || 100,
    timestamp,
    timestamp
  ).run();
}
function getField(input, ...keys) {
  for (const key of keys) {
    const value = input.get ? input.get(key) : input[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

async function readInput(request) {
  if (request.method === 'GET') return new URL(request.url).searchParams;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return body || {};
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(await request.text());
  }
  return await request.formData();
}

async function logOperation(env, entry) {
  try {
    await env.DB.prepare(`
      INSERT INTO operation_logs (id, action, actor_user_id, target_type, target_id, result, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id('log'),
      entry.action || '',
      entry.actor_user_id || '',
      entry.target_type || '',
      entry.target_id || '',
      entry.result || '',
      entry.message || '',
      JSON.stringify(entry.metadata || {}),
      nowIso()
    ).run();
  } catch (error) {
    console.error('operation log failed', error);
  }
}

async function ensureUser(env, userId, profile = {}) {
  if (!userId) return;
  await env.DB.prepare(`
    INSERT INTO users (user_id, display_name, picture_url, status_message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = COALESCE(NULLIF(excluded.display_name, ''), users.display_name),
      picture_url = COALESCE(NULLIF(excluded.picture_url, ''), users.picture_url),
      status_message = COALESCE(NULLIF(excluded.status_message, ''), users.status_message),
      updated_at = excluded.updated_at
  `).bind(
    userId,
    profile.displayName || '',
    profile.pictureUrl || '',
    profile.statusMessage || '',
    nowIso(),
    nowIso()
  ).run();
}

async function getShops(env) {
  const { results } = await env.DB.prepare(`
    SELECT
      id,
      name,
      name AS '店家名稱',
      category,
      category AS '分類',
      category AS '店家分類',
      icon,
      icon AS '圖示',
      discount,
      discount AS '優惠內容',
      address,
      address AS '地址',
      line_contact AS lineContact,
      line_contact AS '加LINE連繫',
      line_contact AS '加LINE 建模',
      image_url AS imageUrl,
      image_url AS '圖片網址',
      status,
      status AS '狀態',
      coupon_count AS couponCount
    FROM shops
    WHERE status != '已刪除'
    ORDER BY CASE status WHEN '待核准' THEN 0 WHEN '啟用' THEN 1 ELSE 2 END, updated_at DESC
  `).all();
  return json({ success: true, status: 'success', data: results || [] });
}

async function addShop(env, input, ctx) {
  const shopId = getField(input, 'id', 'shopId') || id('shop');
  const name = getField(input, 'name', '店家名稱');
  if (!name) return badRequest('缺少店家名稱');
  const createdAt = nowIso();
  await env.DB.prepare(`
    INSERT INTO shops (id, name, category, icon, discount, address, line_contact, image_url, status, coupon_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    shopId,
    name,
    getField(input, 'category', '分類', '店家分類'),
    getField(input, 'icon', '圖示') || '🏪',
    getField(input, 'discount', '優惠內容'),
    getField(input, 'address', '地址', 'mapUrl'),
    getField(input, 'lineContact', 'lineUrl', '加LINE連繫', '加LINE 建模'),
    getField(input, 'imageUrl', '圖片網址'),
    getField(input, 'status', '狀態') || '待核准',
    Number(getField(input, 'couponCount')) || 100,
    createdAt,
    createdAt
  ).run();
  ctx.waitUntil(logOperation(env, { action: 'addShop', target_type: 'shop', target_id: shopId, result: 'success' }));
  return json({ success: true, status: 'success', id: shopId, message: '店家申請已建立' });
}

async function updateShopStatus(env, input, ctx) {
  const shopId = getField(input, 'shopId', 'id');
  const status = getField(input, 'status', '狀態') || '啟用';
  if (!shopId) return badRequest('缺少 shopId');
  const result = await env.DB.prepare(`UPDATE shops SET status = ?, updated_at = ? WHERE id = ?`).bind(status, nowIso(), shopId).run();
  const ok = result.meta.changes > 0;
  ctx.waitUntil(logOperation(env, { action: 'updateShopStatus', target_type: 'shop', target_id: shopId, result: ok ? 'success' : 'not_found', message: status }));
  return json({ success: ok, status: ok ? 'success' : 'error', message: ok ? '狀態已更新' : '找不到店家' }, ok ? 200 : 404);
}

async function deleteShop(env, input, ctx) {
  const shopId = getField(input, 'shopId', 'id');
  if (!shopId) return badRequest('缺少 shopId');
  const result = await env.DB.prepare(`UPDATE shops SET status = '已刪除', updated_at = ? WHERE id = ?`).bind(nowIso(), shopId).run();
  const ok = result.meta.changes > 0;
  ctx.waitUntil(logOperation(env, { action: 'deleteShop', target_type: 'shop', target_id: shopId, result: ok ? 'success' : 'not_found' }));
  return json({ success: ok, status: ok ? 'success' : 'error', message: ok ? '店家已刪除' : '找不到店家' }, ok ? 200 : 404);
}

async function saveUserProfile(env, input, ctx) {
  const userId = getField(input, 'userId', 'lineUserId');
  if (!userId) return badRequest('缺少 userId');
  await ensureUser(env, userId, {
    displayName: getField(input, 'displayName', 'lineDisplayName'),
    pictureUrl: getField(input, 'pictureUrl', 'linePictureUrl'),
    statusMessage: getField(input, 'statusMessage')
  });
  ctx.waitUntil(logOperation(env, { action: 'saveUserProfile', actor_user_id: userId, target_type: 'user', target_id: userId, result: 'success' }));
  return json({ success: true, status: 'success', message: '使用者已儲存' });
}

async function updateUserProfile(env, input, ctx) {
  const userId = getField(input, 'userId', 'lineUserId');
  if (!userId) return badRequest('缺少 userId');
  await ensureUser(env, userId);
  await env.DB.prepare(`
    UPDATE users SET gender = ?, county = ?, profile_complete = 1, updated_at = ? WHERE user_id = ?
  `).bind(getField(input, 'gender'), getField(input, 'county'), nowIso(), userId).run();
  ctx.waitUntil(logOperation(env, { action: 'updateUserProfile', actor_user_id: userId, target_type: 'user', target_id: userId, result: 'success' }));
  return json({ success: true, status: 'success', complete: true, message: '資料已更新' });
}

async function checkProfileComplete(env, input) {
  const userId = getField(input, 'userId', 'lineUserId');
  if (!userId) return badRequest('缺少 userId');
  const user = await env.DB.prepare(`SELECT profile_complete, gender, county FROM users WHERE user_id = ?`).bind(userId).first();
  const complete = !!(user && user.profile_complete === 1 && user.gender && user.county);
  return json({ success: true, status: 'success', complete });
}

async function saveCoupon(env, input, ctx) {
  const userId = getField(input, 'userId', 'lineUserId');
  if (!userId) return badRequest('缺少 userId');
  await ensureUser(env, userId);
  const couponId = getField(input, 'couponId', 'id') || id('coupon');
  await env.DB.prepare(`
    INSERT INTO coupons (id, user_id, shop_id, shop_name, discount, image_url, line_contact, address, status, obtained_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)
  `).bind(
    couponId,
    userId,
    getField(input, 'shopId'),
    getField(input, 'shopName', '店家名稱'),
    getField(input, 'discount', '優惠內容'),
    getField(input, 'imageUrl', '圖片網址'),
    getField(input, 'lineContact', 'lineUrl', '加LINE連繫', '加LINE 建模'),
    getField(input, 'address', 'mapUrl', '地址'),
    nowIso(),
    nowIso()
  ).run();
  ctx.waitUntil(logOperation(env, { action: 'saveCoupon', actor_user_id: userId, target_type: 'coupon', target_id: couponId, result: 'success' }));
  return json({ success: true, status: 'success', couponId, message: '優惠券已收藏' });
}

async function getUserCoupons(env, input) {
  const userId = getField(input, 'userId', 'lineUserId');
  if (!userId) return json({ success: true, status: 'success', coupons: [] });
  const { results } = await env.DB.prepare(`
    SELECT
      id,
      id AS couponId,
      shop_id AS shopId,
      shop_name AS '店家名稱',
      shop_name AS shopName,
      discount AS '優惠內容',
      discount,
      image_url AS '圖片網址',
      image_url AS imageUrl,
      line_contact AS '加LINE連繫',
      line_contact AS F,
      address AS '地址',
      address AS G,
      obtained_at AS obtainedDate,
      CASE status WHEN 'used' THEN 1 WHEN 'abandoned' THEN 'abandoned' ELSE 0 END AS used
    FROM coupons
    WHERE user_id = ?
    ORDER BY obtained_at DESC
  `).bind(userId).all();
  return json({ success: true, status: 'success', coupons: results || [] });
}

async function getUsers(env, input) {
  const limit = getLimit(input, 100, 500);
  const { results } = await env.DB.prepare(`
    SELECT
      user_id AS userId,
      display_name AS displayName,
      picture_url AS pictureUrl,
      status_message AS statusMessage,
      gender,
      county,
      profile_complete AS profileComplete,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({ success: true, status: 'success', users: results || [], data: results || [] });
}

async function getCoupons(env, input) {
  const userId = getField(input, 'userId', 'lineUserId');
  const limit = getLimit(input, 100, 500);
  const { results } = await env.DB.prepare(`
    SELECT
      id,
      id AS couponId,
      user_id AS userId,
      shop_id AS shopId,
      shop_name AS shopName,
      discount,
      image_url AS imageUrl,
      line_contact AS lineContact,
      address,
      status,
      obtained_at AS obtainedAt,
      used_at AS usedAt,
      abandoned_at AS abandonedAt,
      updated_at AS updatedAt
    FROM coupons
    WHERE (? = '' OR user_id = ?)
    ORDER BY obtained_at DESC
    LIMIT ?
  `).bind(userId, userId, limit).all();
  return json({ success: true, status: 'success', coupons: results || [], data: results || [] });
}

async function getOperationLogs(env, input) {
  const limit = getLimit(input, 100, 500);
  const { results } = await env.DB.prepare(`
    SELECT
      id,
      action,
      actor_user_id AS actorUserId,
      target_type AS targetType,
      target_id AS targetId,
      result,
      message,
      metadata,
      created_at AS createdAt
    FROM operation_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({ success: true, status: 'success', logs: results || [], data: results || [] });
}
async function updateCouponStatus(env, input, status, ctx) {
  const userId = getField(input, 'userId', 'lineUserId');
  const couponId = getField(input, 'couponId', 'id');
  if (!userId || !couponId) return badRequest('缺少 userId 或 couponId');

  const stampColumn = status === 'used' ? 'used_at' : 'abandoned_at';
  const result = await env.DB.prepare(`
    UPDATE coupons SET status = ?, ${stampColumn} = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'available'
  `).bind(status, nowIso(), nowIso(), couponId, userId).run();

  if (result.meta.changes > 0) {
    ctx.waitUntil(logOperation(env, { action: status === 'used' ? 'verifyCoupon' : 'abandonCoupon', actor_user_id: userId, target_type: 'coupon', target_id: couponId, result: 'success' }));
    return json({ success: true, status: 'success', message: '優惠券狀態已更新' });
  }

  const existing = await env.DB.prepare(`SELECT status FROM coupons WHERE id = ? AND user_id = ?`).bind(couponId, userId).first();
  if (existing) {
    ctx.waitUntil(logOperation(env, { action: status === 'used' ? 'verifyCoupon' : 'abandonCoupon', actor_user_id: userId, target_type: 'coupon', target_id: couponId, result: 'already_processed' }));
    return json({ success: false, status: 'error', message: '優惠券已經處理' });
  }

  ctx.waitUntil(logOperation(env, { action: status === 'used' ? 'verifyCoupon' : 'abandonCoupon', actor_user_id: userId, target_type: 'coupon', target_id: couponId, result: 'not_found' }));
  return json({ success: false, status: 'error', message: '找不到優惠券' }, 404);
}

async function getProductCategories(env, input) {
  const shopId = getField(input, 'shopId', 'shop_id');
  const includeDeleted = getField(input, 'includeDeleted') === '1';
  let query = `
    SELECT
      id,
      shop_id AS shopId,
      name,
      name AS '商品分類',
      description,
      status,
      sort_order AS sortOrder,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM product_categories
    WHERE (? = '' OR shop_id = ?)
  `;
  if (!includeDeleted) query += ` AND status != 'deleted'`;
  query += ` ORDER BY sort_order ASC, created_at ASC`;
  const { results } = await env.DB.prepare(query).bind(shopId, shopId).all();
  return json({ success: true, status: 'success', categories: results || [], data: results || [] });
}

async function saveProductCategory(env, input, ctx) {
  const categoryId = getField(input, 'categoryId', 'id') || id('pcat');
  const name = getField(input, 'name', '商品分類', 'category');
  if (!name) return badRequest('缺少商品分類名稱');
  const timestamp = nowIso();
  await env.DB.prepare(`
    INSERT INTO product_categories (id, shop_id, name, description, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shop_id = excluded.shop_id,
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).bind(
    categoryId,
    getField(input, 'shopId', 'shop_id'),
    name,
    getField(input, 'description', '分類說明'),
    getField(input, 'status') || 'active',
    Number(getField(input, 'sortOrder', 'sort_order')) || 0,
    timestamp,
    timestamp
  ).run();
  ctx.waitUntil(logOperation(env, { action: 'saveProductCategory', target_type: 'product_category', target_id: categoryId, result: 'success' }));
  return json({ success: true, status: 'success', categoryId, id: categoryId, message: '商品分類已儲存' });
}

async function getProducts(env, input) {
  const shopId = getField(input, 'shopId', 'shop_id');
  const categoryId = getField(input, 'categoryId', 'category_id');
  const includeDeleted = getField(input, 'includeDeleted') === '1';
  let query = `
    SELECT
      p.id,
      p.shop_id AS shopId,
      p.category_id AS categoryId,
      pc.name AS categoryName,
      p.sku,
      p.name,
      p.name AS '商品名稱',
      p.description,
      p.description AS '商品說明',
      p.image_url AS imageUrl,
      p.image_url AS '圖片網址',
      p.price,
      p.price AS '價格',
      p.currency,
      p.stock_qty AS stockQty,
      p.stock_qty AS '庫存',
      p.unit,
      p.unit AS '單位',
      p.status,
      p.status AS '狀態',
      p.sort_order AS sortOrder,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE (? = '' OR p.shop_id = ?)
      AND (? = '' OR p.category_id = ?)
  `;
  if (!includeDeleted) query += ` AND p.status != 'deleted'`;
  query += ` ORDER BY p.sort_order ASC, p.created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(shopId, shopId, categoryId, categoryId).all();
  return json({ success: true, status: 'success', products: results || [], data: results || [] });
}

async function saveProduct(env, input, ctx) {
  const productId = getField(input, 'productId', 'id') || id('product');
  const shopId = getField(input, 'shopId', 'shop_id');
  const name = getField(input, 'name', '商品名稱');
  if (!shopId) return badRequest('缺少 shopId');
  if (!name) return badRequest('缺少商品名稱');
  const timestamp = nowIso();
  await env.DB.prepare(`
    INSERT INTO products (id, shop_id, category_id, sku, name, description, image_url, price, currency, stock_qty, unit, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shop_id = excluded.shop_id,
      category_id = excluded.category_id,
      sku = excluded.sku,
      name = excluded.name,
      description = excluded.description,
      image_url = excluded.image_url,
      price = excluded.price,
      currency = excluded.currency,
      stock_qty = excluded.stock_qty,
      unit = excluded.unit,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).bind(
    productId,
    shopId,
    getField(input, 'categoryId', 'category_id') || null,
    getField(input, 'sku', '商品編號'),
    name,
    getField(input, 'description', '商品說明'),
    getField(input, 'imageUrl', '圖片網址'),
    Number(getField(input, 'price', '價格')) || 0,
    getField(input, 'currency') || 'TWD',
    Number(getField(input, 'stockQty', 'stock_qty', '庫存')) || 0,
    getField(input, 'unit', '單位'),
    getField(input, 'status', '狀態') || 'active',
    Number(getField(input, 'sortOrder', 'sort_order')) || 0,
    timestamp,
    timestamp
  ).run();
  ctx.waitUntil(logOperation(env, { action: 'saveProduct', target_type: 'product', target_id: productId, result: 'success', metadata: { shopId } }));
  return json({ success: true, status: 'success', productId, id: productId, message: '商品已儲存' });
}

async function updateProductStatus(env, input, ctx) {
  const productId = getField(input, 'productId', 'id');
  const status = getField(input, 'status', '狀態') || 'active';
  if (!productId) return badRequest('缺少 productId');
  const result = await env.DB.prepare(`UPDATE products SET status = ?, updated_at = ? WHERE id = ?`).bind(status, nowIso(), productId).run();
  const ok = result.meta.changes > 0;
  ctx.waitUntil(logOperation(env, { action: 'updateProductStatus', target_type: 'product', target_id: productId, result: ok ? 'success' : 'not_found', message: status }));
  return json({ success: ok, status: ok ? 'success' : 'error', message: ok ? '商品狀態已更新' : '找不到商品' }, ok ? 200 : 404);
}

async function deleteProduct(env, input, ctx) {
  const productId = getField(input, 'productId', 'id');
  if (!productId) return badRequest('缺少 productId');
  const result = await env.DB.prepare(`UPDATE products SET status = 'deleted', updated_at = ? WHERE id = ?`).bind(nowIso(), productId).run();
  const ok = result.meta.changes > 0;
  ctx.waitUntil(logOperation(env, { action: 'deleteProduct', target_type: 'product', target_id: productId, result: ok ? 'success' : 'not_found' }));
  return json({ success: ok, status: ok ? 'success' : 'error', message: ok ? '商品已刪除' : '找不到商品' }, ok ? 200 : 404);
}
function previewLineActionCards(input) {
  const cards = parseJsonField(input, 'cardsJson') || [];
  const list = Array.isArray(cards) ? cards : (cards.contacts || cards.data || cards.items || []);
  const shops = list.map(normalizeLineActionCard).filter(Boolean);
  return json({ success: true, status: 'success', shops, data: shops, count: shops.length });
}

async function importLineActionCards(env, input, ctx) {
  const cards = parseJsonField(input, 'cardsJson') || [];
  const list = Array.isArray(cards) ? cards : (cards.contacts || cards.data || cards.items || []);
  const shops = list.map(normalizeLineActionCard).filter(Boolean);
  const timestamp = nowIso();
  for (const shop of shops) await upsertShop(env, shop, timestamp);
  ctx.waitUntil(logOperation(env, {
    action: 'importLineActionCards',
    target_type: 'shop',
    result: 'success',
    message: `imported ${shops.length} LINE Action cards`,
    metadata: { source: 'LINE-/admin.html' }
  }));
  return json({ success: true, status: 'success', imported: shops.length, shops, data: shops, message: `已匯入 ${shops.length} 筆 LINE- Action 註冊戶` });
}
async function previewActionTenants(input) {
  const keywords = splitKeywords(input);
  const storeId = getField(input, 'storeId') || ACTION_MEMBERLIST_STORE_ID;
  const tenants = [];
  for (const keyword of keywords) {
    const rows = await fetchActionTenants(keyword, storeId);
    tenants.push(...rows);
  }
  return json({ success: true, status: 'success', tenants, data: tenants, count: tenants.length });
}

async function importActionTenants(env, input, ctx) {
  const keywords = splitKeywords(input);
  const storeId = getField(input, 'storeId') || ACTION_MEMBERLIST_STORE_ID;
  const tenants = [];
  for (const keyword of keywords) {
    const rows = await fetchActionTenants(keyword, storeId);
    tenants.push(...rows);
  }

  let imported = 0;
  const timestamp = nowIso();
  for (const tenant of tenants) {
    await env.DB.prepare(`
      INSERT INTO shops (id, name, category, icon, discount, address, line_contact, image_url, status, coupon_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        icon = excluded.icon,
        discount = excluded.discount,
        address = excluded.address,
        line_contact = excluded.line_contact,
        image_url = excluded.image_url,
        status = excluded.status,
        coupon_count = excluded.coupon_count,
        updated_at = excluded.updated_at
    `).bind(
      tenant.id,
      tenant.name,
      tenant.category,
      tenant.icon,
      tenant.discount,
      tenant.address,
      tenant.lineContact,
      tenant.imageUrl,
      tenant.status,
      tenant.couponCount,
      timestamp,
      timestamp
    ).run();
    imported += 1;
  }

  ctx.waitUntil(logOperation(env, {
    action: 'importActionTenants',
    target_type: 'shop',
    result: 'success',
    message: `imported ${imported} tenants`,
    metadata: { keywords, storeId }
  }));
  return json({ success: true, status: 'success', imported, tenants, data: tenants, message: `已匯入 ${imported} 筆 Action 註冊戶` });
}
async function routeAction(action, env, input, ctx, isAdmin) {
  switch (action) {
    case 'getShops': return getShops(env);
    case 'addShop': return addShop(env, input, ctx);
    case 'updateShopStatus': return isAdmin ? updateShopStatus(env, input, ctx) : unauthorized();
    case 'deleteShop': return isAdmin ? deleteShop(env, input, ctx) : unauthorized();
    case 'saveUserProfile': return saveUserProfile(env, input, ctx);
    case 'updateUserProfile': return updateUserProfile(env, input, ctx);
    case 'checkProfileComplete': return checkProfileComplete(env, input);
    case 'saveCoupon': return saveCoupon(env, input, ctx);
    case 'getUserCoupons': return getUserCoupons(env, input);
    case 'getUsers': return isAdmin ? getUsers(env, input) : unauthorized();
    case 'getCoupons': return isAdmin ? getCoupons(env, input) : unauthorized();
    case 'getOperationLogs': return isAdmin ? getOperationLogs(env, input) : unauthorized();
    case 'previewLineActionCards': return isAdmin ? previewLineActionCards(input) : unauthorized();
    case 'importLineActionCards': return isAdmin ? importLineActionCards(env, input, ctx) : unauthorized();
    case 'previewActionRegistrants':
    case 'previewActionTenants': return isAdmin ? previewActionTenants(input) : unauthorized();
    case 'importActionRegistrants':
    case 'importActionTenants': return isAdmin ? importActionTenants(env, input, ctx) : unauthorized();
    case 'verifyCoupon': return updateCouponStatus(env, input, 'used', ctx);
    case 'abandonCoupon': return updateCouponStatus(env, input, 'abandoned', ctx);
    case 'getProductCategories': return getProductCategories(env, input);
    case 'saveProductCategory': return isAdmin ? saveProductCategory(env, input, ctx) : unauthorized();
    case 'getProducts': return getProducts(env, input);
    case 'saveProduct':
    case 'addProduct': return isAdmin ? saveProduct(env, input, ctx) : unauthorized();
    case 'updateProductStatus': return isAdmin ? updateProductStatus(env, input, ctx) : unauthorized();
    case 'deleteProduct': return isAdmin ? deleteProduct(env, input, ctx) : unauthorized();
    default: return badRequest(`未知 action: ${action}`);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (!env.DB) return json({ success: false, status: 'error', message: 'D1 binding DB 未設定' }, 500);

    try {
      const input = await readInput(request);
      const action = getField(input, 'action');
      if (!action) return badRequest('缺少 action');
      return await routeAction(action, env, input, ctx, hasAdminAccess(request, input, env));
    } catch (error) {
      console.error('worker error', error);
      return json({ success: false, status: 'error', message: error.message || '伺服器錯誤' }, 500);
    }
  }
};