const API = 'https://api.github.com';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente ${name} não configurada`);
  return v;
}

export function checkAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(token) && token === env('ADMIN_PASSWORD');
}

function repoInfo() {
  const [owner, repo] = env('GITHUB_REPO').split('/');
  return { owner, repo, branch: process.env.GITHUB_BRANCH || 'main' };
}

async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  return res;
}

export const COLLECTIONS = ['livros', 'gotas'];

export function contentDir(collection) {
  return `src/content/${collection}`;
}

export async function listFiles(collection) {
  const { owner, repo, branch } = repoInfo();
  const res = await gh(`/repos/${owner}/${repo}/contents/${contentDir(collection)}?ref=${branch}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`erro ao listar (${res.status})`);
  const list = await res.json();
  return list.filter((f) => f.name.endsWith('.md'));
}

export async function getFile(collection, slug) {
  const { owner, repo, branch } = repoInfo();
  const res = await gh(`/repos/${owner}/${repo}/contents/${contentDir(collection)}/${slug}.md?ref=${branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`erro ao ler arquivo (${res.status})`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  return { sha: json.sha, content };
}

export async function putFile(collection, slug, content, sha) {
  const { owner, repo, branch } = repoInfo();
  const res = await gh(`/repos/${owner}/${repo}/contents/${contentDir(collection)}/${slug}.md`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `admin: atualiza ${collection}/${slug}.md`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `erro ao salvar (${res.status})`);
  }
  return res.json();
}

export async function deleteFile(collection, slug, sha) {
  const { owner, repo, branch } = repoInfo();
  const res = await gh(`/repos/${owner}/${repo}/contents/${contentDir(collection)}/${slug}.md`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `admin: remove ${collection}/${slug}.md`,
      sha,
      branch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `erro ao excluir (${res.status})`);
  }
}
