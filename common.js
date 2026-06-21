// common.js - 共用功能庫
const RICHMAN_CONFIG = window.RICHMAN_CONFIG || {};
const GAS_BASE = RICHMAN_CONFIG.API_BASE || 'https://richman.fangwl591021.workers.dev/';
const LIFF_ID = RICHMAN_CONFIG.LIFF_ID || '2008231249-7DlMkygo';
let userId = "TEMP_USER";
let liffInitialized = false;

// ============================================
// 🎮 Google Sheets 格子配置（新增）
// ============================================
const SHEET_ID = "1-qvp5x8VJa_vFULJy8dfT3FjQwLDkGV8ECyeCiwJpkU";
const CELL_CONFIG_GID = "106466612"; // 格子設定工作表的 GID

// 快取格子配置
let cellConfigCache = null;

// 讀取格子設定（新增功能）
async function loadCellConfig() {
  if (cellConfigCache) {
    console.log('✅ 使用快取的格子設定');
    return cellConfigCache;
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${CELL_CONFIG_GID}`;
    console.log('📥 讀取格子設定:', url);
    
    const response = await fetch(url);
    const text = await response.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    
    const rows = json.table.rows;
    const config = {};
    
    // 從第二行開始（跳過表頭）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].c;
      if (!row || !row[0]) continue;
      
      const cellIndex = row[0]?.v ?? null;
      if (cellIndex === null) continue;
      
      config[cellIndex] = {
        格子編號: cellIndex,
        X座標: row[1]?.v ?? 0,
        Y座標: row[2]?.v ?? 0,
        格子類型: row[3]?.v ?? "",
        店家分類: row[4]?.v ?? "",
        特殊事件: row[5]?.v ?? "",
        事件參數: row[6]?.v ?? "",
        格子名稱: row[7]?.v ?? ""
      };
    }
    
    cellConfigCache = config;
    console.log('✅ 格子設定載入成功，共', Object.keys(config).length, '個格子');
    return config;
    
  } catch (error) {
    console.error('❌ 載入格子設定失敗:', error);
    return {};
  }
}

// 取得指定格子的配置（新增功能）
async function getCellConfig(cellIndex) {
  const config = await loadCellConfig();
  return config[cellIndex] || null;
}

// 根據分類篩選店家（新增功能）
async function loadShopsByCategory(category) {
  const allShops = await loadShops();
  
  // 篩選指定分類
  const filtered = allShops.filter(shop => {
    const shopCategory = shop["分類"] || shop["店家分類"] || "";
    return shopCategory === category;
  });
  
  console.log(`🔍 篩選分類「${category}」的店家:`, filtered.length, '間');
  
  if (filtered.length === 0) {
    console.warn(`⚠️ 找不到分類「${category}」的店家！請檢查店家資料表`);
  }
  
  return filtered;
}

// ============================================
// 📱 LINE 登入功能
// ============================================
async function initLiff() {
    try {
        if (typeof liff === 'undefined') {
            console.log('❌ LIFF SDK 未載入');
            return false;
        }
        
        await liff.init({ 
            liffId: LIFF_ID
        });
        liffInitialized = true;
        console.log('✅ LIFF 初始化成功');
        return true;
    } catch (error) {
        console.error('❌ LIFF 初始化失敗:', error);
        return false;
    }
}

async function startLineLogin() {
  try {
    console.log('=== 🔐 開始 LINE 登入流程 ===');
    
    if (!liffInitialized) {
      const initialized = await initLiff();
      if (!initialized) {
        alert('LINE 登入功能初始化失敗，請重新整理頁面');
        return;
      }
    }
    
    if (!liff.isLoggedIn()) {
      console.log('🔐 執行 LIFF 登入...');
      liff.login();
    } else {
      console.log('✅ 用戶已登入，取得用戶資料');
      await getLineProfile();
    }
  } catch (error) {
    console.error('❌ LINE 登入發生錯誤:', error);
    alert('LINE 登入發生錯誤，請稍後再試');
  }
}

async function getLineProfile() {
  try {
    console.log('📱 取得 LINE 用戶資料...');
    const profile = await liff.getProfile();
    
    localStorage.setItem('lineUserId', profile.userId);
    localStorage.setItem('lineDisplayName', profile.displayName);
    localStorage.setItem('linePictureUrl', profile.pictureUrl || '');
    
    updateUserInterface({
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });
    
    console.log('✅ LINE 用戶資料取得成功:', profile.displayName);
    
  } catch (error) {
    console.error('❌ 取得 LINE 用戶資料失敗:', error);
    alert('取得用戶資料失敗，請重試');
  }
}

function updateUserInterface(userInfo) {
  if (userInfo && userInfo.userId) {
    localStorage.setItem('lineUserId', userInfo.userId);
    localStorage.setItem('lineDisplayName', userInfo.displayName);
    localStorage.setItem('linePictureUrl', userInfo.pictureUrl || '');
    
    // 更新頭像顯示
    const lineAvatar = document.getElementById('lineAvatar');
    const lineLoginBtn = document.getElementById('lineLoginBtn');
    const lineLoginText = document.getElementById('lineLoginText');
    
    if (lineAvatar && userInfo.pictureUrl) {
      lineAvatar.src = userInfo.pictureUrl;
    }
    if (lineLoginBtn) {
      lineLoginBtn.classList.add('has-avatar');
    }
    if (lineLoginText) {
      lineLoginText.textContent = userInfo.displayName;
    }
    if (lineLoginBtn) {
      lineLoginBtn.classList.add('logged-in');
    }
    
    userId = userInfo.userId;
    
    // 隱藏登入畫面（如果存在）
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
      loginScreen.classList.add('hidden');
    }
    
    alert(`歡迎，${userInfo.displayName}！`);
  }
}

function lineLogin() {
  if (localStorage.getItem('lineUserId')) {
    if (confirm('確定要登出 LINE 帳號嗎？')) {
      localStorage.removeItem('lineUserId');
      localStorage.removeItem('lineDisplayName');
      localStorage.removeItem('linePictureUrl');
      
      const lineLoginText = document.getElementById('lineLoginText');
      const lineLoginBtn = document.getElementById('lineLoginBtn');
      const lineAvatar = document.getElementById('lineAvatar');
      
      if (lineLoginText) lineLoginText.textContent = 'LINE';
      if (lineLoginBtn) {
        lineLoginBtn.classList.remove('logged-in');
        lineLoginBtn.classList.remove('has-avatar');
      }
      if (lineAvatar) lineAvatar.src = '';
      userId = 'TEMP_USER';
      
      alert('已登出！');
      
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) {
        loginScreen.classList.remove('hidden');
      }
    }
  } else {
    startLineLogin();
  }
}

// ============================================
// 🏪 店家資料功能
// ============================================
async function loadShops() {
  try {
    console.log('📋 開始載入店家資料...');
    
    const response = await fetch(`${GAS_BASE}?action=getShops`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('🛍️ 店家資料API回應:', result);
    
    if (result && result.success === true && Array.isArray(result.data)) {
      console.log(`✅ 成功載入 ${result.data.length} 個店家`);
      return result.data;
    } else {
      const errorMsg = result.message || '載入店家資料失敗';
      console.error('❌ 載入店家資料失敗:', errorMsg);
      return getDefaultShops();
    }
  } catch (error) {
    console.error('❌ 載入店家資料發生錯誤:', error);
    return getDefaultShops();
  }
}

function getDefaultShops() {
  return [
    {
      "店家名稱": "板橋咖啡廳",
      "優惠內容": "1️⃣ 拿鐵第二杯半價\n2️⃣ 消費滿200元送點心\n3️⃣ 平日時段85折優惠",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
      "地址": "板橋區中山路一段123號"
    },
    {
      "店家名稱": "商圈服飾店", 
      "優惠內容": "1️⃣ 全館8折優惠\n2️⃣ 新品上市9折\n3️⃣ 會員獨享折上折",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
      "地址": "板橋區文化路二段456號"
    }
  ];
}

// ============================================
// 🎫 優惠券功能
// ============================================
async function loadCoupons() {
  try {
    console.log('🎫 開始載入優惠券...');
    
    const couponUrl = `${GAS_BASE}?action=getUserCoupons&userId=${encodeURIComponent(userId)}`;
    console.log('🔗 請求 URL:', couponUrl);
    
    const response = await fetch(couponUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // 檢查回應內容類型
    const contentType = response.headers.get('content-type');
    console.log('📄 回應內容類型:', contentType);
    
    const responseText = await response.text();
    console.log('📝 原始回應:', responseText.substring(0, 200)); // 只顯示前200字元
    
    // 檢查是否是 HTML 頁面
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.includes('<html')) {
      console.warn('⚠️ 後端返回 HTML 頁面而非 JSON，使用模擬資料');
      return getMockCoupons();
    }
    
    // 嘗試解析 JSON
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError);
      console.warn('⚠️ JSON 解析失敗，使用模擬資料');
      return getMockCoupons();
    }
    
    console.log('🎫 優惠券API回應:', result);
    
    if (result && result.status === 'success' && Array.isArray(result.coupons)) {
      let coupons = result.coupons;
      
      // 獲取前端核銷記錄
      const usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
      
      // 合併後端和前端的核銷狀態
      coupons = coupons.map(coupon => {
        const couponId = coupon.id || coupon._id;
        const backendUsed = coupon.used === true || coupon.used === 'true';
        const frontendUsed = usedCoupons[couponId] ? usedCoupons[couponId].used : false;
        
        // 如果後端或前端任一標記為已使用，則視為已使用
        return {
          ...coupon,
          used: backendUsed || frontendUsed
        };
      });
      
      console.log('✅ 優惠券載入成功，包含 F 和 G 欄位:', coupons.map(c => ({
        店家名稱: c["店家名稱"],
        F: c["F"],
        G: c["G"],
        F是否為空: !c["F"],
        G是否為空: !c["G"]
      })));
      
      return coupons;
    } else {
      console.log('⚠️ 後端無優惠券資料或格式錯誤，使用模擬資料');
      return getMockCoupons();
    }
  } catch (error) {
    console.error('❌ 載入優惠券失敗:', error);
    return getMockCoupons();
  }
}

// 模擬優惠券資料（包含 F 和 G 欄位）
function getMockCoupons() {
  const usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
  
  return [
    {
      couponId: 'COUPON_1',
      "店家名稱": "板橋咖啡廳",
      "優惠內容": "1️⃣ 拿鐵第二杯半價\n2️⃣ 消費滿200元送點心\n3️⃣ 平日時段85折優惠",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
      "F": "https://line.me/ti/p/~coffee_shop",
      "G": "https://goo.gl/maps/example1",
      obtainedDate: new Date().toISOString(),
      used: usedCoupons['COUPON_1'] ? usedCoupons['COUPON_1'].used : false
    },
    {
      couponId: 'COUPON_2',
      "店家名稱": "商圈服飾店", 
      "優惠內容": "1️⃣ 全館8折優惠\n2️⃣ 新品上市9折\n3️⃣ 會員獨享折上折",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
      "F": "fashion_store_line",
      "G": "台北市板橋區文化路二段456號",
      obtainedDate: new Date(Date.now() - 86400000).toISOString(),
      used: usedCoupons['COUPON_2'] ? usedCoupons['COUPON_2'].used : 'abandoned'
    },
    {
      couponId: 'COUPON_3',
      "店家名稱": "美食餐廳",
      "優惠內容": "1️⃣ 商業午餐9折\n2️⃣ 晚餐時段85折\n3️⃣ 生日當天免費甜點",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_2_restaurant.png",
      "F": "https://line.me/ti/p/~restaurant",
      "G": "https://maps.app.goo.gl/example3",
      obtainedDate: new Date().toISOString(),
      used: usedCoupons['COUPON_3'] ? usedCoupons['COUPON_3'].used : false
    }
  ];
}

// 在 common.js 中修改 saveCoupon 函數
async function saveCoupon(shopData) {
  try {
    const shopName = shopData["店家名稱"] || shopData.name || '';
    const discount = shopData["優惠內容"] || shopData.discount || '';
    const imageUrl = shopData["圖片網址"] || shopData.icon || '';
    
    // 🎯 關鍵修正：正確獲取加LINE聯繫和地址連結
    const lineContact = shopData["加LINE連繫"] || shopData["加LINE 建模"] || shopData.lineUrl || '';
    const address = shopData["地址"] || shopData.mapUrl || '';
    
    const shopId = shopData.id || 'shop_' + Date.now();
    
    console.log('💾 保存優惠券資料:', {
      shopName, discount, imageUrl,
      lineContact, address
    });
    
    const formData = new FormData();
    formData.append('action', 'saveCoupon');
    formData.append('userId', userId);
    formData.append('shopId', shopId);
    formData.append('shopName', shopName);
    formData.append('discount', discount);
    formData.append('imageUrl', imageUrl);
    formData.append('lineContact', lineContact); // 保存加LINE聯繫
    formData.append('address', address);         // 保存地址
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('💾 收藏優惠券回應:', result);
    
    return result.status === 'success';
    
  } catch (error) {
    console.error('❌ 收藏錯誤:', error);
    return false;
  }
}

async function verifyCoupon(couponId) {
  try {
    console.log('🎫 開始核銷優惠券:', couponId);
    
    const user = getCurrentUser();
    if (!user || !user.userId) {
      console.warn('⚠️ 未登入用戶，拒絕核銷');
      return false;
    }
    
    const action = 'verifyCoupon';
    console.log(`🔄 使用 action: ${action}`);
    
    const formData = new FormData();
    formData.append('action', action);
    formData.append('userId', user.userId);
    formData.append('couponId', couponId);
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log(`📊 ${action} 回應:`, result);
    
    if (result.success === true || result.status === 'success') {
      console.log(`✅ ${action} 成功`);
      
      let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
      usedCoupons[couponId] = {
        used: true,
        verifiedAt: new Date().toISOString()
      };
      localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
      
      return true;
    } else {
      if (result.message && result.message.includes('已經處理')) {
        console.log('ℹ️ 優惠券已經處理過，更新本地狀態');
        let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
        usedCoupons[couponId] = {
          used: true,
          verifiedAt: new Date().toISOString()
        };
        localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
        return true;
      }
      
      throw new Error(result.message || '核銷失敗');
    }
    
  } catch (error) {
    console.error('❌ 核銷錯誤:', error);
    return false;
  }
}

function simulateVerifyCoupon(couponId) {
  let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
  usedCoupons[couponId] = {
    used: true,
    usedAt: new Date().toISOString()
  };
  localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
  console.log('💾 前端記錄核銷:', couponId);
}

// ============================================
// 🔧 工具函數
// ============================================
function formatDescription(text) {
  if (!text) return '';
  
  const lines = text.split('\n');
  let formattedHTML = '';
  
  lines.forEach((line, index) => {
    if (line.trim()) {
      if (/^[0-9]|^[0-9]️⃣|^[一二三四五六七八九十]/.test(line.trim())) {
        formattedHTML += `<span class="desc-line">${line}</span>`;
      } else {
        formattedHTML += `<span class="desc-line">${line}</span>`;
      }
    }
  });
  
  return formattedHTML;
}

function showMsg(t, elementId = 'msg') {
  const msgElement = document.getElementById(elementId);
  if (msgElement) {
    msgElement.textContent = t;
    msgElement.style.opacity = 1;
  }
}

function hideMsg(elementId = 'msg') {
  const msgElement = document.getElementById(elementId);
  if (msgElement) {
    msgElement.style.opacity = 0;
    setTimeout(() => {
      msgElement.textContent = "";
    }, 500);
  }
}

// ============================================
// 📄 頁面初始化
// ============================================
async function initializeApp() {
  console.log('=== 📱 初始化應用程式 ===');
  
  try {
    await initLiff();
    
    if (liffInitialized && liff.isLoggedIn()) {
      console.log('✅ LIFF 用戶已登入，自動取得資料');
      await getLineProfile();
      
      if (localStorage.getItem('lineUserId')) {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
          loginScreen.classList.add('hidden');
        }
        return;
      }
    }
  } catch (error) {
    console.log('ℹ️ LIFF 初始化失敗或未使用 LIFF，繼續其他登入方式');
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const lineUserId = urlParams.get('lineUserId');
  const lineDisplayName = urlParams.get('lineDisplayName');
  const linePictureUrl = urlParams.get('linePictureUrl');
  
  if (lineUserId && lineDisplayName) {
    localStorage.setItem('lineUserId', lineUserId);
    localStorage.setItem('lineDisplayName', decodeURIComponent(lineDisplayName));
    
    if (linePictureUrl) {
      localStorage.setItem('linePictureUrl', decodeURIComponent(linePictureUrl));
    }
    
    updateUserInterface({
      userId: lineUserId,
      displayName: decodeURIComponent(lineDisplayName),
      pictureUrl: linePictureUrl ? decodeURIComponent(linePictureUrl) : ''
    });
    
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    const storedUserId = localStorage.getItem('lineUserId');
    const storedDisplayName = localStorage.getItem('lineDisplayName');
    const storedPictureUrl = localStorage.getItem('linePictureUrl');
    
    if (storedUserId) {
      updateUserInterface({
        userId: storedUserId,
        displayName: storedDisplayName,
        pictureUrl: storedPictureUrl
      });
    } else {
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) {
        loginScreen.classList.remove('hidden');
      }
    }
  }
}

// ============================================
// 🔧 新增工具函數
// ============================================

function getCurrentUser() {
  const lineUserId = localStorage.getItem('lineUserId');
  if (lineUserId) {
    return {
      userId: lineUserId,
      displayName: localStorage.getItem('lineDisplayName'),
      pictureUrl: localStorage.getItem('linePictureUrl')
    };
  }
  return null;
}

function showNotification(message, type = 'info') {
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: bold;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

async function abandonCoupon(couponId) {
  try {
    const user = getCurrentUser();
    if (!user || !user.userId) {
      console.warn('⚠️ 未登入用戶，拒絕放棄優惠券');
      return false;
    }
    
    const formData = new FormData();
    formData.append('action', 'abandonCoupon');
    formData.append('userId', user.userId);
    formData.append('couponId', couponId);
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('放棄回應:', result);
    
    if (result.success === true || result.status === 'success') {
      console.log('✅ 放棄成功！');
      
      let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
      usedCoupons[couponId] = {
        used: 'abandoned',
        abandonedAt: new Date().toISOString()
      };
      localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
      
      return true;
    } else {
      if (result.message && result.message.includes('已經處理')) {
        console.log('ℹ️ 優惠券已經處理過，更新本地狀態');
        let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
        usedCoupons[couponId] = {
          used: 'abandoned',
          abandonedAt: new Date().toISOString()
        };
        localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
        return true;
      }
      throw new Error(result.message || '放棄失敗');
    }
    
  } catch (error) {
    console.error('❌ 放棄錯誤:', error);
    return false;
  }
}
