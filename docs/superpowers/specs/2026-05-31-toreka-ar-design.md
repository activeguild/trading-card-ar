# トレカAR — 設計ドキュメント

## 概要

トレーディングカードを撮影・登録し、ホログラムエフェクトを付与してARで体験できるスマホ向けWebアプリケーション。既存のremove-bg（背景除去+透視補正）プロジェクトをベースに拡張する。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + Vite + TypeScript + react-router |
| バックエンド | FastAPI (Python) |
| DB | SQLite + SQLAlchemy |
| 画像処理 | rembg, OpenCV, Pillow |
| OCR | Tesseract (pytesseract) |
| 動画生成 | ffmpeg (Python subprocess) |
| AR | @j1ngzoue/8thwall-react-three-fiber |
| 認証 | JWT (bcrypt) |
| QRコード | qrcode.react |
| ファイル保存 | ローカルファイルシステム（将来的にR2等へ移行可能） |

## アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React SPA)           │
│                                                  │
│  /login, /register     → 認証画面                │
│  /collections          → コレクション一覧         │
│  /collections/:id      → コレクション詳細+カード  │
│  /cards/:id/effect     → エフェクト選択・生成     │
│  /decks                → デッキ一覧              │
│  /decks/:id            → デッキ詳細              │
│  /ar/:type/:id         → ARビューア（単体/デッキ）│
├─────────────────────────────────────────────────┤
│                   Backend (FastAPI)              │
│                                                  │
│  POST /api/auth/*      → 認証                    │
│  CRUD /api/collections → コレクション管理         │
│  CRUD /api/cards       → カード管理               │
│  POST /api/cards/:id/effect → エフェクト生成      │
│  CRUD /api/decks       → デッキ管理               │
│  POST /api/segment     → 背景除去+透視補正（既存）│
│  GET  /api/files/*     → 画像・動画配信           │
├─────────────────────────────────────────────────┤
│  SQLite (DB)  │  uploads/ (画像・動画ファイル)    │
└─────────────────────────────────────────────────┘
```

### ファイル保存構成

```
uploads/
├── cards/
│   ├── {card_id}/
│   │   ├── original.png    # アップロード原画
│   │   ├── corrected.png   # 透視補正済み（ARマーカー兼用）
│   │   └── effect.mp4      # 透過動画（オリジナル+マスク縦並び）
```

## データモデル

### User

| カラム | 型 | 説明 |
|-------|-----|------|
| id | INTEGER PK | |
| email | TEXT UNIQUE | メールアドレス |
| password_hash | TEXT | bcryptハッシュ |
| created_at | DATETIME | 作成日時 |

### Collection

| カラム | 型 | 説明 |
|-------|-----|------|
| id | INTEGER PK | |
| user_id | INTEGER FK → User | 所有者 |
| name | TEXT | コレクション名 |
| created_at | DATETIME | 作成日時 |

### Card

| カラム | 型 | 説明 |
|-------|-----|------|
| id | INTEGER PK | |
| collection_id | INTEGER FK → Collection | 所属コレクション |
| name | TEXT | カード名（OCRで自動入力、編集可能） |
| original_path | TEXT | アップロード原画のパス |
| corrected_path | TEXT | 透視補正済み画像のパス（ARマーカー兼用） |
| effect_path | TEXT NULL | 透過動画のパス（未生成時はNULL） |
| created_at | DATETIME | 作成日時 |

### Deck

| カラム | 型 | 説明 |
|-------|-----|------|
| id | INTEGER PK | |
| user_id | INTEGER FK → User | 所有者 |
| name | TEXT | デッキ名 |
| created_at | DATETIME | 作成日時 |

### DeckCard

| カラム | 型 | 説明 |
|-------|-----|------|
| deck_id | INTEGER FK → Deck | |
| card_id | INTEGER FK → Card | |
| position | INTEGER | デッキ内の順番 (1-5) |

- CardはDeckCard経由でデッキに参加（同じカードを複数デッキに入れられる）
- 1デッキ最大5枚の制約はアプリ側で制御

## 認証

### 方式

- JWT ベース認証
- アクセストークン（30分）+ リフレッシュトークン（7日）
- パスワードは bcrypt でハッシュ化
- リフレッシュトークンは httpOnly cookie、アクセストークンはメモリ保持

### API

| エンドポイント | 説明 |
|---|---|
| `POST /api/auth/register` | メール+パスワードでユーザー登録 |
| `POST /api/auth/login` | ログイン → トークン返却 |
| `POST /api/auth/refresh` | リフレッシュトークンでアクセストークン再取得 |

### ARビューアの認証

- ARビューアページ (`/ar/card/:id`, `/ar/deck/:id`) は認証不要
- QRコードで共有してそのまま体験できるようにするため

## カード登録フロー

```
[カメラ撮影 or 画像アップロード]
  → [POST /api/segment で背景除去+透視補正]
  → [補正済み画像の上部15-20%をクロップしてOCRでカード名を自動検出]
  → [プレビュー表示 + カード名（自動入力済み、編集可能）]
  → [保存]
```

### OCR

- Tesseract OCR（pytesseract）を使用
- 補正済み画像の上部15-20%をクロップしてOCR対象とする（カード名はカード上部に固定配置されているため）
- OCR結果はカード名の初期値として入力し、ユーザーが修正可能

## エフェクト生成

### フロー

1. ユーザーがカード詳細画面で「エフェクトを追加」を選択
2. プリセット一覧からエフェクトを選ぶ（初期は「ホログラム枠」のみ）
3. `POST /api/cards/:id/effect` でバックエンドにリクエスト
4. バックエンドでffmpegを使って透過動画を生成し保存

### 透過動画フォーマット

```
┌─────────────┐
│  オリジナル   │  ← カラー映像（エフェクト付き）
│  (上半分)    │
├─────────────┤
│  マスク      │  ← 白黒のアルファマスク
│  (下半分)    │
└─────────────┘
```

- 1つのmp4ファイルにオリジナルとマスクを縦に結合
- ARビューア側でこの動画を読み込み、マスクをアルファとして適用

### ホログラム枠エフェクト

- 補正済みカード画像の枠領域を検出（エッジから一定幅）
- 枠部分に虹色のグラデーションアニメーションを適用（色相が時間とともに回転）
- ffmpegでフレーム列を動画化 + マスク動画も同時生成 → 縦結合して1ファイルに
- 将来的には枠とコンテンツ（イラスト部分）に別々のエフェクトをかけられるよう拡張予定

### API

| エンドポイント | 説明 |
|---|---|
| `GET /api/effects` | 利用可能なエフェクトプリセット一覧 |
| `POST /api/cards/:id/effect` | エフェクト生成（プリセット名を指定） |
| `DELETE /api/cards/:id/effect` | エフェクト削除 |

## ARビューア

### 単体カードAR (`/ar/card/:id`)

1. QRコードからURLを開く
2. カメラ起動（8thwall）
3. `corrected.png` を画像マーカーとして登録
4. カードをカメラに映すと認識
5. カード上にエフェクト動画をオーバーレイ表示

### デッキAR (`/ar/deck/:id`)

1. QRコードからURLを開く
2. カメラ起動（8thwall）
3. デッキ内の全カード（最大5枚）の `corrected.png` をマルチマーカーとして登録
4. 複数カードを同時にカメラに映すと、それぞれのカード上にエフェクトを表示

### AR用API（認証不要）

| エンドポイント | 説明 |
|---|---|
| `GET /api/ar/card/:id` | カード情報（マーカー画像URL + エフェクト動画URL） |
| `GET /api/ar/deck/:id` | デッキ内全カード情報（マーカー画像URL + エフェクト動画URL × N） |

### QRコード

- フロントエンドで `qrcode.react` を使って生成
- カード詳細画面・デッキ詳細画面にQRコード表示ボタン
- QRのURLは `/ar/card/:id` または `/ar/deck/:id`

## 画面構成

### ルーティング

```
[ログイン/登録]
  └→ [ホーム]
      ├→ [コレクション一覧]
      │   └→ [コレクション詳細] ← カード一覧表示
      │       ├→ [カード登録] ← 撮影 or アップロード → 背景除去+補正+OCR
      │       └→ [カード詳細]
      │           ├→ [エフェクト選択・生成]
      │           └→ [QRコード表示] → ARビューア
      └→ [デッキ一覧]
          └→ [デッキ詳細] ← コレクションからカードを追加(最大5枚)
              └→ [QRコード表示] → ARビューア(マルチマーカー)

[ARビューア] ← 認証不要
  ├→ /ar/card/:id  ← 単体カードAR
  └→ /ar/deck/:id  ← デッキAR(マルチマーカー)
```

### ナビゲーション

- 下部タブバー: **コレクション** | **デッキ**
- ヘッダー: 戻るボタン + ページタイトル + ログアウト
- スマホベースUI（モバイルファースト）

## 依存関係の追加

### バックエンド（requirements.txt に追加）

- `sqlalchemy`
- `alembic`（DBマイグレーション）
- `pyjwt`
- `bcrypt`
- `pytesseract`
- `python-qrcode`（不要 — QR生成はフロントのみ）

### フロントエンド（package.json に追加）

- `react-router-dom`
- `@j1ngzoue/8thwall-react-three-fiber`
- `@react-three/fiber`
- `@react-three/drei`
- `three`
- `qrcode.react`

### システム要件

- Tesseract OCR がシステムにインストールされていること
- ffmpeg がシステムにインストールされていること

## 開発環境

- ローカル環境でWiFi経由でスマホから確認
- バックエンド: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- フロントエンド: `vite --host 0.0.0.0`（LAN内からアクセス可能に）
- AR確認時はスマホのブラウザからLANのIPアドレスでアクセス
