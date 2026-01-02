#!/bin/bash
# ビルドスクリプト: 環境変数をsupabase-config.jsに埋め込む

# 環境変数が設定されているか確認
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "エラー: SUPABASE_URL と SUPABASE_ANON_KEY を設定してください"
    exit 1
fi

# プレースホルダーを環境変数で置換
sed -i "s|__SUPABASE_URL__|$SUPABASE_URL|g" supabase-config.js
sed -i "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" supabase-config.js

echo "ビルド完了: Supabase設定を埋め込みました"
echo "URL: $SUPABASE_URL"
