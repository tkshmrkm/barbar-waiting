// =============================================
// 理容室 待合状況管理アプリ
// =============================================

// デフォルト設定
const DEFAULT_SETTINGS = {
    shop: {
        name: 'ヘアーステージ K&M',
        address: '京都府京都市伏見区久我本町11-172',
        phone: '075-935-3773'
    },
    waiting: {
        maxCount: 3,
        seatCount: 2
    },
    service: {
        cutName: 'カット',
        cutTime: 60,
        special1Name: '特殊1',
        special1Time: 180,
        special2Name: '特殊2',
        special2Time: 120
    },
    businessHours: {
        0: { closed: false, open: '08:30', close: '18:00', label: '', note: '' },
        1: { closed: true, open: '09:30', close: '19:00', label: '', note: '' },
        2: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        3: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        4: { closed: false, open: '13:00', close: '21:00', label: 'ナイター', note: '祝日除く' },
        5: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        6: { closed: false, open: '09:30', close: '19:00', label: '', note: '' }
    },
    closedDays: [1],
    weeklyClosed: [
        { week: 2, day: 2 },
        { week: 3, day: 2 }
    ],
    holidayHours: { open: '08:30', close: '18:00' },
    holidayOverrideDays: [4]  // 祝日の場合に祝日営業時間を適用する曜日（木曜）
};

// 店舗設定（ロード時に読み込む）
let shopSettings = {};

// アプリの状態
const state = {
    waitingCount: 0,
    activeServices: [],
    specialDates: {},
    temporaryClosedToday: false,
    lastCheckedDate: null
};

// サービス時間を取得
function getServiceTimes() {
    return {
        cut: shopSettings.service?.cutTime || 60,
        special1: shopSettings.service?.special1Time || 180,
        special2: shopSettings.service?.special2Time || 120
    };
}

// メニュー名を取得
function getServiceNames() {
    return {
        cut: shopSettings.service?.cutName || 'カット',
        special1: shopSettings.service?.special1Name || '特殊1',
        special2: shopSettings.service?.special2Name || '特殊2'
    };
}

// パスワード管理
const DEFAULT_PASSWORD = '1234';

function getAdminPassword() {
    return localStorage.getItem('adminPassword') || DEFAULT_PASSWORD;
}

function setAdminPassword(newPassword) {
    localStorage.setItem('adminPassword', newPassword);
}

function verifyPassword(input) {
    return input === getAdminPassword();
}

// =============================================
// 初期化
// =============================================
async function init() {
    try {
        // Supabaseの準備を待つ
        if (typeof supabase === 'undefined') {
            console.error('Supabaseが読み込まれていません');
            alert('接続エラー: ページを再読み込みしてください');
            return;
        }
        
        await loadShopSettings();
        await loadState();
        await cleanupExpiredSpecialDates();
        applyShopSettings();
        updateCustomerView();
        updateAdminView();
        attachEventListeners();
        
        // リアルタイム購読を開始
        subscribeToRealtimeUpdates();
        
        console.log('アプリ起動完了（Supabase接続）');
    } catch (e) {
        console.error('初期化エラー:', e);
        alert('アプリの起動に失敗しました: ' + e.message);
    }
}

// 期限切れの特別営業日を削除
async function cleanupExpiredSpecialDates() {
    if (!state.specialDates) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);
    
    let cleaned = false;
    Object.keys(state.specialDates).forEach(dateStr => {
        // 過去の日付を削除（今日は残す）
        if (dateStr < todayStr) {
            delete state.specialDates[dateStr];
            cleaned = true;
        }
    });
    
    if (cleaned) {
        await saveState();
        console.log('期限切れの特別営業日を削除しました');
    }
}

// 店舗設定の読み込み（Supabase版）
async function loadShopSettings() {
    try {
        const { data, error } = await supabase
            .from('shop_settings')
            .select('settings')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        
        if (data && data.settings && Object.keys(data.settings).length > 0) {
            shopSettings = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), data.settings);
        } else {
            shopSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            // 初期設定をSupabaseに保存
            await saveShopSettings();
        }
        console.log('店舗設定を読み込みました');
    } catch (e) {
        console.error('店舗設定の読み込みエラー:', e);
        shopSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
}

// 店舗設定の保存（Supabase版）
async function saveShopSettings() {
    try {
        const { error } = await supabase
            .from('shop_settings')
            .upsert({ 
                id: 1, 
                settings: shopSettings,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        console.log('店舗設定を保存しました');
    } catch (e) {
        console.error('店舗設定の保存エラー:', e);
    }
}

function mergeDeep(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            mergeDeep(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

// 店舗設定を画面に反映
function applyShopSettings() {
    // 店舗名
    const shopNameDisplay = document.getElementById('shopNameDisplay');
    if (shopNameDisplay && shopSettings.shop?.name) {
        shopNameDisplay.textContent = '✂️ ' + shopSettings.shop.name;
    }
    
    // 住所
    const shopAddressDisplay = document.getElementById('shopAddressDisplay');
    if (shopAddressDisplay && shopSettings.shop?.address) {
        shopAddressDisplay.textContent = '📍 ' + shopSettings.shop.address;
    }
    
    // 電話番号
    const shopPhoneDisplay = document.getElementById('shopPhoneDisplay');
    if (shopPhoneDisplay) {
        if (shopSettings.shop?.phone) {
            shopPhoneDisplay.style.display = 'block';
            shopPhoneDisplay.href = 'tel:' + shopSettings.shop.phone.replace(/-/g, '');
            const phoneNumber = shopPhoneDisplay.querySelector('.phone-number');
            if (phoneNumber) {
                phoneNumber.textContent = shopSettings.shop.phone;
            }
        } else {
            shopPhoneDisplay.style.display = 'none';
        }
    }
    
    // 待合最大人数の表示
    const maxWaiting = shopSettings.waiting?.maxCount || 3;
    const waitingNote = document.getElementById('waitingNote');
    if (waitingNote) {
        waitingNote.textContent = `（待合席は${maxWaiting}人まで）`;
    }
    const waitingLimitNote = document.getElementById('waitingLimitNote');
    if (waitingLimitNote) {
        waitingLimitNote.textContent = `（最大${maxWaiting}人）`;
    }
    
    // クイックボタンの動的生成
    renderQuickButtons();
    
    // 席の動的生成
    renderSeatsCustomerView();
    renderSeatsAdminView();
    
    // 営業時間表示
    renderBusinessHoursDisplay();
}

// クイックボタンを動的生成
function renderQuickButtons() {
    const container = document.getElementById('quickButtons');
    if (!container) return;
    
    const maxWaiting = shopSettings.waiting?.maxCount || 3;
    container.innerHTML = '';
    
    for (let i = 0; i <= maxWaiting; i++) {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        if (i === maxWaiting) {
            btn.classList.add('full');
            btn.innerHTML = `${i}人<br><small>満席</small>`;
        } else {
            btn.textContent = `${i}人`;
        }
        btn.dataset.count = i;
        btn.addEventListener('click', () => {
            state.waitingCount = i;
            updateAdminView();
        });
        container.appendChild(btn);
    }
}

// お客様画面の席表示を動的生成
function renderSeatsCustomerView() {
    const container = document.getElementById('seatsStatus');
    if (!container) return;
    
    const seatCount = shopSettings.waiting?.seatCount || 2;
    container.innerHTML = '';
    
    for (let i = 0; i < seatCount; i++) {
        const seatDiv = document.createElement('div');
        seatDiv.className = 'seat-info';
        seatDiv.id = `seat${i + 1}Info`;
        seatDiv.innerHTML = `
            <span class="seat-label">席${i + 1}</span>
            <span class="seat-type" id="seat${i + 1}CustomerType">空き</span>
            <span class="seat-remain" id="seat${i + 1}CustomerRemain"></span>
        `;
        container.appendChild(seatDiv);
    }
}

// 管理者画面の席カードを動的生成
function renderSeatsAdminView() {
    const container = document.getElementById('seatsContainer');
    if (!container) return;
    
    const seatCount = shopSettings.waiting?.seatCount || 2;
    const serviceNames = getServiceNames();
    container.innerHTML = '';
    
    for (let i = 0; i < seatCount; i++) {
        const seatCard = document.createElement('div');
        seatCard.className = 'seat-card';
        seatCard.id = `seat${i + 1}Card`;
        seatCard.innerHTML = `
            <div class="seat-header">
                <span class="seat-name">席 ${i + 1}</span>
                <span class="seat-status" id="seat${i + 1}Status">空き</span>
            </div>
            <div class="seat-controls" id="seat${i + 1}Controls">
                <button class="seat-btn start-btn" data-seat="${i}" data-service="cut">
                    ✂️ ${serviceNames.cut}
                </button>
                <button class="seat-btn start-btn special1" data-seat="${i}" data-service="special1">
                    ⭐ ${serviceNames.special1}
                </button>
                <button class="seat-btn start-btn special2" data-seat="${i}" data-service="special2">
                    💫 ${serviceNames.special2}
                </button>
            </div>
            <div class="seat-active" id="seat${i + 1}Active" style="display: none;">
                <div class="active-info">
                    <span class="active-type" id="seat${i + 1}Type">カット中</span>
                    <span class="active-time" id="seat${i + 1}Time">残り --分</span>
                </div>
                <button class="end-btn" data-seat="${i}">✓ 終了</button>
            </div>
        `;
        container.appendChild(seatCard);
    }
    
    // イベントリスナーを再設定
    attachSeatEventListeners();
}

// 席のイベントリスナーを設定
function attachSeatEventListeners() {
    const serviceNames = getServiceNames();
    
    // 開始ボタン
    document.querySelectorAll('.start-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.seat);
            const type = btn.dataset.service;
            
            if (state.activeServices[index]) {
                showToast('この席は既に使用中です');
                return;
            }
            
            state.activeServices[index] = {
                type: type,
                startTime: Date.now()
            };
            
            if (state.waitingCount > 0) {
                state.waitingCount--;
            }
            
            await saveState();
            updateAdminView();
            updateCustomerView();
            
            const typeName = serviceNames[type] || type;
            showToast(`席${index + 1}で${typeName}を開始`);
        });
    });
    
    // 終了ボタン
    document.querySelectorAll('.end-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.seat);
            
            if (!state.activeServices[index]) return;
            
            state.activeServices[index] = null;
            await saveState();
            updateAdminView();
            updateCustomerView();
            
            showToast(`席${index + 1}の施術を終了`);
        });
    });
}

// =============================================
// 状態の保存・読み込み（Supabase版）
// =============================================
async function saveState() {
    try {
        const { error } = await supabase
            .from('shop_state')
            .upsert({
                id: 1,
                waiting_count: state.waitingCount,
                active_services: state.activeServices,
                special_dates: state.specialDates,
                temporary_closed_today: state.temporaryClosedToday,
                last_checked_date: state.lastCheckedDate,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        updateLastUpdateTime();
        console.log('状態を保存しました');
    } catch (e) {
        console.error('状態の保存エラー:', e);
    }
}

async function loadState() {
    try {
        const { data, error } = await supabase
            .from('shop_state')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        
        if (data) {
            state.waitingCount = data.waiting_count || 0;
            state.activeServices = data.active_services || [];
            state.specialDates = data.special_dates || {};
            state.temporaryClosedToday = data.temporary_closed_today || false;
            state.lastCheckedDate = data.last_checked_date || null;
        }
        console.log('状態を読み込みました');
    } catch (e) {
        console.error('状態の読み込みエラー:', e);
        await resetState();
        return;
    }
    
    // 席数に合わせてactiveServicesの配列サイズを調整
    const seatCount = shopSettings.waiting?.seatCount || 2;
    while (state.activeServices.length < seatCount) {
        state.activeServices.push(null);
    }
    // 席数が減った場合は切り詰める
    if (state.activeServices.length > seatCount) {
        state.activeServices = state.activeServices.slice(0, seatCount);
    }
    
    // 待ち人数が最大を超えていたら調整
    const maxWaiting = shopSettings.waiting?.maxCount || 3;
    if (state.waitingCount > maxWaiting) {
        state.waitingCount = maxWaiting;
    }
}

// 状態をリセット
async function resetState() {
    const seatCount = shopSettings.waiting?.seatCount || 2;
    state.waitingCount = 0;
    state.activeServices = new Array(seatCount).fill(null);
    state.specialDates = {};
    state.temporaryClosedToday = false;
    state.lastCheckedDate = formatDate(new Date());
    await saveState();
}

// リアルタイム購読
function subscribeToRealtimeUpdates() {
    supabase
        .channel('shop_state_changes')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'shop_state' },
            (payload) => {
                console.log('リアルタイム更新を受信:', payload);
                const data = payload.new;
                state.waitingCount = data.waiting_count || 0;
                state.activeServices = data.active_services || [];
                state.specialDates = data.special_dates || {};
                state.temporaryClosedToday = data.temporary_closed_today || false;
                state.lastCheckedDate = data.last_checked_date || null;
                
                // 画面を更新
                updateCustomerView();
                updateAdminView();
                updateLastUpdateTime();
            }
        )
        .subscribe();
    
    console.log('リアルタイム購読を開始しました');
}

// =============================================
// 営業時間の判定
// =============================================
function isCurrentlyOpen() {
    if (state.temporaryClosedToday) return false;
    
    const now = new Date();
    const hours = getBusinessHoursForDate(now);
    
    if (!hours || hours.closed) return false;
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;
    
    return currentTime >= openTime && currentTime < closeTime;
}

function getBusinessHoursForDate(date) {
    const dateStr = formatDate(date);
    
    // 特別営業日チェック（最優先）
    if (state.specialDates && state.specialDates[dateStr]) {
        return state.specialDates[dateStr];
    }
    
    const day = date.getDay();
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    
    // 定休日チェック
    const closedDays = shopSettings.closedDays || [];
    if (closedDays.includes(day)) {
        return { closed: true };
    }
    
    // 特定週の定休日チェック
    const weeklyClosed = shopSettings.weeklyClosed || [];
    for (const item of weeklyClosed) {
        if (item.day === day && item.week === weekOfMonth) {
            return { closed: true };
        }
    }
    
    // 祝日チェック
    const holidays = getHolidaysForYear(date.getFullYear());
    if (holidays.includes(dateStr)) {
        // 祝日オーバーライド対象の曜日かチェック
        const holidayOverrideDays = shopSettings.holidayOverrideDays || [];
        if (holidayOverrideDays.includes(day)) {
            // 祝日営業時間を適用
            const holidayHours = shopSettings.holidayHours || { open: '08:30', close: '18:00' };
            return { ...holidayHours, closed: false, isHoliday: true };
        }
        // オーバーライド対象でない場合は通常営業
    }
    
    // 通常営業（設定から取得）
    const dayHours = shopSettings.businessHours?.[day];
    if (dayHours) {
        return dayHours;
    }
    
    // フォールバック
    return { open: '09:30', close: '19:00', closed: false };
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getHolidaysForYear(year) {
    const holidays = [];
    
    // 固定祝日
    const fixedHolidays = [
        [1, 1],   // 元日
        [2, 11],  // 建国記念の日
        [2, 23],  // 天皇誕生日
        [4, 29],  // 昭和の日
        [5, 3],   // 憲法記念日
        [5, 4],   // みどりの日
        [5, 5],   // こどもの日
        [8, 11],  // 山の日
        [11, 3],  // 文化の日
        [11, 23], // 勤労感謝の日
    ];
    
    fixedHolidays.forEach(([month, day]) => {
        holidays.push(formatDateString(year, month, day));
    });
    
    // ハッピーマンデー（第N月曜日）
    holidays.push(getNthWeekday(year, 1, 1, 2));  // 成人の日: 1月第2月曜
    holidays.push(getNthWeekday(year, 7, 1, 3));  // 海の日: 7月第3月曜
    holidays.push(getNthWeekday(year, 9, 1, 3));  // 敬老の日: 9月第3月曜
    holidays.push(getNthWeekday(year, 10, 1, 2)); // スポーツの日: 10月第2月曜
    
    // 春分の日（計算で求める）
    const shunbun = getShunbunDay(year);
    holidays.push(formatDateString(year, 3, shunbun));
    
    // 秋分の日（計算で求める）
    const shubun = getShubunDay(year);
    holidays.push(formatDateString(year, 9, shubun));
    
    // 振替休日を追加
    const substituteHolidays = [];
    holidays.forEach(dateStr => {
        const date = new Date(dateStr);
        if (date.getDay() === 0) { // 日曜日
            // 翌日を振替休日に
            const substitute = new Date(date);
            substitute.setDate(substitute.getDate() + 1);
            substituteHolidays.push(formatDate(substitute));
        }
    });
    
    // 国民の休日（祝日と祝日に挟まれた日）
    // 敬老の日と秋分の日の間の場合
    const keiroDate = new Date(getNthWeekday(year, 9, 1, 3));
    const shubunDate = new Date(formatDateString(year, 9, shubun));
    const diffDays = (shubunDate - keiroDate) / (1000 * 60 * 60 * 24);
    if (diffDays === 2) {
        const kokuminDate = new Date(keiroDate);
        kokuminDate.setDate(kokuminDate.getDate() + 1);
        substituteHolidays.push(formatDate(kokuminDate));
    }
    
    return [...holidays, ...substituteHolidays];
}

// 第N週の特定曜日を取得
function getNthWeekday(year, month, weekday, n) {
    const firstDay = new Date(year, month - 1, 1);
    let dayOfWeek = firstDay.getDay();
    let diff = weekday - dayOfWeek;
    if (diff < 0) diff += 7;
    const day = 1 + diff + (n - 1) * 7;
    return formatDateString(year, month, day);
}

// 春分の日を計算（1900-2099年対応）
function getShunbunDay(year) {
    if (year >= 1900 && year <= 1979) {
        return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
    } else if (year >= 1980 && year <= 2099) {
        return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }
    return 20; // フォールバック
}

// 秋分の日を計算（1900-2099年対応）
function getShubunDay(year) {
    if (year >= 1900 && year <= 1979) {
        return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
    } else if (year >= 1980 && year <= 2099) {
        return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }
    return 23; // フォールバック
}

// 日付文字列を生成
function formatDateString(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// =============================================
// 待ち時間計算
// =============================================
function calculateTotalWaitTime() {
    const SERVICE_TIMES = getServiceTimes();
    let totalWait = 0;
    
    // 施術中の残り時間
    const earliest = getEarliestEndingService();
    if (earliest && earliest.remaining > 0) {
        totalWait += earliest.remaining;
    }
    
    // 待ち人数分の時間（カット時間として計算）
    totalWait += state.waitingCount * SERVICE_TIMES.cut;
    
    return totalWait;
}

function getEarliestEndingService() {
    const SERVICE_TIMES = getServiceTimes();
    const services = state.activeServices.filter(s => s !== null);
    if (services.length === 0) return null;
    
    let earliest = null;
    let minRemaining = Infinity;
    
    services.forEach(service => {
        const elapsed = Math.floor((Date.now() - service.startTime) / 60000);
        const duration = SERVICE_TIMES[service.type] || 60;
        const remaining = Math.max(0, duration - elapsed);
        
        if (remaining < minRemaining) {
            minRemaining = remaining;
            earliest = { ...service, remaining };
        }
    });
    
    return earliest;
}

// =============================================
// 営業時間表示のレンダリング
// =============================================
function renderBusinessHoursDisplay() {
    const container = document.getElementById('businessHoursDisplay');
    if (!container) return;
    
    const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
    const businessHours = shopSettings.businessHours || DEFAULT_SETTINGS.businessHours;
    const closedDays = shopSettings.closedDays || [];
    const weeklyClosed = shopSettings.weeklyClosed || [];
    
    // 営業パターンをグループ化
    const patterns = [];
    const usedDays = new Set();
    
    // まず特別な営業時間（ラベルや注釈があるもの）を処理
    for (let day = 0; day < 7; day++) {
        const hours = businessHours[day];
        if (hours && !hours.closed && !closedDays.includes(day) && (hours.label || hours.note)) {
            patterns.push({
                days: [day],
                dayName: DAY_NAMES[day] + '曜日',
                hours: hours,
                hasLabel: true
            });
            usedDays.add(day);
        }
    }
    
    // 同じ営業時間の曜日をグループ化
    const groups = {};
    for (let day = 0; day < 7; day++) {
        if (usedDays.has(day)) continue;
        
        const hours = businessHours[day];
        if (hours && !hours.closed && !closedDays.includes(day)) {
            const key = `${hours.open}-${hours.close}`;
            if (!groups[key]) {
                groups[key] = { days: [], hours: hours };
            }
            groups[key].days.push(day);
            usedDays.add(day);
        }
    }
    
    // グループを表示用に変換
    Object.values(groups).forEach(group => {
        let dayName;
        if (group.days.length === 1) {
            dayName = DAY_NAMES[group.days[0]] + '曜日';
        } else if (isConsecutiveDays(group.days)) {
            dayName = DAY_NAMES[group.days[0]] + '〜' + DAY_NAMES[group.days[group.days.length - 1]];
        } else {
            // 平日判定
            const weekdays = [1, 2, 3, 4, 5];
            if (weekdays.every(d => group.days.includes(d)) && group.days.length === 5) {
                dayName = '平日';
            } else {
                dayName = group.days.map(d => DAY_NAMES[d]).join('・');
            }
        }
        patterns.push({
            days: group.days,
            dayName: dayName,
            hours: group.hours,
            hasLabel: false
        });
    });
    
    // 定休日情報を作成
    let closedText = '';
    const closedDayNames = closedDays.map(d => DAY_NAMES[d] + '曜');
    
    // 特定週の定休日
    const weeklyClosedText = weeklyClosed.map(item => {
        const weekName = ['', '第1', '第2', '第3', '第4', '第5'][item.week] || '';
        return weekName + DAY_NAMES[item.day] + '曜';
    });
    
    const allClosed = [...closedDayNames, ...weeklyClosedText];
    if (allClosed.length > 0) {
        closedText = allClosed.join('・');
    }
    
    // HTMLを生成
    let html = '';
    
    // 営業時間を表示（平日を先に）
    patterns.sort((a, b) => {
        if (a.dayName === '平日') return -1;
        if (b.dayName === '平日') return 1;
        return 0;
    });
    
    patterns.forEach(pattern => {
        const hours = pattern.hours;
        let dayContent = pattern.dayName;
        
        if (hours.label) {
            dayContent += ` <span class="badge">${hours.label}</span>`;
        }
        if (hours.note) {
            dayContent += `<br><small class="day-note">（${hours.note}）</small>`;
        }
        
        html += `
            <div class="hours-row">
                <span class="day">${dayContent}</span>
                <span class="time">${hours.open} - ${hours.close}</span>
            </div>
        `;
    });
    
    // 定休日
    if (closedText) {
        html += `
            <div class="hours-row closed-row">
                <span class="day">定休日</span>
                <span class="time">${closedText}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function isConsecutiveDays(days) {
    if (days.length <= 1) return true;
    const sorted = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i-1] !== 1) return false;
    }
    return true;
}

// =============================================
// お客様画面の更新
// =============================================
function updateCustomerView() {
    checkDateChange();
    updateTodayHours();
    
    const isOpen = isCurrentlyOpen();
    
    // 営業終了時に自動リセット
    if (!isOpen && (state.activeServices.length > 0 || state.waitingCount > 0)) {
        state.activeServices = [];
        state.waitingCount = 0;
        saveState();
    }
    
    const statusCard = document.getElementById('statusCard');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const closedView = document.getElementById('closedView');
    const openView = document.getElementById('openView');
    
    if (isOpen) {
        statusBadge?.classList.remove('closed');
        if (statusText) statusText.textContent = '営業中';
        if (closedView) closedView.style.display = 'none';
        if (openView) openView.style.display = 'block';
    } else {
        statusBadge?.classList.add('closed');
        if (statusText) statusText.textContent = '営業時間外';
        if (closedView) closedView.style.display = 'block';
        if (openView) openView.style.display = 'none';
        updateNextOpeningTime();
    }
    
    // 待ち人数
    const waitingCount = document.getElementById('waitingCount');
    if (waitingCount) waitingCount.textContent = state.waitingCount;
    
    // 施術状況
    updateServiceDisplay();
    
    // 次の案内時間
    updateServiceTimeRange();
    
    // おすすめ表示
    const totalWaitTime = calculateTotalWaitTime();
    const isReceptionEnded = checkReceptionEnded();
    updateRecommendation(totalWaitTime, isOpen, isReceptionEnded);
    
    // 特別営業日
    updateUpcomingSpecialDates();
    
    // 最終更新時刻
    updateLastUpdateTime();
}

function checkDateChange() {
    const today = formatDate(new Date());
    if (state.lastCheckedDate !== today) {
        // 日付が変わったら状態をリセット
        state.temporaryClosedToday = false;
        state.waitingCount = 0;
        state.activeServices = state.activeServices.map(() => null);
        state.lastCheckedDate = today;
        saveState();
        console.log('日付変更により状態をリセットしました');
    }
    
    // 閉店後のリセットチェック
    checkClosingTimeReset();
}

// 閉店時間後のリセット
function checkClosingTimeReset() {
    const now = new Date();
    const hours = getBusinessHoursForDate(now);
    
    // 休業日または営業時間外の場合
    if (!hours || hours.closed) {
        return; // 休業日はリセット不要
    }
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const closeTime = closeH * 60 + closeM;
    
    // 閉店時間を30分以上過ぎていたらリセット
    if (currentTime > closeTime + 30) {
        const hasActiveData = state.waitingCount > 0 || state.activeServices.some(s => s !== null);
        if (hasActiveData) {
            state.waitingCount = 0;
            state.activeServices = state.activeServices.map(() => null);
            saveState();
            console.log('閉店時間超過により状態をリセットしました');
        }
    }
}

function updateTodayHours() {
    const todayTime = document.getElementById('todayTime');
    const todayHours = document.getElementById('todayHours');
    const hours = getBusinessHoursForDate(new Date());
    
    if (!todayTime) return;
    
    if (hours && !hours.closed) {
        let timeText = `${hours.open} - ${hours.close}`;
        if (hours.isHoliday) {
            timeText += '（祝日）';
        }
        todayTime.textContent = timeText;
        todayHours?.classList.remove('closed-today');
    } else {
        todayTime.textContent = '本日休業';
        todayHours?.classList.add('closed-today');
    }
}

function updateServiceDisplay() {
    const SERVICE_TIMES = getServiceTimes();
    const serviceNames = getServiceNames();
    const seatCount = shopSettings.waiting?.seatCount || 2;
    
    // 各席の残り時間を計算
    const seatInfos = [];
    for (let i = 0; i < seatCount; i++) {
        const service = state.activeServices[i];
        if (service) {
            const elapsed = Math.floor((Date.now() - service.startTime) / 60000);
            const duration = SERVICE_TIMES[service.type] || 60;
            const remaining = Math.max(0, duration - elapsed);
            seatInfos.push({
                index: i,
                type: service.type,
                remaining: remaining,
                active: true
            });
        } else {
            seatInfos.push({
                index: i,
                type: null,
                remaining: 0,
                active: false
            });
        }
    }
    
    // 次に空く席を特定
    const activeSeatsSorted = seatInfos
        .filter(s => s.active)
        .sort((a, b) => a.remaining - b.remaining);
    const nextAvailableSeatIndex = activeSeatsSorted.length > 0 ? activeSeatsSorted[0].index : -1;
    
    // 各席の表示を更新
    seatInfos.forEach((seat, i) => {
        const seatInfo = document.getElementById(`seat${i + 1}Info`);
        const seatType = document.getElementById(`seat${i + 1}CustomerType`);
        const seatRemain = document.getElementById(`seat${i + 1}CustomerRemain`);
        
        if (!seatInfo) return;
        
        seatInfo.classList.remove('active', 'next-available');
        
        if (seat.active) {
            seatInfo.classList.add('active');
            const typeName = serviceNames[seat.type] || seat.type;
            if (seatType) seatType.textContent = typeName;
            if (seatRemain) {
                if (seat.index === nextAvailableSeatIndex && activeSeatsSorted.length > 0) {
                    seatInfo.classList.add('next-available');
                    seatRemain.innerHTML = `残り${seat.remaining}分 <span class="next-badge">次に空く</span>`;
                } else {
                    seatRemain.textContent = `残り${seat.remaining}分`;
                }
            }
        } else {
            if (seatType) seatType.textContent = '空き';
            if (seatRemain) seatRemain.textContent = '';
        }
    });
}

function updateServiceTimeRange() {
    const serviceTimeRange = document.getElementById('serviceTimeRange');
    const waitTimeNote = document.getElementById('waitTimeNote');
    
    if (!serviceTimeRange) return;
    
    const isOpen = isCurrentlyOpen();
    const hasWaiting = state.waitingCount > 0;
    const hasActive = state.activeServices.some(s => s !== null);
    
    if (!isOpen) {
        serviceTimeRange.textContent = '--:-- ～ --:--頃';
        if (waitTimeNote) waitTimeNote.textContent = '';
        return;
    }
    
    if (!hasWaiting && !hasActive) {
        serviceTimeRange.textContent = '今すぐご案内可能';
        if (waitTimeNote) waitTimeNote.textContent = '';
        return;
    }
    
    // 閉店時間チェック
    const hours = getBusinessHoursForDate(new Date());
    if (!hours || hours.closed) {
        serviceTimeRange.textContent = '本日休業';
        if (waitTimeNote) waitTimeNote.textContent = '';
        return;
    }
    
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const closeTime = closeH * 60 + closeM;
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // 次に空く席の時間を基準に計算
    const earliest = getEarliestEndingService();
    const SERVICE_TIMES = getServiceTimes();
    
    let baseWaitMinutes = 0;
    if (earliest && earliest.remaining > 0) {
        baseWaitMinutes = earliest.remaining;
    }
    
    // 待ち人数分の時間を追加
    const waitingTime = state.waitingCount * SERVICE_TIMES.cut;
    const totalWait = baseWaitMinutes + waitingTime;
    
    // 5分刻みに丸める（切り上げ）
    const roundTo5 = (minutes) => Math.ceil(minutes / 5) * 5;
    
    const minWait = roundTo5(Math.floor(totalWait * 0.9));
    const maxWait = roundTo5(Math.ceil(totalWait * 1.1));
    
    // 閉店時間チェック
    const endTime = currentTime + maxWait + SERVICE_TIMES.cut;
    if (endTime > closeTime) {
        const closeTimeStr = `${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`;
        serviceTimeRange.textContent = `${closeTimeStr}閉店のため受付終了`;
        if (waitTimeNote) waitTimeNote.textContent = '';
        return;
    }
    
    // 時間を計算して5分刻みに
    const startTime = new Date(now.getTime() + minWait * 60000);
    const endTimeDate = new Date(now.getTime() + maxWait * 60000);
    
    // 5分刻みに丸める
    startTime.setMinutes(roundTo5(startTime.getMinutes()));
    endTimeDate.setMinutes(roundTo5(endTimeDate.getMinutes()));
    
    const formatTime = (d) => {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    
    if (minWait === maxWait || minWait === 0) {
        serviceTimeRange.textContent = `${formatTime(endTimeDate)}頃`;
    } else {
        serviceTimeRange.textContent = `${formatTime(startTime)} ～ ${formatTime(endTimeDate)}頃`;
    }
    
    // 補足情報
    if (waitTimeNote) {
        if (earliest && earliest.remaining > 0) {
            waitTimeNote.textContent = `（次の席が空くまで約${earliest.remaining}分）`;
        } else {
            waitTimeNote.textContent = '';
        }
    }
}

function checkReceptionEnded() {
    const serviceTimeRange = document.getElementById('serviceTimeRange');
    return serviceTimeRange && serviceTimeRange.textContent.includes('受付終了');
}

function updateRecommendation(waitTime, isOpen, isReceptionEnded) {
    const recommendation = document.getElementById('recommendation');
    const recIcon = document.getElementById('recIcon');
    const recText = document.getElementById('recommendationText');
    
    if (!recommendation || !recIcon || !recText) return;
    
    recommendation.classList.remove('available', 'busy', 'full', 'closed');
    
    if (!isOpen || isReceptionEnded) {
        recommendation.classList.add('closed');
        recIcon.textContent = '⏰';
        recText.textContent = isReceptionEnded ? '受付終了' : '営業時間外です';
        return;
    }
    
    if (waitTime === 0) {
        recommendation.classList.add('available');
        recIcon.textContent = '✅';
        recText.textContent = '今すぐご来店いただけます';
    } else if (waitTime <= 60) {
        recommendation.classList.add('available');
        recIcon.textContent = 'ℹ️';
        recText.textContent = 'ご来店いただけます（少しお待ちいただく場合があります）';
    } else if (waitTime <= 120) {
        recommendation.classList.add('busy');
        recIcon.textContent = '⚠️';
        recText.textContent = '混雑中です。時間をずらしていただくことをおすすめします';
    } else {
        recommendation.classList.add('full');
        recIcon.textContent = '🚫';
        recText.textContent = '大変混雑しています。別の時間帯をおすすめします';
    }
}

function updateNextOpeningTime() {
    const nextOpeningTime = document.getElementById('nextOpeningTime');
    if (!nextOpeningTime) return;
    
    const now = new Date();
    let checkDate = new Date(now);
    
    // 今日の残り時間チェック
    const todayHours = getBusinessHoursForDate(now);
    if (todayHours && !todayHours.closed && !state.temporaryClosedToday) {
        const [openH, openM] = todayHours.open.split(':').map(Number);
        const openTime = openH * 60 + openM;
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        if (currentTime < openTime) {
            nextOpeningTime.textContent = `本日 ${todayHours.open}～`;
            return;
        }
    }
    
    // 翌日以降をチェック
    for (let i = 1; i <= 14; i++) {
        checkDate.setDate(checkDate.getDate() + 1);
        const hours = getBusinessHoursForDate(checkDate);
        
        if (hours && !hours.closed) {
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const month = checkDate.getMonth() + 1;
            const date = checkDate.getDate();
            const dayName = dayNames[checkDate.getDay()];
            
            nextOpeningTime.textContent = `${month}/${date}(${dayName}) ${hours.open}～`;
            return;
        }
    }
    
    nextOpeningTime.textContent = '未定';
}

function updateUpcomingSpecialDates() {
    const container = document.getElementById('specialDatesCustomer');
    const list = document.getElementById('specialDatesList');
    
    if (!container || !list || !state.specialDates) {
        if (container) container.style.display = 'none';
        return;
    }
    
    const now = new Date();
    const upcoming = [];
    
    Object.entries(state.specialDates).forEach(([dateStr, hours]) => {
        const date = new Date(dateStr);
        if (date >= now) {
            upcoming.push({ dateStr, ...hours });
        }
    });
    
    if (upcoming.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    list.innerHTML = upcoming.map(item => {
        const date = new Date(item.dateStr);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const formatted = `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
        
        if (item.closed) {
            return `<div class="special-date-item">🚫 ${formatted}：休業${item.note ? ' - ' + item.note : ''}</div>`;
        } else {
            return `<div class="special-date-item">📅 ${formatted}：${item.open}～${item.close}${item.note ? ' - ' + item.note : ''}</div>`;
        }
    }).join('');
}

function updateLastUpdateTime() {
    const lastUpdateTime = document.getElementById('lastUpdateTime');
    if (!lastUpdateTime) return;
    
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    lastUpdateTime.textContent = `${h}:${m}`;
}

// =============================================
// 管理者画面の更新
// =============================================
function updateAdminView() {
    // サマリー更新
    const adminStatus = document.getElementById('adminStatus');
    const adminWaitCount = document.getElementById('adminWaitCount');
    const adminCountDisplay = document.getElementById('adminCountDisplay');
    
    if (adminStatus) {
        adminStatus.textContent = isCurrentlyOpen() ? '営業中' : '営業時間外';
    }
    if (adminWaitCount) {
        adminWaitCount.textContent = state.waitingCount + '人';
    }
    if (adminCountDisplay) {
        adminCountDisplay.textContent = state.waitingCount;
    }
    
    // 臨時休業チェック
    const temporaryClosureCheckbox = document.getElementById('temporaryClosureCheckbox');
    if (temporaryClosureCheckbox) {
        temporaryClosureCheckbox.checked = state.temporaryClosedToday;
    }
    
    // 席の状態更新
    updateSeatCards();
    
    // 特別営業日リスト更新
    updateAdminSpecialDates();
}

function updateSeatCards() {
    const SERVICE_TIMES = getServiceTimes();
    const serviceNames = getServiceNames();
    const seatCount = shopSettings.waiting?.seatCount || 2;
    const typeIcons = { cut: '✂️', special1: '⭐', special2: '💫' };
    
    for (let index = 0; index < seatCount; index++) {
        const card = document.getElementById(`seat${index + 1}Card`);
        const status = document.getElementById(`seat${index + 1}Status`);
        const controls = document.getElementById(`seat${index + 1}Controls`);
        const active = document.getElementById(`seat${index + 1}Active`);
        const type = document.getElementById(`seat${index + 1}Type`);
        const time = document.getElementById(`seat${index + 1}Time`);
        
        if (!card) continue;
        
        const service = state.activeServices[index];
        
        if (service) {
            card.classList.add('active');
            if (status) status.textContent = '使用中';
            if (controls) controls.style.display = 'none';
            if (active) active.style.display = 'flex';
            
            const elapsed = Math.floor((Date.now() - service.startTime) / 60000);
            const duration = SERVICE_TIMES[service.type] || 60;
            const remaining = Math.max(0, duration - elapsed);
            
            const icon = typeIcons[service.type] || '';
            const name = serviceNames[service.type] || service.type;
            if (type) type.textContent = `${icon} ${name}`;
            if (time) time.textContent = `残り ${remaining}分`;
        } else {
            card.classList.remove('active');
            if (status) status.textContent = '空き';
            if (controls) controls.style.display = 'grid';
            if (active) active.style.display = 'none';
        }
    }
}

function updateAdminSpecialDates() {
    const container = document.getElementById('registeredSpecialDates');
    const list = document.getElementById('specialDatesListAdmin');
    
    if (!container || !list || !state.specialDates) {
        if (container) container.style.display = 'none';
        return;
    }
    
    const entries = Object.entries(state.specialDates);
    
    if (entries.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    list.innerHTML = entries.map(([dateStr, hours]) => {
        const date = new Date(dateStr);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const formatted = `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
        
        let text;
        if (hours.closed) {
            text = `🚫 ${formatted}：休業`;
        } else {
            text = `📅 ${formatted}：${hours.open}～${hours.close}`;
        }
        if (hours.note) text += ` (${hours.note})`;
        
        return `
            <div class="special-date-item" style="display: flex; justify-content: space-between; align-items: center;">
                <span>${text}</span>
                <button class="delete-special-btn" data-date="${dateStr}" style="background: #CC0000; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">削除</button>
            </div>
        `;
    }).join('');
    
    // 削除ボタンのイベント
    list.querySelectorAll('.delete-special-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const dateStr = btn.dataset.date;
            if (confirm(`${dateStr} の設定を削除しますか？`)) {
                delete state.specialDates[dateStr];
                await saveState();
                updateAdminSpecialDates();
                updateCustomerView();
                showToast('削除しました');
            }
        });
    });
}

// =============================================
// イベントリスナー
// =============================================
function attachEventListeners() {
    // 管理者画面への切り替え
    const adminLinkBtn = document.getElementById('adminLinkBtn');
    if (adminLinkBtn) {
        adminLinkBtn.addEventListener('click', showPasswordModal);
    }
    
    // 更新ボタン
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadState();
            updateCustomerView();
            showToast('更新しました');
        });
    }
    
    // 戻るボタン
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => switchView('customer'));
    }
    
    // 臨時休業
    const temporaryClosureCheckbox = document.getElementById('temporaryClosureCheckbox');
    if (temporaryClosureCheckbox) {
        temporaryClosureCheckbox.addEventListener('change', async () => {
            state.temporaryClosedToday = temporaryClosureCheckbox.checked;
            await saveState();
            updateAdminView();
            updateCustomerView();
            showToast(state.temporaryClosedToday ? '臨時休業に設定しました' : '臨時休業を解除しました');
        });
    }
    
    // 待ち人数コントロール
    const decreaseBtn = document.getElementById('decreaseCount');
    const increaseBtn = document.getElementById('increaseCount');
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            if (state.waitingCount > 0) {
                state.waitingCount--;
                updateAdminView();
            }
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            const maxCount = shopSettings.waiting?.maxCount || 3;
            if (state.waitingCount < maxCount) {
                state.waitingCount++;
                updateAdminView();
            } else {
                showToast(`待合は${maxCount}人までです`);
            }
        });
    }
    
    // 特別営業日の追加
    const addSpecialBtn = document.getElementById('addSpecialBtn');
    const isClosedCheckbox = document.getElementById('isClosedCheckbox');
    const timeInputs = document.getElementById('timeInputs');
    
    if (isClosedCheckbox) {
        isClosedCheckbox.addEventListener('change', () => {
            if (timeInputs) {
                timeInputs.style.display = isClosedCheckbox.checked ? 'none' : 'grid';
            }
        });
    }
    
    if (addSpecialBtn) {
        addSpecialBtn.addEventListener('click', async () => {
            const dateInput = document.getElementById('specialDate');
            const openInput = document.getElementById('specialOpen');
            const closeInput = document.getElementById('specialClose');
            const noteInput = document.getElementById('specialNote');
            
            if (!dateInput?.value) {
                showToast('日付を選択してください');
                return;
            }
            
            const entry = {
                closed: isClosedCheckbox?.checked || false
            };
            
            if (!entry.closed) {
                entry.open = openInput?.value || '09:30';
                entry.close = closeInput?.value || '19:00';
            }
            
            if (noteInput?.value) {
                entry.note = noteInput.value;
            }
            
            if (!state.specialDates) state.specialDates = {};
            state.specialDates[dateInput.value] = entry;
            
            await saveState();
            updateAdminSpecialDates();
            updateCustomerView();
            
            // フォームリセット
            dateInput.value = '';
            if (isClosedCheckbox) isClosedCheckbox.checked = false;
            if (timeInputs) timeInputs.style.display = 'grid';
            if (noteInput) noteInput.value = '';
            
            showToast('特別営業日を追加しました');
        });
    }
    
    // パスワード変更
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            const current = document.getElementById('currentPassword');
            const newPass = document.getElementById('newPassword');
            const confirm = document.getElementById('confirmPassword');
            
            if (!current?.value || !newPass?.value || !confirm?.value) {
                showToast('すべての項目を入力してください');
                return;
            }
            
            if (!verifyPassword(current.value)) {
                showToast('現在のパスワードが正しくありません');
                return;
            }
            
            if (newPass.value !== confirm.value) {
                showToast('新しいパスワードが一致しません');
                return;
            }
            
            if (newPass.value.length !== 4 || !/^\d+$/.test(newPass.value)) {
                showToast('パスワードは4桁の数字で入力してください');
                return;
            }
            
            setAdminPassword(newPass.value);
            current.value = '';
            newPass.value = '';
            confirm.value = '';
            
            showToast('パスワードを変更しました');
        });
    }
    
    // 保存ボタン
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveState();
            updateCustomerView();
            switchView('customer');
            showToast('保存しました');
        });
    }
    
    // パスワードモーダル
    setupPasswordModal();
}

// =============================================
// パスワードモーダル
// =============================================
function setupPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const pins = [
        document.getElementById('pin1'),
        document.getElementById('pin2'),
        document.getElementById('pin3'),
        document.getElementById('pin4')
    ];
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const confirmBtn = document.getElementById('confirmPasswordBtn');
    
    // 認証処理
    function tryAuthenticate() {
        const password = pins.map(p => p?.value || '').join('');
        
        if (password.length !== 4) return;
        
        if (verifyPassword(password)) {
            hidePasswordModal();
            switchView('admin');
        } else {
            pins.forEach(p => {
                if (p) {
                    p.classList.add('error');
                    setTimeout(() => p.classList.remove('error'), 300);
                }
            });
            // 入力をクリアして最初に戻る
            setTimeout(() => {
                pins.forEach(p => { if (p) p.value = ''; });
                pins[0]?.focus();
            }, 300);
            showToast('パスワードが正しくありません');
        }
    }
    
    // PIN入力の自動フォーカス移動
    pins.forEach((pin, index) => {
        if (!pin) return;
        
        pin.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // 数字以外を除去
            e.target.value = value.replace(/[^0-9]/g, '');
            
            if (e.target.value) {
                if (index < 3) {
                    // 次のフィールドへ
                    pins[index + 1]?.focus();
                } else {
                    // 4桁目入力完了 → 即認証
                    tryAuthenticate();
                }
            }
        });
        
        pin.addEventListener('keydown', (e) => {
            // バックスペースで前のフィールドへ
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pins[index - 1]?.focus();
            }
        });
    });
    
    // キャンセル
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hidePasswordModal);
    }
    
    // 確認ボタン（念のため残す）
    if (confirmBtn) {
        confirmBtn.addEventListener('click', tryAuthenticate);
    }
}

function showPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const pin1 = document.getElementById('pin1');
    
    // PIN入力をクリア
    [1, 2, 3, 4].forEach(i => {
        const pin = document.getElementById(`pin${i}`);
        if (pin) pin.value = '';
    });
    
    if (modal) {
        modal.classList.add('active');
        setTimeout(() => pin1?.focus(), 100);
    }
}

function hidePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// =============================================
// ビュー切り替え
// =============================================
function switchView(view) {
    const customerView = document.getElementById('customerView');
    const adminView = document.getElementById('adminView');
    
    if (view === 'admin') {
        customerView?.classList.remove('active');
        adminView?.classList.add('active');
        updateAdminView();
    } else {
        adminView?.classList.remove('active');
        customerView?.classList.add('active');
        loadState();
        updateCustomerView();
    }
}

// =============================================
// トースト通知
// =============================================
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// =============================================
// 自動更新（残り時間の表示更新用）
// =============================================
setInterval(() => {
    // 日付変更と閉店リセットをチェック
    checkDateChange();
    
    // 残り時間の表示を更新（リアルタイム購読とは別に必要）
    const customerView = document.getElementById('customerView');
    if (customerView?.classList.contains('active')) {
        updateServiceDisplay();
        updateServiceTimeRange();
    }
    
    const adminView = document.getElementById('adminView');
    if (adminView?.classList.contains('active')) {
        updateSeatCards();
    }
}, 30000);

// =============================================
// 起動
// =============================================
window.addEventListener('DOMContentLoaded', init);
