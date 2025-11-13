// ============================================
// 🎮 歡樂大富翁 - 通用功能庫 (common.js) - 完整後端驗證版 v4.0
// ============================================

// 全局變量
let liffInitialized = false;
let currentUser = null;
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQn_0UJ7_lXv7bwV9K8Q7q9X8Z9Y0Z1a2b3c4d5e6f7g8h9i0/exec'; // 請替換為您的實際 GAS 網址

// ============================================
// 🎨 用戶界面更新功能
// ============================================

// 更新用戶界面函數
function updateUserInterface(userData) {
    console.log('🔄 更新用戶界面，用戶資料:', userData);
    
    try {
        // 更新用戶頭像和名稱
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userLevel = document.getElementById('userLevel');
        const userCoins = document.getElementById('userCoins');
        
        if (userAvatar) {
            userAvatar.src = userData.pictureUrl || userData.linePictureUrl || 'https://via.placeholder.com/50x50?text=頭像';
            userAvatar.onerror = function() {
                this.src = 'https://via.placeholder.com/50x50?text=頭像';
            };
        }
        
        if (userName) {
            userName.textContent = userData.displayName || userData.nickname || userData.lineDisplayName || '玩家';
        }
        
        if (userLevel) {
            userLevel.textContent = `Lv.${userData.level || 1}`;
        }
        
        if (userCoins) {
            userCoins.textContent = userData.coins || 0;
        }
        
        // 更新其他界面元素
        updateGameInterface(userData);
        
    } catch (error) {
        console.error('❌ 更新用戶界面失敗:', error);
    }
}

// 更新遊戲界面
function updateGameInterface(userData) {
    console.log('🎮 更新遊戲界面');
    
    try {
        // 更新玩家位置標記
        const playerMarkers = document.querySelectorAll('.player-marker');
        playerMarkers.forEach(marker => {
            const playerId = marker.getAttribute('data-player-id');
            if (playerId === userData.userId || playerId === userData.lineUserId) {
                const currentPosition = userData.currentPosition || 0;
                marker.style.transform = `translate(${calculatePosition(currentPosition)})`;
            }
        });
        
        // 更新擁有的地產
        updateOwnedProperties(userData.ownedProperties || []);
        
        // 更新優惠券數量
        const couponCount = document.getElementById('couponCount');
        if (couponCount) {
            couponCount.textContent = userData.coupons ? userData.coupons.length : 0;
        }
        
    } catch (error) {
        console.error('❌ 更新遊戲界面失敗:', error);
    }
}

// 更新擁有的地產顯示
function updateOwnedProperties(ownedProperties) {
    console.log('🏠 更新地產顯示，數量:', ownedProperties.length);
    
    try {
        const propertyElements = document.querySelectorAll('.property');
        propertyElements.forEach(property => {
            const propertyId = property.getAttribute('data-property-id');
            const isOwned = ownedProperties.includes(propertyId);
            
            if (isOwned) {
                property.classList.add('owned');
                property.classList.remove('available');
            } else {
                property.classList.remove('owned');
                property.classList.add('available');
            }
        });
    } catch (error) {
        console.error('❌ 更新地產顯示失敗:', error);
    }
}

// 計算位置坐標
function calculatePosition(position) {
    const positions = [
        '0px, 0px', '100px, 0px', '200px, 0px', '300px, 0px',
        '300px, 100px', '300px, 200px', '300px, 300px',
        '200px, 300px', '100px, 300px', '0px, 300px',
        '0px, 200px', '0px, 100px'
    ];
    return positions[position % positions.length] || '0px, 0px';
}

// ============================================
// 👤 用戶資料管理功能
// ============================================

// 獲取當前用戶資料
function getCurrentUser() {
    const userId = localStorage.getItem('lineUserId');
    const displayName = localStorage.getItem('lineDisplayName');
    const pictureUrl = localStorage.getItem('linePictureUrl');
    
    if (!userId) {
        return null;
    }
    
    return {
        userId: userId,
        displayName: displayName,
        pictureUrl: pictureUrl
    };
}

// 獲取完整的用戶資料
function getUserProfile() {
    const userProfileStr = localStorage.getItem('userProfile');
    if (!userProfileStr) {
        return null;
    }
    
    try {
        return JSON.parse(userProfileStr);
    } catch (error) {
        console.error('❌ 解析用戶資料失敗:', error);
        return null;
    }
}

// 更新用戶資料
function updateUserProfile(updates) {
    try {
        const currentProfile = getUserProfile();
        if (!currentProfile) {
            console.error('❌ 無法更新：用戶資料不存在');
            return false;
        }
        
        const updatedProfile = {
            ...currentProfile,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        console.log('✅ 用戶資料更新成功');
        return true;
        
    } catch (error) {
        console.error('❌ 更新用戶資料失敗:', error);
        return false;
    }
}

// ============================================
// 🌐 後端 API 功能
// ============================================

// 向 GAS 發送請求
async function callGAS(action, data = {}) {
    try {
        const formData = new URLSearchParams();
        formData.append('action', action);
        
        // 添加所有數據到表單
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                formData.append(key, data[key]);
            }
        });

        console.log(`🌐 呼叫 GAS API: ${action}`, data);

        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`📊 GAS API 回應 (${action}):`, result);
        return result;
        
    } catch (error) {
        console.error(`❌ GAS API 呼叫失敗 (${action}):`, error);
        return {
            success: false,
            message: `網絡錯誤: ${error.message}`
        };
    }
}

// 真正的後端註冊驗證
async function verifyRegistrationWithBackend(userId) {
    console.log('🌐 向後端驗證註冊狀態...');
    
    try {
        const result = await callGAS('verifyRegistration', { userId });
        console.log('📊 後端驗證結果:', result);
        return result;
        
    } catch (error) {
        console.error('❌ 後端驗證失敗:', error);
        return {
            success: false,
            registered: false,
            message: '後端驗證失敗'
        };
    }
}

// 完成後端註冊
async function completeBackendRegistration(userData) {
    console.log('🌐 向後端完成註冊...');
    
    try {
        const result = await callGAS('completeRegistration', userData);
        console.log('📊 後端註冊結果:', result);
        return result;
        
    } catch (error) {
        console.error('❌ 後端註冊失敗:', error);
        return {
            success: false,
            message: '後端註冊失敗'
        };
    }
}

// ============================================
// 🔐 真正的註冊狀態檢查功能（修復版）
// ============================================

// 驗證用戶資料完整性
function validateUserProfile(userId) {
    console.log('🔍 驗證用戶資料完整性...');
    
    const userProfileStr = localStorage.getItem('userProfile');
    if (!userProfileStr) {
        console.log('❌ userProfile 不存在');
        return false;
    }
    
    try {
        const userProfile = JSON.parse(userProfileStr);
        console.log('📄 userProfile 內容:', userProfile);
        
        // 檢查必要欄位
        const requiredFields = ['lineUserId', 'nickname', 'county'];
        const missingFields = requiredFields.filter(field => !userProfile[field]);
        
        if (missingFields.length > 0) {
            console.log('❌ 缺少必要欄位:', missingFields);
            return false;
        }
        
        // 檢查用戶ID匹配
        if (userProfile.lineUserId !== userId) {
            console.log('❌ 用戶ID不匹配');
            return false;
        }
        
        console.log('✅ 用戶資料驗證通過');
        return true;
        
    } catch (error) {
        console.error('❌ 解析 userProfile 失敗:', error);
        return false;
    }
}

// 真正的註冊檢查 - 修復版
async function checkUserRegistration(userId) {
    if (!userId) {
        console.log('❌ 用戶ID為空');
        return false;
    }
    
    console.log('🔍 真正檢查用戶註冊狀態，用戶ID:', userId);
    
    try {
        // 1. 先檢查本地 userProfile 是否完整
        const userProfile = getUserProfile();
        const localProfileValid = userProfile && 
                                userProfile.lineUserId === userId && 
                                userProfile.nickname && 
                                userProfile.county;
        
        console.log('📱 本地 userProfile 檢查:', localProfileValid ? '完整' : '不完整');
        
        if (!localProfileValid) {
            console.log('❌ 本地 userProfile 不完整，需要重新註冊');
            return false;
        }
        
        // 2. 向後端驗證真正的註冊狀態
        const backendResult = await verifyRegistrationWithBackend(userId);
        console.log('📊 後端驗證詳細結果:', backendResult);
        
        if (backendResult.success && backendResult.registered) {
            console.log('✅ 後端確認用戶已完整註冊');
            
            // 更新本地註冊列表
            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
            registeredUsers[userId] = {
                registered: true,
                verifiedAt: new Date().toISOString(),
                backendVerified: true,
                details: backendResult.details
            };
            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
            
            return true;
        } else {
            console.log('❌ 後端確認用戶未註冊或註冊不完整');
            console.log('詳細資訊:', backendResult.details || backendResult.message);
            
            // 清除本地錯誤的註冊標記
            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
            delete registeredUsers[userId];
            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ 註冊檢查失敗:', error);
        return false;
    }
}

// 修復用戶資料
function repairUserProfile(userId, registeredUserInfo) {
    try {
        console.log('🔧 嘗試修復用戶資料...');
        
        const userProfileStr = localStorage.getItem('userProfile');
        let userProfile = {};
        
        if (userProfileStr) {
            try {
                userProfile = JSON.parse(userProfileStr);
            } catch (error) {
                console.log('❌ 現有 userProfile 損壞，創建新的');
            }
        }
        
        // 確保基本資料存在
        userProfile.lineUserId = userId;
        userProfile.lineDisplayName = localStorage.getItem('lineDisplayName') || '';
        userProfile.linePictureUrl = localStorage.getItem('linePictureUrl') || '';
        
        // 從註冊信息補充資料
        if (registeredUserInfo.nickname) {
            userProfile.nickname = registeredUserInfo.nickname;
        }
        if (registeredUserInfo.county) {
            userProfile.county = registeredUserInfo.county;
        }
        
        // 確保必要欄位
        if (!userProfile.nickname) userProfile.nickname = userProfile.lineDisplayName;
        if (!userProfile.county) userProfile.county = '未選擇';
        if (!userProfile.level) userProfile.level = 1;
        if (!userProfile.coins) userProfile.coins = 1000;
        if (!userProfile.registrationTime) userProfile.registrationTime = new Date().toISOString();
        
        // 保存修復後的資料
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        console.log('✅ 用戶資料修復完成');
        
    } catch (error) {
        console.error('❌ 修復用戶資料失敗:', error);
    }
}

// 檢查並修復所有資料問題
function checkAndFixAllData() {
    console.log('🔍 全面檢查資料完整性...');
    
    const userId = localStorage.getItem('lineUserId');
    if (!userId) {
        console.log('❌ 未找到用戶ID');
        return false;
    }
    
    // 檢查基本LINE資料
    const lineData = {
        userId: localStorage.getItem('lineUserId'),
        displayName: localStorage.getItem('lineDisplayName'),
        pictureUrl: localStorage.getItem('linePictureUrl')
    };
    
    console.log('📱 LINE 基本資料:', lineData);
    
    // 檢查 userProfile
    const userProfileStr = localStorage.getItem('userProfile');
    let userProfile = null;
    
    if (userProfileStr) {
        try {
            userProfile = JSON.parse(userProfileStr);
            console.log('📄 userProfile 狀態:', userProfile ? '存在且有效' : '無效');
        } catch (error) {
            console.error('❌ userProfile 解析失敗:', error);
            userProfile = null;
        }
    } else {
        console.log('❌ userProfile 不存在');
    }
    
    // 檢查 registeredUsers
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    console.log('📋 registeredUsers 狀態:', registeredUsers[userId] ? '已註冊' : '未註冊');
    
    return true;
}

// ============================================
// 🔄 頁面導航功能
// ============================================

// 重定向到註冊頁面
function redirectToRegistration() {
    console.log('🔄 重定向到註冊頁面');
    const currentPath = window.location.pathname;
    
    // 如果已經在註冊頁面，不要重定向
    if (currentPath.includes('register.html') || currentPath.includes('login.html')) {
        return;
    }
    
    // 檢查是否剛從註冊頁面過來
    const fromRegistration = sessionStorage.getItem('fromRegistration');
    if (fromRegistration === 'true') {
        sessionStorage.removeItem('fromRegistration');
        return;
    }
    
    // 重定向到註冊頁面
    window.location.href = 'register.html';
}

// 檢查並強制註冊
function enforceRegistration() {
    const user = getCurrentUser();
    if (!user || !user.userId) {
        console.log('❌ 未找到用戶資料，需要重新登入');
        redirectToRegistration();
        return false;
    }
    
    const isRegistered = checkUserRegistration(user.userId);
    console.log('📊 註冊檢查結果:', isRegistered);
    
    if (!isRegistered) {
        console.log('🆕 用戶未註冊，強制重定向到註冊頁面');
        redirectToRegistration();
        return false;
    }
    
    console.log('✅ 用戶已註冊，可以開始遊戲');
    return true;
}

// 完成註冊的函數（前端+後端）
async function completeRegistration(userData) {
    const userId = userData.lineUserId;
    
    try {
        // 1. 保存到本地
        localStorage.setItem('userProfile', JSON.stringify(userData));
        
        // 記錄已註冊用戶
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
        registeredUsers[userId] = {
            registered: true,
            timestamp: new Date().toISOString(),
            localOnly: true // 標記為僅本地註冊
        };
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        
        console.log('✅ 本地註冊完成');
        
        // 2. 向後端註冊
        console.log('🌐 開始後端註冊...');
        const backendData = {
            userId: userData.lineUserId,
            displayName: userData.lineDisplayName,
            pictureUrl: userData.linePictureUrl,
            nickname: userData.nickname,
            county: userData.county,
            statusMessage: userData.statusMessage || ''
        };
        
        const backendResult = await completeBackendRegistration(backendData);
        
        if (backendResult.success) {
            console.log('✅ 後端註冊成功');
            // 更新本地標記
            registeredUsers[userId].backendVerified = true;
            registeredUsers[userId].localOnly = false;
            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        } else {
            console.log('⚠️ 後端註冊失敗，但本地註冊完成:', backendResult.message);
        }
        
        // 設置標記，避免重複重定向
        sessionStorage.setItem('fromRegistration', 'true');
        
        return backendResult.success;
        
    } catch (error) {
        console.error('❌ 註冊過程出錯:', error);
        return false;
    }
}

// ============================================
// 📱 LINE 相關功能
// ============================================

// 初始化 LIFF
async function initLiff() {
    try {
        if (typeof liff !== 'undefined') {
            await liff.init({ liffId: '2008231249-7DlMkygo' });
            liffInitialized = true;
            console.log('✅ LIFF 初始化成功');
        }
    } catch (error) {
        console.log('ℹ️ LIFF 初始化失敗或未使用 LIFF');
        liffInitialized = false;
    }
}

async function getLineProfile() {
    try {
        console.log('📱 取得 LINE 用戶資料...');
        const profile = await liff.getProfile();
        
        localStorage.setItem('lineUserId', profile.userId);
        localStorage.setItem('lineDisplayName', profile.displayName);
        localStorage.setItem('linePictureUrl', profile.pictureUrl || '');
        
        // 更新界面
        updateUserInterface({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
        });
        
        console.log('✅ LINE 用戶資料取得成功:', profile.displayName);
        
        // 真正的註冊狀態檢查
        const isRegistered = await checkUserRegistration(profile.userId);
        console.log('📊 真實註冊檢查結果:', isRegistered);
        
        if (!isRegistered) {
            console.log('🆕 新用戶需要註冊，重定向到註冊頁面');
            setTimeout(() => {
                redirectToRegistration();
            }, 1000);
        } else {
            console.log('✅ 已註冊用戶，可以開始遊戲');
            // 隱藏登入畫面
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.classList.add('hidden');
            }
        }
        
    } catch (error) {
        console.error('❌ 取得 LINE 用戶資料失敗:', error);
        alert('取得用戶資料失敗，請重試');
    }
}

// ============================================
// 📄 頁面初始化功能（修復版）
// ============================================

async function initializeApp() {
    console.log('=== 📱 初始化應用程式 (強制後端驗證版) ===');
    
    // 先執行資料修復
    checkAndFixAllData();
    
    try {
        await initLiff();
        
        if (liffInitialized && liff.isLoggedIn()) {
            console.log('✅ LIFF 用戶已登入，自動取得資料');
            await getLineProfile();
            return;
        }
    } catch (error) {
        console.log('ℹ️ LIFF 初始化失敗或未使用 LIFF，繼續其他登入方式');
    }
    
    // 處理 URL 參數方式登入
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
        
        // 真正的註冊狀態檢查
        const isRegistered = await checkUserRegistration(lineUserId);
        if (!isRegistered) {
            console.log('🆕 新用戶需要註冊');
            redirectToRegistration();
        }
        
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
            
            // 真正的註冊狀態檢查
            const isRegistered = await checkUserRegistration(storedUserId);
            if (!isRegistered) {
                console.log('🆕 已登入但未註冊，重定向到註冊頁面');
                redirectToRegistration();
                return;
            }
        } else {
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.classList.remove('hidden');
            }
        }
    }
    
    console.log('✅ 應用程式初始化完成');
}

// ============================================
// 🎮 遊戲功能
// ============================================

// 遊戲開始前的註冊檢查
function checkRegistrationBeforeGame() {
    console.log('🎮 遊戲開始前檢查註冊狀態');
    return enforceRegistration();
}

// ============================================
// 🛠️ 調試工具（增強版）
// ============================================

// 真實註冊狀態調試
window.debugRealRegistration = async function() {
    console.log('=== 🔍 真實註冊狀態調試 ===');
    const userId = localStorage.getItem('lineUserId');
    console.log('用戶ID:', userId);
    
    const userProfile = getUserProfile();
    console.log('userProfile:', userProfile);
    console.log('userProfile 完整性:', userProfile ? 
        (userProfile.nickname && userProfile.county ? '完整' : '不完整') : '不存在');
    
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    console.log('registeredUsers:', registeredUsers);
    
    console.log('🌐 開始後端驗證...');
    const backendResult = await verifyRegistrationWithBackend(userId);
    console.log('後端驗證結果:', backendResult);
    console.log('=== 調試結束 ===');
};

// 手動修復命令
window.fixRegistration = function() {
    console.log('🔧 手動修復註冊狀態...');
    const userId = localStorage.getItem('lineUserId');
    if (!userId) {
        console.log('❌ 未找到用戶ID');
        return false;
    }
    
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    const userProfile = getUserProfile();
    
    if (userProfile) {
        registeredUsers[userId] = {
            registered: true,
            timestamp: new Date().toISOString(),
            fixed: true
        };
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        console.log('✅ 手動修復完成');
        return true;
    }
    return false;
};

// 清除所有資料（開發用）
window.clearAllData = function() {
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ 所有資料已清除');
    location.reload();
};

// 測試 GAS 連接
window.testGASConnection = async function() {
    console.log('🌐 測試 GAS 連接...');
    const result = await callGAS('test');
    console.log('GAS 測試結果:', result);
    return result;
};

// 手動註冊用戶
window.manualRegister = async function() {
    const userData = getUserProfile();
    if (!userData) {
        console.log('❌ 沒有用戶資料');
        return;
    }
    console.log('🔄 手動註冊用戶:', userData);
    const result = await completeRegistration(userData);
    console.log('手動註冊結果:', result);
    return result;
};

// ============================================
// 🚀 頁面載入初始化
// ============================================

// 在頁面載入時執行初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 頁面載入完成，開始初始化...');
    console.log('🔧 common.js 版本: 4.0 (完整後端驗證版)');
    console.log('🌐 GAS URL:', GAS_URL);
    initializeApp();
});

// ============================================
// 📊 工具函數
// ============================================

// 顯示狀態訊息
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
    }
    console.log(`📢 ${type}: ${message}`);
}

// 隨機數生成
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 格式化數字（金幣顯示）
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
