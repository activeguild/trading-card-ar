# Remove Background - 設計ドキュメント

## 概要

アップロードした画像を U-2-Net（人物セグメンテーションモデル）を使って人物と背景に分離するWebアプリケーション。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + Vite + TypeScript |
| バックエンド | FastAPI (Python) |
| モデル | U-2-Net (`u2net_human_seg.pth`) |
| スタイリング | CSS Modules |

## アーキテクチャ

### 全体構成

```
[ブラウザ (React)] → POST /api/segment → [FastAPI] → U-2-Net推論 → JSON (Base64画像2枚)
```

### ディレクトリ構成

```
remove-bg/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI アプリ + CORS設定
│   │   ├── model.py         # U-2-Net ロード・推論ロジック
│   │   └── routes.py        # /api/segment エンドポイント
│   ├── models/              # .pth ファイル配置 (.gitignore)
│   │   └── u2net_human_seg.pth
│   └── u2net/               # U-2-Netモデル定義
│       └── u2net.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.module.css
│   │   ├── components/
│   │   │   ├── Upload.tsx       # アップロードエリア
│   │   │   ├── ResultView.tsx   # 結果表示（人物・背景）
│   │   │   └── Loading.tsx      # スピナー
│   │   └── main.tsx
│   ├── vite.config.ts       # proxy設定
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

## バックエンド設計

### API エンドポイント

#### `POST /api/segment`

- **入力**: マルチパートフォームで画像ファイル（JPEG/PNG）
- **出力**: JSON

```json
{
  "person": "data:image/png;base64,...",
  "background": "data:image/png;base64,..."
}
```

- **エラー**: 画像でないファイルの場合は 400 を返す

### 画像処理フロー

1. アップロード画像を受け取り、PIL で開く
2. 元のサイズを保存
3. 320x320 にリサイズして正規化し、テンソルに変換
4. U-2-Net で推論してマスク画像を生成
5. マスクを元のサイズにリサイズ
6. マスクを使って人物部分を切り抜き（背景を透明にしたPNG）
7. マスクを反転して背景部分を切り抜き（人物部分を透明にしたPNG）
8. 両方を Base64 エンコードして返す

### モデル管理

- アプリ起動時（lifespan）にモデルをメモリにロード
- リクエストごとにロードしない（パフォーマンス）
- CPU推論をデフォルト、CUDAがあれば自動利用

### U-2-Net モデル定義

- U-2-Net リポジトリの `model/u2net.py` を `backend/u2net/u2net.py` にコピーして使用
- `U2NET` クラスを使用（`u2net_human_seg.pth` に対応）

## フロントエンド設計

### 画面構成（1画面）

```
┌─────────────────────────────────────┐
│         Remove Background           │
├─────────────────────────────────────┤
│                                     │
│   ┌───────────────────────────┐     │
│   │  ドラッグ&ドロップ         │     │
│   │  または クリックして選択   │     │
│   └───────────────────────────┘     │
│                                     │
│   ── 処理後 ──────────────────────   │
│                                     │
│   ┌──────────┐  ┌──────────┐       │
│   │  人物    │  │  背景    │       │
│   │          │  │          │       │
│   └──────────┘  └──────────┘       │
│   [ダウンロード]  [ダウンロード]     │
│                                     │
└─────────────────────────────────────┘
```

### コンポーネント

| コンポーネント | 責務 |
|--------------|------|
| `App.tsx` | 状態管理、API呼び出し |
| `Upload.tsx` | ドラッグ&ドロップ + クリック選択、プレビュー表示 |
| `ResultView.tsx` | 人物・背景画像の表示 + ダウンロードボタン |
| `Loading.tsx` | 処理中スピナー |

### 状態フロー

1. **初期状態**: アップロードエリアのみ表示
2. **画像選択後**: アップロードエリアにプレビュー表示 + API呼び出し開始
3. **処理中**: スピナー表示
4. **処理完了**: 人物画像・背景画像を横並びで表示、各ダウンロードボタン
5. **再アップロード**: 新しい画像を選択すると結果をリセットして再処理

### 開発時のProxy設定

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

## 依存関係

### バックエンド (`requirements.txt`)

- `torch`
- `torchvision`
- `fastapi`
- `uvicorn[standard]`
- `python-multipart`
- `pillow`
- `numpy`

### フロントエンド (`package.json`)

- `react`
- `react-dom`
- `typescript`
- `vite`
- `@vitejs/plugin-react`

## 起動方法

```bash
# バックエンド
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# フロントエンド
cd frontend
npm install
npm run dev
# → localhost:5173 (proxy → localhost:8000)
```

## .gitignore

```
# Models
backend/models/*.pth

# Python
__pycache__/
*.pyc
.venv/

# Node
node_modules/
frontend/dist/
```
