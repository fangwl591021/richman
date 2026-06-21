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
async function routeAction(action, env, input, ctx) {
  switch (action) {
    case 'getShops': return getShops(env);
    case 'addShop': return addShop(env, input, ctx);
    case 'updateShopStatus': return updateShopStatus(env, input, ctx);
    case 'deleteShop': return deleteShop(env, input, ctx);
    case 'saveUserProfile': return saveUserProfile(env, input, ctx);
    case 'updateUserProfile': return updateUserProfile(env, input, ctx);
    case 'checkProfileComplete': return checkProfileComplete(env, input);
    case 'saveCoupon': return saveCoupon(env, input, ctx);
    case 'getUserCoupons': return getUserCoupons(env, input);
    case 'verifyCoupon': return updateCouponStatus(env, input, 'used', ctx);
    case 'abandonCoupon': return updateCouponStatus(env, input, 'abandoned', ctx);
    case 'getProductCategories': return getProductCategories(env, input);
    case 'saveProductCategory': return saveProductCategory(env, input, ctx);
    case 'getProducts': return getProducts(env, input);
    case 'saveProduct':
    case 'addProduct': return saveProduct(env, input, ctx);
    case 'updateProductStatus': return updateProductStatus(env, input, ctx);
    case 'deleteProduct': return deleteProduct(env, input, ctx);
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
      return await routeAction(action, env, input, ctx);
    } catch (error) {
      console.error('worker error', error);
      return json({ success: false, status: 'error', message: error.message || '伺服器錯誤' }, 500);
    }
  }
};