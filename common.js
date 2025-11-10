// common.js - 共用功能庫
const GAS_BASE = 'https://richman.fangwl591021.workers.dev/';
let userId = "TEMP_USER";
let liffInitialized = false;

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
            liffId: '2008231249-7DlMkygo'
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
    const response = await fetch(couponUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🎫 優惠券API回應:', result);
    
    if (result && result.status === 'success' && Array.isArray(result.coupons)) {
      return result.coupons;
    } else {
      return [];
    }
  } catch (error) {
    console.error('❌ 載入優惠券失敗:', error);
    return [];
  }
}

async function saveCoupon(shopData) {
  try {
    const shopName = shopData["店家名稱"] || shopData.name || '';
    const discount = shopData["優惠內容"] || shopData.discount || '';
    const imageUrl = shopData["圖片網址"] || shopData.icon || '';
    const shopId = shopData.id || 'shop_' + Date.now();
    
    const formData = new FormData();
    formData.append('action', 'saveCoupon');
    formData.append('userId', userId);
    formData.append('shopId', shopId);
    formData.append('shopName', shopName);
    formData.append('discount', discount);
    formData.append('imageUrl', imageUrl);
    
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
    console.log('✅ 核銷優惠券:', couponId);
    
    const formData = new FormData();
    formData.append('action', 'updateCoupon');
    formData.append('userId', userId);
    formData.append('couponId', couponId);
    formData.append('used', 'true');
    
    const response = await fetch(GAS_BASE, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ 核銷回應:', result);
    
    return result.status === 'success';
    
  } catch (error) {
    console.error('❌ 核銷錯誤:', error);
    return false;
  }
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
  
  // 檢查 URL 參數
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
    // 檢查 localStorage
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
