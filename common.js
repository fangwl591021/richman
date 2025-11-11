// ============================================
// 🌐 API 配置
// ============================================
const GAS_BASE = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
const LIFF_ID = 'YOUR_LIFF_ID'; // LINE LIFF ID

// ============================================
// 📋 店家資料載入
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
      
      // 檢查店家資料是否包含 F 和 G 欄位
      result.data.forEach(shop => {
        console.log(`🏪 ${shop["店家名稱"]}: F=${!!shop["F"]}, G=${!!shop["G"]}`);
      });
      
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

// 按分類載入店家
async function loadShopsByCategory(category) {
  try {
    console.log(`📋 載入分類「${category}」的店家...`);
    
    const allShops = await loadShops();
    const filteredShops = allShops.filter(shop => 
      shop["店家分類"] === category || shop.category === category
    );
    
    console.log(`✅ 找到 ${filteredShops.length} 個「${category}」類型的店家`);
    return filteredShops;
    
  } catch (error) {
    console.error('❌ 按分類載入店家失敗:', error);
    return [];
  }
}

// 預設店家資料（當 API 失敗時使用）
function getDefaultShops() {
  console.warn('⚠️ 使用預設店家資料');
  return [
    {
      "店家名稱": "美味咖啡廳",
      "優惠內容": "買一送一。美式咖啡。限時優惠",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
      "F": "https://line.me/ti/p/~example1",
      "G": "https://maps.app.goo.gl/example1",
      "店家分類": "美食"
    },
    {
      "店家名稱": "幸福餐廳",
      "優惠內容": "9折優惠。全品項。限平日使用",
      "圖片網址": "https://developers-resource.landpress.line.me/fx/img/01_2_restaurant.png",
      "F": "https://line.me/ti/p/~example2",
      "G": "https://maps.app.goo.gl/example2",
      "店家分類": "美食"
    }
  ];
}

// ============================================
// 🎮 格子配置載入
// ============================================
async function getCellConfig(cellIndex) {
  try {
    console.log(`📋 載入格子 ${cellIndex} 的配置...`);
    
    const response = await fetch(`${GAS_BASE}?action=getCellConfig&cellIndex=${cellIndex}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ 格子 ${cellIndex} 配置:`, result);
    
    if (result && result.success === true && result.data) {
      return result.data;
    } else {
      throw new Error(result.message || '載入格子配置失敗');
    }
    
  } catch (error) {
    console.error(`❌ 載入格子 ${cellIndex} 配置失敗:`, error);
    
    // 使用預設配置
    const rand = Math.random();
    let cellType, specialEvent = null, eventParam = null;
    
    if (rand < 0.6) {
      cellType = '店家';
    } else if (rand < 0.75) {
      cellType = '獎勵';
      specialEvent = '前進';
      eventParam = 3;
    } else if (rand < 0.85) {
      cellType = '懲罰';
      specialEvent = '後退';
      eventParam = 2;
    } else if (rand < 0.95) {
      cellType = '機會';
    } else {
      cellType = '起點';
    }
    
    const categories = ['美食', '購物', '服務', '娛樂', '美容', '教育'];
    const category = categories[cellIndex % categories.length];
    
    return {
      格子類型: cellType,
      格子名稱: `${cellType}格 ${cellIndex}`,
      店家分類: cellType === '店家' ? category : '-',
      特殊事件: specialEvent,
      事件參數: eventParam
    };
  }
}

// ============================================
// 🎫 優惠券相關功能
// ============================================
async function saveCoupon(shop) {
  try {
    console.log('💾 開始保存優惠券...', shop);
    
    const user = getCurrentUser();
    if (!user || !user.userId) {
      throw new Error('用戶未登入');
    }
    
    const formData = new FormData();
    formData.append('action', 'saveCoupon');
    formData.append('userId', user.userId);
    formData.append('shopName', shop["店家名稱"] || shop.name || '');
    formData.append('discount', shop["優惠內容"] || shop.discount || '');
    formData.append('imageUrl', shop["圖片網址"] || shop.imageUrl || '');
    formData.append('lineUrl', shop["F"] || shop.lineUrl || '');
    formData.append('addressUrl', shop["G"] || shop.addressUrl || '');
    formData.append('category', shop["店家分類"] || shop.category || '');
    
    console.log('📤 發送優惠券資料到後端...');
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('📥 後端回應:', result);
    
    if (result.success === true || result.status === 'success') {
      console.log('✅ 優惠券保存成功！');
      
      // 同時保存到本地
      const coupons = JSON.parse(localStorage.getItem('localCoupons') || '[]');
      const newCoupon = {
        couponId: result.couponId || `COUPON_${Date.now()}`,
        "店家名稱": shop["店家名稱"],
        "優惠內容": shop["優惠內容"],
        "圖片網址": shop["圖片網址"],
        "F": shop["F"],
        "G": shop["G"],
        "店家分類": shop["店家分類"],
        obtainedDate: new Date().toISOString(),
        used: false
      };
      coupons.push(newCoupon);
      localStorage.setItem('localCoupons', JSON.stringify(coupons));
      
      return true;
    } else {
      throw new Error(result.message || '保存失敗');
    }
    
  } catch (error) {
    console.error('❌ 保存優惠券錯誤:', error);
    
    // 後端失敗時，至少保存到本地
    try {
      const coupons = JSON.parse(localStorage.getItem('localCoupons') || '[]');
      const newCoupon = {
        couponId: `LOCAL_${Date.now()}`,
        "店家名稱": shop["店家名稱"] || shop.name,
        "優惠內容": shop["優惠內容"] || shop.discount,
        "圖片網址": shop["圖片網址"] || shop.imageUrl,
        "F": shop["F"] || shop.lineUrl || '',
        "G": shop["G"] || shop.addressUrl || '',
        "店家分類": shop["店家分類"] || shop.category,
        obtainedDate: new Date().toISOString(),
        used: false
      };
      coupons.push(newCoupon);
      localStorage.setItem('localCoupons', JSON.stringify(coupons));
      console.log('✅ 已保存到本地儲存');
      return true;
    } catch (localError) {
      console.error('❌ 本地保存也失敗:', localError);
      return false;
    }
  }
}

async function loadCoupons() {
  try {
    console.log('📋 開始載入優惠券...');
    
    const user = getCurrentUser();
    if (!user || !user.userId) {
      console.log('⚠️ 用戶未登入，載入本地優惠券');
      return JSON.parse(localStorage.getItem('localCoupons') || '[]');
    }
    
    const response = await fetch(`${GAS_BASE}?action=getCoupons&userId=${user.userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🎫 優惠券API回應:', result);
    
    if (result && result.success === true && Array.isArray(result.data)) {
      console.log(`✅ 成功載入 ${result.data.length} 張優惠券`);
      return result.data;
    } else {
      throw new Error(result.message || '載入失敗');
    }
    
  } catch (error) {
    console.error('❌ 載入優惠券失敗:', error);
    // 載入本地優惠券作為備用
    return JSON.parse(localStorage.getItem('localCoupons') || '[]');
  }
}

async function verifyCoupon(couponId) {
  try {
    console.log('🎫 開始核銷優惠券:', couponId);
    
    const user = getCurrentUser();
    if (!user || !user.userId) {
      throw new Error('用戶未登入');
    }
    
    const formData = new FormData();
    formData.append('action', 'verifyCoupon');
    formData.append('userId', user.userId);
    formData.append('couponId', couponId);
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('核銷回應:', result);
    
    if (result.success === true || result.status === 'success') {
      console.log('✅ 核銷成功！');
      
      // 更新本地狀態
      let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
      usedCoupons[couponId] = {
        used: true,
        verifiedAt: new Date().toISOString()
      };
      localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
      
      return true;
    } else {
      throw new Error(result.message || '核銷失敗');
    }
    
  } catch (error) {
    console.error('❌ 核銷錯誤:', error);
    // 後端錯誤時，在前端模擬核銷
    let usedCoupons = JSON.parse(localStorage.getItem('usedCoupons') || '{}');
    usedCoupons[couponId] = {
      used: true,
      verifiedAt: new Date().toISOString()
    };
    localStorage.setItem('usedCoupons', JSON.stringify(usedCoupons));
    return true;
  }
}

// ============================================
// 🔐 LINE 登入相關
// ============================================
async function initializeApp() {
  console.log('🚀 初始化應用程式...');
  
  // 檢查是否在 LINE 環境中
  if (typeof liff !== 'undefined') {
    try {
      await liff.init({ liffId: LIFF_ID });
      
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        localStorage.setItem('lineUserId', profile.userId);
        localStorage.setItem('lineDisplayName', profile.displayName);
        localStorage.setItem('linePictureUrl', profile.pictureUrl);
        
        console.log('✅ LINE 用戶已登入:', profile.displayName);
      }
    } catch (error) {
      console.error('❌ LIFF 初始化失敗:', error);
    }
  }
  
  // 檢查是否有 LINE 登入資訊
  const user = getCurrentUser();
  const loginScreen = document.getElementById('loginScreen');
  
  if (user && user.userId) {
    console.log('✅ 用戶已登入:', user.displayName);
    if (loginScreen) {
      loginScreen.classList.add('hidden');
    }
    
    // 更新底部 LINE 按鈕顯示
    const lineLoginBtn = document.getElementById('lineLoginBtn');
    const lineAvatar = document.getElementById('lineAvatar');
    const lineLoginText = document.getElementById('lineLoginText');
    
    if (lineLoginBtn && lineAvatar && user.pictureUrl) {
      lineLoginBtn.classList.add('has-avatar', 'logged-in');
      lineAvatar.src = user.pictureUrl;
      if (lineLoginText) {
        lineLoginText.textContent = user.displayName || 'LINE';
      }
    }
  } else {
    console.log('⚠️ 用戶未登入');
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
    }
  }
}

async function startLineLogin() {
  console.log('🔐 開始 LINE 登入流程...');
  
  if (typeof liff === 'undefined') {
    alert('LINE LIFF SDK 未載入，請確認網路連線');
    return;
  }
  
  try {
    if (!liff.isLoggedIn()) {
      liff.login();
    } else {
      await initializeApp();
    }
  } catch (error) {
    console.error('❌ LINE 登入失敗:', error);
    alert('登入失敗：' + error.message);
  }
}

async function lineLogin() {
  await startLineLogin();
}

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

// ============================================
// 🛠️ 輔助函數
// ============================================
function showMsg(text) {
  const msg = document.getElementById('msg');
  if (msg) {
    msg.textContent = text;
    msg.style.opacity = '1';
  }
}

function hideMsg() {
  const msg = document.getElementById('msg');
  if (msg) {
    msg.style.opacity = '0';
  }
}

console.log('✅ common.js 載入完成');
