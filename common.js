// ============================================
// 🎨 用戶界面更新功能（新增 - 修復錯誤）
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
                // 更新當前玩家位置
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

// 計算位置坐標（示例函數）
function calculatePosition(position) {
    // 這裡根據您的遊戲板佈局實現具體的位置計算
    const positions = [
        '0px, 0px', '100px, 0px', '200px, 0px', '300px, 0px',
        '300px, 100px', '300px, 200px', '300px, 300px',
        '200px, 300px', '100px, 300px', '0px, 300px',
        '0px, 200px', '0px, 100px'
    ];
    return positions[position % positions.length] || '0px, 0px';
}

// ============================================
// 🔐 註冊狀態檢查功能（修正版）
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

// 檢查用戶是否已註冊（修正版）
function checkUserRegistration(userId) {
    if (!userId) {
        console.log('❌ 用戶ID為空');
        return false;
    }
    
    console.log('🔍 檢查用戶註冊狀態，用戶ID:', userId);
    
    // 方法1: 檢查已註冊用戶列表
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    console.log('📋 註冊用戶列表:', registeredUsers);
    
    if (registeredUsers[userId]) {
        console.log('✅ 用戶已在註冊列表中');
        
        // 同時驗證 userProfile 完整性
        const isProfileValid = validateUserProfile(userId);
        if (!isProfileValid) {
            console.log('⚠️ 在註冊列表中但 userProfile 不完整，嘗試修復...');
            repairUserProfile(userId, registeredUsers[userId]);
        }
        
        return true;
    }
    
    // 方法2: 檢查用戶資料完整性
    const isProfileValid = validateUserProfile(userId);
    if (isProfileValid) {
        console.log('✅ 用戶資料完整，自動添加到註冊列表');
        // 如果資料完整但不在註冊列表中，自動添加到註冊列表
        registeredUsers[userId] = {
            registered: true,
            timestamp: new Date().toISOString(),
            autoAdded: true
        };
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        return true;
    }
    
    console.log('❌ 用戶未註冊');
    return false;
}

// ============================================
// 📋 用戶資料驗證功能（修正版）
// ============================================

// 驗證用戶資料完整性
function validateUserProfile(userId) {
    console.log('🔍 驗證用戶資料完整性...');
    
    // 檢查 userProfile
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

// ============================================
// 🔄 頁面導航功能（修正版）
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

// 完成註冊的函數
function completeRegistration(userData) {
    const userId = userData.lineUserId;
    
    // 儲存完整的用戶資料
    localStorage.setItem('userProfile', JSON.stringify(userData));
    
    // 記錄已註冊用戶
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    registeredUsers[userId] = {
        registered: true,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
    
    console.log('✅ 註冊完成，用戶資料已保存');
    
    // 設置標記，避免重複重定向
    sessionStorage.setItem('fromRegistration', 'true');
}

// ============================================
// 📱 LINE 相關功能（修正版）
// ============================================

let liffInitialized = false;

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
        
        // 檢查註冊狀態
        const isRegistered = checkUserRegistration(profile.userId);
        console.log('📊 註冊檢查結果:', isRegistered);
        
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
// 📄 頁面初始化函數（修正版）
// ============================================

async function initializeApp() {
    console.log('=== 📱 初始化應用程式 ===');
    
    try {
        await initLiff();
        
        if (liffInitialized && liff.isLoggedIn()) {
            console.log('✅ LIFF 用戶已登入，自動取得資料');
            await getLineProfile();
            
            // 檢查註冊狀態
            const user = getCurrentUser();
            if (user && user.userId) {
                if (!checkUserRegistration(user.userId)) {
                    console.log('🆕 用戶需要註冊');
                    return;
                }
            }
            
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
        
        // 檢查註冊狀態
        const isRegistered = checkUserRegistration(lineUserId);
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
            
            // 檢查註冊狀態
            const isRegistered = checkUserRegistration(storedUserId);
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
}

// ============================================
// 🎮 遊戲開始前的註冊檢查
// ============================================

function checkRegistrationBeforeGame() {
    console.log('🎮 遊戲開始前檢查註冊狀態');
    return enforceRegistration();
}

// 在遊戲主頁面調用示例：
// if (!checkRegistrationBeforeGame()) {
//     return; // 如果未註冊，停止遊戲初始化
// }
