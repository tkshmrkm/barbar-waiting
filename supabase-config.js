// Supabase設定
const SUPABASE_URL = 'https://qtnqcupqfgmheeapbzja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnFjdXBxZmdtaGVlYXBiemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTA1NTAsImV4cCI6MjA4MjkyNjU1MH0.-7PY7aT1gKVbrLJW38YhWH9Eun8Wh7e32oIy_O2c4P4';

// Supabaseクライアント初期化（CDN版）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// app.jsで使うためにグローバル変数を上書き
supabase = supabaseClient;

// デバッグ用
console.log('Supabase初期化完了');
