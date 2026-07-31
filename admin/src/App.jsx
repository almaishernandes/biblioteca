import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

function slugify(str) {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const emptyForm = {
  titulo: '',
  subtitulo: '',
  autor: '',
  categoria: '',
  capa: '',
  descricaoCurta: '',
  dataPublicacao: new Date().toISOString().slice(0, 10),
};

function toDateInput(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

export default function App() {
  const [livros, setLivros] = useState([]);
  const [slugAtual, setSlugAtual] = useState(null);
  const [novoSlug, setNovoSlug] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '',
  });

  const carregarLista = useCallback(() => {
    fetch('/api/livros')
      .then((r) => r.json())
      .then((data) => data.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '')))
      .then(setLivros);
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  function abrirLivro(slug) {
    fetch(`/api/livros/${slug}`)
      .then((r) => r.json())
      .then(({ data, content }) => {
        setSlugAtual(slug);
        setNovoSlug(slug);
        setIsNew(false);
        setForm({
          titulo: data.titulo || '',
          subtitulo: data.subtitulo || '',
          autor: data.autor || '',
          categoria: data.categoria || '',
          capa: data.capa || '',
          descricaoCurta: data.descricaoCurta || '',
          dataPublicacao: toDateInput(data.dataPublicacao),
        });
        editor?.commands.setContent(content || '');
        setStatus('');
      });
  }

  function novoLivro() {
    setSlugAtual(null);
    setNovoSlug('');
    setIsNew(true);
    setForm(emptyForm);
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
        res = await fetch('/api/livros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, ...payload }),
        });
      } else {
        res = await fetch(`/api/livros/${slugAtual}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ novoSlug: slug, ...payload }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'erro ao salvar');
      setStatus('Salvo! Agora rode git add / commit / push para publicar.');
      setSlugAtual(json.slug);
      setIsNew(false);
      carregarLista();
    } catch (e) {
      setStatus('Erro: ' + e.message);
    }
  }

  async function excluir() {
    if (!slugAtual) return;
    if (!confirm(`Excluir "${form.titulo}"? Isso apaga o arquivo .md.`)) return;
    await fetch(`/api/livros/${slugAtual}`, { method: 'DELETE' });
    novoLivro();
    carregarLista();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="btn-new" onClick={novoLivro}>+ Novo livro</button>
        <ul>
          {livros.map((l) => (
            <li key={l.slug} className={l.slug === slugAtual ? 'active' : ''} onClick={() => abrirLivro(l.slug)}>
              <strong>{l.titulo || l.slug}</strong>
              <span>{l.autor}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="editor-pane">
        <button className="toggle-detalhes" onClick={() => setMostrarDetalhes((v) => !v)}>
          {mostrarDetalhes ? '▾ Ocultar detalhes do livro' : '▸ Mostrar detalhes do livro'}
        </button>
        <div className="fields" style={{ display: mostrarDetalhes ? 'grid' : 'none' }}>
          <label>Slug (URL)
            <input value={novoSlug} onChange={(e) => setNovoSlug(slugify(e.target.value))} placeholder="meu-livro" />
          </label>
          <label>Título
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label>Subtítulo
            <input value={form.subtitulo} onChange={(e) => setForm({ ...form, subtitulo: e.target.value })} />
          </label>
          <label>Autor
            <input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
          </label>
          <label>Categoria
            <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </label>
          <label>Capa (caminho)
            <input value={form.capa} onChange={(e) => setForm({ ...form, capa: e.target.value })} placeholder="/capas/meu-livro.jpg" />
          </label>
          <label>Data de publicação
            <input type="date" value={form.dataPublicacao} onChange={(e) => setForm({ ...form, dataPublicacao: e.target.value })} />
          </label>
          <label className="full">Descrição curta
            <textarea rows={2} value={form.descricaoCurta} onChange={(e) => setForm({ ...form, descricaoCurta: e.target.value })} />
          </label>
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
