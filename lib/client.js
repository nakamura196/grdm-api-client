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

// ノード(プロジェクト)一覧取得
async function listNodes() {
  return request("GET", "/nodes/");
}

// ノード詳細取得
async function getNode(nodeId) {
  return request("GET", `/nodes/${nodeId}/`);
}

// プロジェクト作成
async function createProject(title, options = {}) {
  return request("POST", "/nodes/", {
    data: {
      type: "nodes",
      attributes: {
        title,
        category: "project",
        ...options,
      },
    },
  });
}

// ノード更新
async function updateNode(nodeId, attributes) {
  return request("PATCH", `/nodes/${nodeId}/`, {
    data: {
      type: "nodes",
      id: nodeId,
      attributes,
    },
  });
}

// ノード削除
async function deleteNode(nodeId) {
  return request("DELETE", `/nodes/${nodeId}/`);
}

// ファイル(ストレージプロバイダ)一覧取得
async function listFiles(nodeId, provider = "osfstorage") {
  return request("GET", `/nodes/${nodeId}/files/${provider}/`);
}

// Wiki一覧取得
async function listWikis(nodeId) {
  return request("GET", `/nodes/${nodeId}/wikis/`);
}

// Wikiページ作成
async function createWiki(nodeId, name, content = "") {
  return request("POST", `/nodes/${nodeId}/wikis/`, {
    data: {
      type: "wikis",
      attributes: { name, content },
    },
  });
}

// Wikiコンテンツ更新（新バージョンを作成）
async function updateWikiContent(wikiId, content) {
  return request("POST", `/wikis/${wikiId}/versions/`, {
    data: {
      type: "wiki-versions",
      attributes: { content },
    },
  });
}

// Wikiコンテンツ取得
async function getWikiContent(wikiId) {
  const url = `${BASE_URL}/wikis/${wikiId}/content/`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GET wiki content failed (${res.status})`);
  }
  return res.text();
}

// Wiki削除
async function deleteWiki(wikiId) {
  return request("DELETE", `/wikis/${wikiId}/`);
}

// コントリビューター一覧取得
async function listContributors(nodeId) {
  return request("GET", `/nodes/${nodeId}/contributors/`);
}

// コントリビューター追加（ユーザーID指定）
// permission: "read" | "write" | "admin"
async function addContributor(nodeId, userId, { permission = "write", bibliographic = true } = {}) {
  return request("POST", `/nodes/${nodeId}/contributors/`, {
    data: {
      type: "contributors",
      attributes: { permission, bibliographic },
      relationships: {
        users: { data: { type: "users", id: userId } },
      },
    },
  });
}

// コントリビューター追加（メール指定、未登録ユーザー向け）
async function addContributorByEmail(nodeId, fullName, email, { permission = "write", bibliographic = true } = {}) {
  return request("POST", `/nodes/${nodeId}/contributors/`, {
    data: {
      type: "contributors",
      attributes: { full_name: fullName, email, permission, bibliographic },
    },
  });
}

// コントリビューター削除
async function removeContributor(nodeId, userId) {
  return request("DELETE", `/nodes/${nodeId}/contributors/${userId}/`);
}

module.exports = {
  request,
  listNodes,
  getNode,
  createProject,
  updateNode,
  deleteNode,
  listFiles,
  listWikis,
  createWiki,
  updateWikiContent,
  getWikiContent,
  deleteWiki,
  listContributors,
  addContributor,
  addContributorByEmail,
  removeContributor,
};
