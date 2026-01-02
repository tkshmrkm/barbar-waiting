// Supabase設定
// ビルド時に __SUPABASE_URL__ と __SUPABASE_ANON_KEY__ が置換される
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// Supabaseクライアント初期化（CDN版）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// app.jsで使うためにグローバル変数を上書き
supabase = supabaseClient;

// デバッグ用
console.log('Supabase初期化完了:', SUPABASE_URL);
