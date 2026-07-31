import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const livrosDir = path.join(root, 'src/content/livros');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function slugFromFile(file) {
  return file.replace(/\.md$/, '');
}

app.get('/api/livros', (req, res) => {
  const files = fs.readdirSync(livrosDir).filter((f) => f.endsWith('.md'));
  const livros = files.map((file) => {
    const raw = fs.readFileSync(path.join(livrosDir, file), 'utf-8');
    const { data } = matter(raw);
    return { slug: slugFromFile(file), ...data };
  });
  res.json(livros);
});

app.get('/api/livros/:slug', (req, res) => {
  const file = path.join(livrosDir, `${req.params.slug}.md`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  const raw = fs.readFileSync(file, 'utf-8');
  const { data, content } = matter(raw);
  res.json({ slug: req.params.slug, data, content });
});

app.post('/api/livros/:slug', (req, res) => {
  const { data, content, novoSlug } = req.body;
  const currentFile = path.join(livrosDir, `${req.params.slug}.md`);
  const targetSlug = novoSlug || req.params.slug;
  const targetFile = path.join(livrosDir, `${targetSlug}.md`);

  if (!/^[a-z0-9-]+$/.test(targetSlug)) {
    return res.status(400).json({ error: 'slug inválido (use apenas letras minúsculas, números e hífen)' });
  }

  const front = { ...data };
  if (front.dataPublicacao) front.dataPublicacao = new Date(front.dataPublicacao);

  const fileBody = matter.stringify(content ?? '', front);
  fs.writeFileSync(targetFile, fileBody, 'utf-8');

  if (targetFile !== currentFile && fs.existsSync(currentFile)) {
    fs.unlinkSync(currentFile);
  }

  res.json({ ok: true, slug: targetSlug });
});

app.post('/api/livros', (req, res) => {
  const { slug, data, content } = req.body;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'slug inválido (use apenas letras minúsculas, números e hífen)' });
  }
  const file = path.join(livrosDir, `${slug}.md`);
  if (fs.existsSync(file)) {
    return res.status(409).json({ error: 'já existe um livro com esse slug' });
  }
  const front = { ...data };
  if (front.dataPublicacao) front.dataPublicacao = new Date(front.dataPublicacao);
  fs.writeFileSync(file, matter.stringify(content ?? '', front), 'utf-8');
  res.json({ ok: true, slug });
});

app.delete('/api/livros/:slug', (req, res) => {
  const file = path.join(livrosDir, `${req.params.slug}.md`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

const PORT = 4555;
app.listen(PORT, () => {
  console.log(`\nEditor de livros rodando em http://localhost:${PORT}\n`);
});
