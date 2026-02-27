# grdm-api-client

Node.js client for [GakuNin RDM](https://rdm.nii.ac.jp/) API.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your personal access token
```

`.env`:
```
GRDM_TOKEN=your_personal_access_token_here
```

トークンは [設定 > パーソナルアクセストークン](https://rdm.nii.ac.jp/settings/tokens/) から作成できます（スコープ: `osf.full_read`, `osf.full_write`）。

## Usage

```js
const {
  createProject,
  updateNode,
  createWiki,
  updateWikiContent,
  addContributor,
} = require("./lib/client");

// プロジェクト作成
const data = await createProject("My Research Project");
const nodeId = data.data.id;

// 説明・ライセンス更新
await updateNode(nodeId, {
  description: "プロジェクトの説明",
});

// Wiki作成
const wiki = await createWiki(nodeId, "home", "# Home\nWikiの内容");

// Wiki更新（新バージョン作成）
await updateWikiContent(wiki.data.id, "# Home\n更新された内容");

// メンバー追加
await addContributor(nodeId, "user_id", { permission: "write" });
```

## API Functions

| Function | Description |
|---|---|
| `listNodes()` | ノード一覧取得 |
| `getNode(id)` | ノード詳細取得 |
| `createProject(title, opts)` | プロジェクト作成 |
| `updateNode(id, attrs)` | ノード更新 |
| `deleteNode(id)` | ノード削除 |
| `listFiles(id, provider)` | ファイル一覧取得 |
| `listWikis(id)` | Wiki一覧取得 |
| `createWiki(id, name, content)` | Wikiページ作成 |
| `updateWikiContent(wikiId, content)` | Wikiコンテンツ更新 |
| `getWikiContent(wikiId)` | Wikiコンテンツ取得 |
| `deleteWiki(wikiId)` | Wiki削除 |
| `listContributors(id)` | コントリビューター一覧 |
| `addContributor(id, userId, opts)` | コントリビューター追加 |
| `addContributorByEmail(id, name, email, opts)` | メール招待 |
| `removeContributor(id, userId)` | コントリビューター削除 |
| `request(method, path, body)` | 汎用リクエスト |

## License

Apache License 2.0
