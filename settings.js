// =============================================
// 店舗設定画面
// =============================================

// デフォルト設定（現在のヘアーステージK&Mの設定）
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
        // 0=日曜, 1=月曜, ... 6=土曜
        0: { closed: false, open: '08:30', close: '18:00', label: '', note: '' },
        1: { closed: true, open: '09:30', close: '19:00', label: '', note: '' },  // 月曜定休
        2: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        3: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        4: { closed: false, open: '13:00', close: '21:00', label: 'ナイター', note: '祝日除く' },  // 木曜ナイター
        5: { closed: false, open: '09:30', close: '19:00', label: '', note: '' },
        6: { closed: false, open: '09:30', close: '19:00', label: '', note: '' }
    },
    closedDays: [1],  // 毎週の定休日（月曜）
    weeklyClosed: [
        { week: 2, day: 2 },  // 第2火曜
        { week: 3, day: 2 }   // 第3火曜
    ],
    holidayHours: { open: '08:30', close: '18:00' },  // 祝日の営業時間
    holidayOverrideDays: [4]  // 祝日の場合に祝日営業時間を適用する曜日（木曜）
};

const DAY_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const DAY_NAMES_SHORT = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK_NAMES = ['第1', '第2', '第3', '第4', '第5'];

let settings = {};

// =============================================
// 初期化
// =============================================
async function init() {
    // Supabaseの準備を待つ
    if (typeof supabase === 'undefined') {
        console.error('Supabaseが読み込まれていません');
        alert('接続エラー: ページを再読み込みしてください');
        return;
    }
    
    await loadSettings();
    renderBusinessHours();
    renderWeeklyClosed();
    populateForm();
    attachEventListeners();
}

// =============================================
// 設定の読み込み・保存（Supabase版）
// =============================================
async function loadSettings() {
    try {
        const { data, error } = await supabase
            .from('shop_settings')
            .select('settings')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        
        if (data && data.settings && Object.keys(data.settings).length > 0) {
            settings = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), data.settings);
        } else {
            settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
        console.log('設定を読み込みました');
    } catch (e) {
        console.error('設定の読み込みエラー:', e);
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
}

async function saveSettings() {
    try {
        const { error } = await supabase
            .from('shop_settings')
            .upsert({
                id: 1,
                settings: settings,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        console.log('設定を保存しました');
        return true;
    } catch (e) {
        console.error('設定の保存エラー:', e);
        return false;
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

// =============================================
// フォームへの値設定
// =============================================
function populateForm() {
    // 店舗情報
    document.getElementById('shopName').value = settings.shop.name || '';
    document.getElementById('shopAddress').value = settings.shop.address || '';
    document.getElementById('shopPhone').value = settings.shop.phone || '';
    
    // 待合設定
    document.getElementById('maxWaiting').value = settings.waiting.maxCount || 3;
    document.getElementById('seatCount').value = settings.waiting.seatCount || 2;
    
    // サービス時間とメニュー名
    document.getElementById('cutName').value = settings.service.cutName || 'カット';
    document.getElementById('cutTime').value = settings.service.cutTime || 60;
    document.getElementById('special1Name').value = settings.service.special1Name || '特殊1';
    document.getElementById('special1Time').value = settings.service.special1Time || 180;
    document.getElementById('special2Name').value = settings.service.special2Name || '特殊2';
    document.getElementById('special2Time').value = settings.service.special2Time || 120;
    
    // 定休日チェックボックス
    document.querySelectorAll('input[name="closedDay"]').forEach(cb => {
        cb.checked = settings.closedDays.includes(parseInt(cb.value));
    });
    
    // 祝日営業時間
    const holidayHours = settings.holidayHours || { open: '08:30', close: '18:00' };
    document.getElementById('holidayOpen').value = holidayHours.open || '08:30';
    document.getElementById('holidayClose').value = holidayHours.close || '18:00';
    
    // 祝日オーバーライド曜日
    const holidayOverrideDays = settings.holidayOverrideDays || [];
    document.querySelectorAll('input[name="holidayOverride"]').forEach(cb => {
        cb.checked = holidayOverrideDays.includes(parseInt(cb.value));
    });
}

// =============================================
// 営業時間の表示
// =============================================
function renderBusinessHours() {
    const container = document.getElementById('businessHoursContainer');
    container.innerHTML = '';
    
    for (let day = 0; day < 7; day++) {
        const hours = settings.businessHours[day] || DEFAULT_SETTINGS.businessHours[day];
        const dayCard = createBusinessHourCard(day, hours);
        container.appendChild(dayCard);
    }
}

function createBusinessHourCard(day, hours) {
    const card = document.createElement('div');
    card.className = 'business-hour-card';
    card.dataset.day = day;
    
    const isClosed = hours.closed || settings.closedDays.includes(day);
    
    card.innerHTML = `
        <div class="bh-header">
            <span class="bh-day">${DAY_NAMES[day]}</span>
            <label class="bh-closed-toggle">
                <input type="checkbox" class="bh-closed-checkbox" data-day="${day}" ${isClosed ? 'checked' : ''}>
                <span>定休日</span>
            </label>
        </div>
        <div class="bh-content ${isClosed ? 'disabled' : ''}">
            <div class="bh-times">
                <div class="bh-time-group">
                    <label>開店</label>
                    <input type="time" class="form-input bh-open" data-day="${day}" value="${hours.open || '09:30'}" ${isClosed ? 'disabled' : ''}>
                </div>
                <span class="bh-separator">～</span>
                <div class="bh-time-group">
                    <label>閉店</label>
                    <input type="time" class="form-input bh-close" data-day="${day}" value="${hours.close || '19:00'}" ${isClosed ? 'disabled' : ''}>
                </div>
            </div>
            <div class="bh-extras">
                <div class="bh-extra-group">
                    <label>ラベル <small>（ナイター等）</small></label>
                    <input type="text" class="form-input bh-label" data-day="${day}" value="${hours.label || ''}" placeholder="例: ナイター" ${isClosed ? 'disabled' : ''}>
                </div>
                <div class="bh-extra-group">
                    <label>注釈 <small>（祝日除く等）</small></label>
                    <input type="text" class="form-input bh-note" data-day="${day}" value="${hours.note || ''}" placeholder="例: 祝日除く" ${isClosed ? 'disabled' : ''}>
                </div>
            </div>
        </div>
    `;
    
    // 定休日チェックボックスのイベント
    const closedCheckbox = card.querySelector('.bh-closed-checkbox');
    closedCheckbox.addEventListener('change', (e) => {
        const content = card.querySelector('.bh-content');
        const inputs = content.querySelectorAll('input');
        
        if (e.target.checked) {
            content.classList.add('disabled');
            inputs.forEach(input => input.disabled = true);
        } else {
            content.classList.remove('disabled');
            inputs.forEach(input => input.disabled = false);
        }
    });
    
    return card;
}

// =============================================
// 特定週の休業日
// =============================================
function renderWeeklyClosed() {
    const container = document.getElementById('weeklyClosedContainer');
    container.innerHTML = '';
    
    settings.weeklyClosed.forEach((item, index) => {
        const row = createWeeklyClosedRow(index, item);
        container.appendChild(row);
    });
}

function createWeeklyClosedRow(index, item) {
    const row = document.createElement('div');
    row.className = 'weekly-closed-row';
    row.dataset.index = index;
    
    row.innerHTML = `
        <select class="form-input wc-week" data-index="${index}">
            ${WEEK_NAMES.map((name, i) => `<option value="${i + 1}" ${item.week === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
        <select class="form-input wc-day" data-index="${index}">
            ${DAY_NAMES_SHORT.map((name, i) => `<option value="${i}" ${item.day === i ? 'selected' : ''}>${name}曜日</option>`).join('')}
        </select>
        <button type="button" class="remove-btn wc-remove" data-index="${index}">✕</button>
    `;
    
    // 削除ボタン
    row.querySelector('.wc-remove').addEventListener('click', () => {
        settings.weeklyClosed.splice(index, 1);
        renderWeeklyClosed();
    });
    
    // 変更イベント
    row.querySelector('.wc-week').addEventListener('change', (e) => {
        settings.weeklyClosed[index].week = parseInt(e.target.value);
    });
    
    row.querySelector('.wc-day').addEventListener('change', (e) => {
        settings.weeklyClosed[index].day = parseInt(e.target.value);
    });
    
    return row;
}

// =============================================
// フォームから設定を収集
// =============================================
function collectSettings() {
    // 店舗情報
    settings.shop.name = document.getElementById('shopName').value.trim();
    settings.shop.address = document.getElementById('shopAddress').value.trim();
    settings.shop.phone = document.getElementById('shopPhone').value.trim();
    
    // 待合設定
    settings.waiting.maxCount = parseInt(document.getElementById('maxWaiting').value);
    settings.waiting.seatCount = parseInt(document.getElementById('seatCount').value);
    
    // サービス時間とメニュー名
    settings.service.cutName = document.getElementById('cutName').value.trim() || 'カット';
    settings.service.cutTime = parseInt(document.getElementById('cutTime').value);
    settings.service.special1Name = document.getElementById('special1Name').value.trim() || '特殊1';
    settings.service.special1Time = parseInt(document.getElementById('special1Time').value);
    settings.service.special2Name = document.getElementById('special2Name').value.trim() || '特殊2';
    settings.service.special2Time = parseInt(document.getElementById('special2Time').value);
    
    // 営業時間
    for (let day = 0; day < 7; day++) {
        const closedCheckbox = document.querySelector(`.bh-closed-checkbox[data-day="${day}"]`);
        const openInput = document.querySelector(`.bh-open[data-day="${day}"]`);
        const closeInput = document.querySelector(`.bh-close[data-day="${day}"]`);
        const labelInput = document.querySelector(`.bh-label[data-day="${day}"]`);
        const noteInput = document.querySelector(`.bh-note[data-day="${day}"]`);
        
        settings.businessHours[day] = {
            closed: closedCheckbox?.checked || false,
            open: openInput?.value || '09:30',
            close: closeInput?.value || '19:00',
            label: labelInput?.value.trim() || '',
            note: noteInput?.value.trim() || ''
        };
    }
    
    // 定休日
    settings.closedDays = [];
    document.querySelectorAll('input[name="closedDay"]:checked').forEach(cb => {
        settings.closedDays.push(parseInt(cb.value));
    });
    
    // 祝日営業時間
    settings.holidayHours = {
        open: document.getElementById('holidayOpen').value || '08:30',
        close: document.getElementById('holidayClose').value || '18:00'
    };
    
    // 祝日オーバーライド曜日
    settings.holidayOverrideDays = [];
    document.querySelectorAll('input[name="holidayOverride"]:checked').forEach(cb => {
        settings.holidayOverrideDays.push(parseInt(cb.value));
    });
    
    // weeklyClosed は既にリアルタイムで更新されている
}

// =============================================
// イベントリスナー
// =============================================
function attachEventListeners() {
    // 特定週休業の追加
    document.getElementById('addWeeklyClosed').addEventListener('click', () => {
        settings.weeklyClosed.push({ week: 1, day: 0 });
        renderWeeklyClosed();
    });
    
    // 保存ボタン
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        collectSettings();
        
        // バリデーション
        if (!settings.shop.name) {
            showToast('店舗名を入力してください');
            return;
        }
        
        const success = await saveSettings();
        if (success) {
            showToast('設定を保存しました');
            
            // 少し待ってからメイン画面へ
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showToast('保存に失敗しました');
        }
    });
    
    // リセットボタン
    document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
        if (confirm('設定を初期状態に戻しますか？\n（現在の設定は失われます）')) {
            settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            await saveSettings();
            renderBusinessHours();
            renderWeeklyClosed();
            populateForm();
            showToast('初期設定に戻しました');
        }
    });
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
// 起動
// =============================================
window.addEventListener('DOMContentLoaded', init);
