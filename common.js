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
