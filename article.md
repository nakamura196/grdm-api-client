---
title: "GakuNin RDM APIをNode.jsで操作する — プロジェクト作成からGitHub+Vercel自動デプロイまで"
emoji: "📦"
type: "tech"
topics: ["GakuNinRDM", "nodejs", "api", "vercel", "github"]
published: false
---

## はじめに

[GakuNin RDM](https://rdm.nii.ac.jp/)は、国立情報学研究所（NII）が提供する研究データ管理プラットフォームです。Open Science Framework（OSF）をベースに構築されており、APIを通じてプロジェクトの操作を自動化できます。

本記事では、Node.jsからGakuNin RDM APIを使って以下の操作を行う方法を紹介します。

- プロジェクトの作成・設定
- Wikiの作成・更新
- メンバーの追加
- GitHub連携 + Vercelによる自動デプロイ

## 事前準備

### パーソナルアクセストークンの取得

1. [GakuNin RDM](https://rdm.nii.ac.jp/)にログイン
2. [設定 > パーソナルアクセストークン](https://rdm.nii.ac.jp/settings/tokens/)に移動
3. 新しいトークンを作成（スコープ：`osf.full_read`、`osf.full_write`）

### プロジェクトの初期化

```bash
mkdir rdm && cd rdm
npm init -y
npm install dotenv
```

`.env`ファイルにトークンを保存します。

```
GRDM_TOKEN=your_personal_access_token_here
```

`.gitignore`も作成しておきます。

```
.env
node_modules/
```

## APIクライアントの作成

GakuNin RDMのAPIは[JSON:API](https://jsonapi.org/)形式を採用しています。まず汎用的なクライアントを`lib/client.js`として作成します。

```js:lib/client.js
require("dotenv").config();

const BASE_URL = "https://api.rdm.nii.ac.jp/v2";
const TOKEN = process.env.GRDM_TOKEN;

if (!TOKEN) {
  throw new Error("GRDM_TOKEN is not set in .env");
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/vnd.api+json",
};

async function request(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

module.exports = { request, headers, BASE_URL };
```

ポイント：
- **認証**: `Authorization: Bearer {token}` ヘッダーで認証
- **Content-Type**: `application/vnd.api+json`（JSON:API仕様）
- Node.js 18以降の組み込み`fetch`を使用（追加パッケージ不要）

## プロジェクトの作成

```js
const { request } = require("./lib/client");

// プロジェクト作成
const data = await request("POST", "/nodes/", {
  data: {
    type: "nodes",
    attributes: {
      title: "My Research Project",
      category: "project",
    },
  },
});

const nodeId = data.data.id;
console.log("Project ID:", nodeId);
console.log("URL:", data.data.links.html);
// => Project ID: abc12
// => URL: https://rdm.nii.ac.jp/abc12/
```

### プロジェクト情報の更新（説明・ライセンス）

作成直後のプロジェクトには説明やライセンスが設定されていません。`PATCH`で更新します。

```js
await request("PATCH", `/nodes/${nodeId}/`, {
  data: {
    type: "nodes",
    id: nodeId,
    attributes: {
      description: "プロジェクトの説明文をここに記載します。",
      node_license: {
        copyright_holders: ["Your Organization"],
        year: "2026",
      },
    },
    relationships: {
      license: {
        data: { type: "licenses", id: "5f8935e4b8b8270007b1efaa" },
      },
    },
  },
});
```

利用可能なライセンス一覧は`GET /v2/licenses/`で取得できます。主なIDは以下の通りです。

| ライセンス | ID |
|---|---|
| CC-By Attribution 4.0 | `5f8935e4b8b8270007b1efaa` |
| CC0 1.0 Universal | `5f8935e4b8b8270007b1efac` |
| MIT License | `5f8935e5b8b8270007b1efb4` |

## Wikiの作成と更新

### Wikiページの作成

`POST /nodes/{node_id}/wikis/`でWikiページを作成します。`content`属性に初期内容をMarkdownで指定します。

```js
const wiki = await request("POST", `/nodes/${nodeId}/wikis/`, {
  data: {
    type: "wikis",
    attributes: {
      name: "home",
      content: "# My Research Project\n\nプロジェクトの概要です。",
    },
  },
});

const wikiId = wiki.data.id;
console.log("Wiki ID:", wikiId);
```

### Wikiコンテンツの更新

Wikiの内容更新は**新しいバージョンをPOSTで作成**する方式です。直接PATCHでは更新できません。

```js
await request("POST", `/wikis/${wikiId}/versions/`, {
  data: {
    type: "wiki-versions",
    attributes: {
      content: "# My Research Project\n\n更新された内容です。",
    },
  },
});
```

:::message
**注意**: homeページは削除・リネームできません。内容の変更はバージョン追加で行います。
:::

### Wikiコンテンツの取得

```js
const res = await fetch(
  `https://api.rdm.nii.ac.jp/v2/wikis/${wikiId}/content/`,
  { headers: { Authorization: `Bearer ${TOKEN}` } }
);
const content = await res.text(); // Markdownテキストが返る
```

## メンバーの追加

### ユーザーIDで追加

```js
await request("POST", `/nodes/${nodeId}/contributors/`, {
  data: {
    type: "contributors",
    attributes: {
      permission: "write",  // "read" | "write" | "admin"
      bibliographic: true,
    },
    relationships: {
      users: { data: { type: "users", id: "ユーザーID" } },
    },
  },
});
```

### メールアドレスで招待

GakuNin RDMアカウントを持っていないユーザーもメールで招待できます。

```js
await request("POST", `/nodes/${nodeId}/contributors/`, {
  data: {
    type: "contributors",
    attributes: {
      full_name: "山田太郎",
      email: "yamada@example.com",
      permission: "write",
      bibliographic: true,
    },
  },
});
```

## GitHub連携 + Vercel自動デプロイ

ここからは、GakuNin RDMのGitHub Add-onを活用して、**ファイルをRDMにアップロードするとVercelに自動デプロイされる**仕組みを構築します。

### 全体の流れ

```
GakuNin RDM (ストレージ)
    ↕ GitHub Add-on（双方向同期）
GitHub リポジトリ
    ↓ push をトリガー
Vercel（自動ビルド＆デプロイ）
    ↓
公開サイト (https://your-project.vercel.app)
```

### 1. GitHubリポジトリの作成

まず、連携用のGitHubリポジトリを作成します。

```bash
gh repo create your-org/your-repo --public --clone
```

### 2. GakuNin RDMのGitHub Add-on設定

GitHub Add-onの設定はAPI経由では行えないため、Web UIから設定します。

1. プロジェクトページ（例：`https://rdm.nii.ac.jp/{node_id}/`）を開く
2. **Settings** → **Add-ons** に移動
3. **GitHub** を有効化し、GitHubアカウントを認証
4. 連携するリポジトリとブランチを選択

:::message
Add-onの設定はOAuth認証フローが必要なため、現時点ではAPI経由での操作はできません。
:::

設定が完了すると、GakuNin RDMのファイルストレージにGitHubリポジトリの内容が表示されます。RDM上でファイルを追加・更新すると、GitHubリポジトリにも反映されます。

### 3. VercelとGitHubリポジトリの連携

[Vercel](https://vercel.com)のダッシュボードから設定します。

1. Vercelにログイン → **Add New Project**
2. 先ほどのGitHubリポジトリをインポート
3. ビルド設定を構成（フレームワークに応じて自動検出）
4. **Deploy**

これだけで、GitHubリポジトリへのpushをトリガーにVercelが自動ビルド＆デプロイを行います。

### 4. 動作確認

以下の流れで自動デプロイを確認できます。

1. GakuNin RDMのプロジェクトページでGitHubストレージにファイルをアップロード
2. GitHubリポジトリにコミットが自動作成される
3. Vercelがpushを検知し、自動的にビルド＆デプロイ
4. 数十秒〜数分後、公開サイトに反映

```
RDMでファイルアップロード
  → GitHub に自動コミット
    → Vercel が自動デプロイ
      → サイト更新完了
```

### 活用例

例えば、研究データ（XMLやJSON）とWebフロントエンドを同一リポジトリで管理するプロジェクトでは、研究者がRDM上でデータを更新するだけで、技術的な知識がなくてもWebサイトが自動的に更新される仕組みを実現できます。

## API操作のまとめ

今回作成したNode.jsクライアントで対応できる操作の一覧です。

| 操作 | メソッド | エンドポイント |
|---|---|---|
| プロジェクト作成 | `POST` | `/v2/nodes/` |
| プロジェクト更新 | `PATCH` | `/v2/nodes/{id}/` |
| プロジェクト削除 | `DELETE` | `/v2/nodes/{id}/` |
| Wiki作成 | `POST` | `/v2/nodes/{id}/wikis/` |
| Wiki更新 | `POST` | `/v2/wikis/{id}/versions/` |
| Wikiコンテンツ取得 | `GET` | `/v2/wikis/{id}/content/` |
| メンバー追加 | `POST` | `/v2/nodes/{id}/contributors/` |
| メンバー削除 | `DELETE` | `/v2/nodes/{id}/contributors/{user_id}/` |
| ライセンス一覧 | `GET` | `/v2/licenses/` |
| ファイル一覧 | `GET` | `/v2/nodes/{id}/files/{provider}/` |

:::message
**Add-on管理**（GitHub連携など）はPATでは操作できません（403）。Web UIから設定してください。
:::

## おわりに

GakuNin RDMのAPIはOSF APIv2に準拠しており、JSON:API形式でプロジェクトの作成から各種設定まで幅広く操作できます。GitHub Add-onとVercelを組み合わせることで、**研究データの管理からWebサイト公開までのパイプライン**を構築できます。

本記事のコードは以下で公開しています。

https://github.com/nakamura196/grdm-api-client

## 参考

- [GakuNin RDM](https://rdm.nii.ac.jp/)
- [GakuNin RDM サポートポータル](https://support.rdm.nii.ac.jp/)
- [OSF APIv2 Documentation](https://developer.osf.io/)
- [RCOSDP/RDM-developer-guide](https://github.com/RCOSDP/RDM-developer-guide)
- [Vercel Documentation](https://vercel.com/docs)
