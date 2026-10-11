import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { COLLECTIONS } from './collections';

function slugify(str) {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDateInput(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Senha incorreta.');
      localStorage.setItem('adminToken', password);
      onLogin(password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form onSubmit={entrar} className="login-box">
        <h1>Admin — Instituto Hernandes</h1>
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}

export default function App() {
  // Login temporariamente desativado a pedido do usuário.
  const [token, setToken] = useState('sem-login');
  const [collectionKey, setCollectionKey] = useState('livros');
  const [items, setItems] = useState([]);
  const [slugAtual, setSlugAtual] = useState(null);
  const [novoSlug, setNovoSlug] = useState('');
  const config = COLLECTIONS[collectionKey];
  const [form, setForm] = useState(config.empty);
  const [status, setStatus] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '',
  });

  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        setToken(null);
        throw new Error('Sessão expirada, faça login novamente.');
      }
      return res;
    });
  }, [token]);

  const carregarLista = useCallback(() => {
    if (!token) return;
    authFetch(`/api/${collectionKey}`)
      .then((r) => r.json())
      .then((data) => data.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '')))
      .then(setItems)
      .catch(() => {});
  }, [authFetch, collectionKey, token]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    setForm(config.empty);
    setSlugAtual(null);
    setNovoSlug('');
    setIsNew(false);
    editor?.commands.setContent('');
    setStatus('');
  }, [collectionKey]);

  function abrirItem(slug) {
    authFetch(`/api/${collectionKey}/${slug}`)
      .then((r) => r.json())
      .then(({ data, content }) => {
        setSlugAtual(slug);
        setNovoSlug(slug);
        setIsNew(false);
        const filled = { ...config.empty };
        for (const key of Object.keys(filled)) {
          filled[key] = key === 'dataPublicacao' ? toDateInput(data[key]) : (data[key] || '');
        }
        setForm(filled);
        editor?.commands.setContent(content || '');
        setStatus('');
      })
      .catch((e) => setStatus('Erro: ' + e.message));
  }

  function novoItem() {
    setSlugAtual(null);
    setNovoSlug('');
    setIsNew(true);
    setForm(config.empty);
    editor?.commands.setContent('');
    setStatus('');
  }

  async function salvar() {
    const slug = slugify(novoSlug || form.titulo);
    if (!slug) {
      setStatus('Defina um título ou slug antes de salvar.');
      return;
    }
    setNovoSlug(slug);
    const markdown = editor?.storage.markdown.getMarkdown() ?? '';
    const payload = { data: form, content: markdown };

    setStatus('Salvando...');
    try {
      let res;
      if (isNew) {
        res = await authFetch(`/api/${collectionKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, ...payload }),
        });
      } else {
        res = await authFetch(`/api/${collectionKey}/${slugAtual}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ novoSlug: slug, ...payload }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'erro ao salvar');
      setStatus('Salvo! O deploy automático vai publicar em instantes.');
      setSlugAtual(json.slug);
      setIsNew(false);
      carregarLista();
    } catch (e) {
      setStatus('Erro: ' + e.message);
    }
  }

  async function excluir() {
    if (!slugAtual) return;
    if (!confirm(`Excluir "${form.titulo}"? Isso apaga o arquivo.`)) return;
    await authFetch(`/api/${collectionKey}/${slugAtual}`, { method: 'DELETE' });
    novoItem();
    carregarLista();
  }

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="tabs">
          {Object.entries(COLLECTIONS).map(([key, c]) => (
            <button
              key={key}
              className={key === collectionKey ? 'tab active' : 'tab'}
              onClick={() => setCollectionKey(key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button className="btn-new" onClick={novoItem}>{config.newLabel}</button>
        <ul>
          {items.map((item) => (
            <li key={item.slug} className={item.slug === slugAtual ? 'active' : ''} onClick={() => abrirItem(item.slug)}>
              <strong>{config.listTitle(item) || item.slug}</strong>
              <span>{config.listSubtitle(item)}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="editor-pane">
        <button className="toggle-detalhes" onClick={() => setMostrarDetalhes((v) => !v)}>
          {mostrarDetalhes ? '▾ Ocultar detalhes' : '▸ Mostrar detalhes'}
        </button>
        <div className="fields" style={{ display: mostrarDetalhes ? 'grid' : 'none' }}>
          <label>Slug (URL)
            <input value={novoSlug} onChange={(e) => setNovoSlug(slugify(e.target.value))} placeholder="meu-item" />
          </label>
          {config.fields.map((f) => (
            <label key={f.key} className={f.full ? 'full' : ''}>
              {f.label}
              {f.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>

        <div className="editor-body">
          <div className="toolbar">
            <button onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button>
            <button onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
            <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button onClick={() => editor?.chain().focus().toggleBulletList().run()}>Lista</button>
            <button onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Citação</button>
          </div>
          <EditorContent editor={editor} className="tiptap" />
        </div>

        <div className="actions">
          <button className="btn-save" onClick={salvar}>Salvar</button>
          {!isNew && <button className="btn-delete" onClick={excluir}>Excluir</button>}
        </div>
        <div className="actions">
          <span className="status">{status}</span>
        </div>
      </main>
    </div>
  );
}
