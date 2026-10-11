import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const contentRoot = path.join(root, 'src/content');
const DEV_PASSWORD = process.env.ADMIN_PASSWORD || null;

const COLLECTIONS = ['livros', 'gotas'];

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function dirFor(collection) {
  return path.join(contentRoot, collection);
}

function slugFromFile(file) {
  return file.replace(/\.md$/, '');
}

function requireValidCollection(req, res, next) {
  if (!COLLECTIONS.includes(req.params.collection)) {
    return res.status(404).json({ error: 'coleção inválida' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!DEV_PASSWORD || password === DEV_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'senha incorreta' });
});

app.param('collection', requireValidCollection);

app.get('/api/:collection', (req, res) => {
  const dir = dirFor(req.params.collection);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const items = files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const { data } = matter(raw);
    return { slug: slugFromFile(file), ...data };
  });
  res.json(items);
});

app.get('/api/:collection/:slug', (req, res) => {
  const file = path.join(dirFor(req.params.collection), `${req.params.slug}.md`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  const raw = fs.readFileSync(file, 'utf-8');
  const { data, content } = matter(raw);
  res.json({ slug: req.params.slug, data, content });
});

app.post('/api/:collection/:slug', (req, res) => {
  const dir = dirFor(req.params.collection);
  const { data, content, novoSlug } = req.body;
  const currentFile = path.join(dir, `${req.params.slug}.md`);
  const targetSlug = novoSlug || req.params.slug;
  const targetFile = path.join(dir, `${targetSlug}.md`);

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

app.post('/api/:collection', (req, res) => {
  const dir = dirFor(req.params.collection);
  const { slug, data, content } = req.body;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'slug inválido (use apenas letras minúsculas, números e hífen)' });
  }
  const file = path.join(dir, `${slug}.md`);
  if (fs.existsSync(file)) {
    return res.status(409).json({ error: 'já existe um item com esse slug' });
  }
  const front = { ...data };
  if (front.dataPublicacao) front.dataPublicacao = new Date(front.dataPublicacao);
  fs.writeFileSync(file, matter.stringify(content ?? '', front), 'utf-8');
  res.json({ ok: true, slug });
});

app.delete('/api/:collection/:slug', (req, res) => {
  const file = path.join(dirFor(req.params.collection), `${req.params.slug}.md`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

const PORT = 4555;
app.listen(PORT, () => {
  console.log(`\nAdmin rodando em http://localhost:${PORT}\n`);
});
