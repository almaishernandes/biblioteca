import matter from 'gray-matter';
import { checkAuth, COLLECTIONS, listFiles, getFile, putFile } from '../_github.js';

export default async function handler(req, res) {
  const { collection } = req.query;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ error: 'coleção inválida' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'não autenticado' });

  try {
    if (req.method === 'GET') {
      const files = await listFiles(collection);
      const items = await Promise.all(
        files.map(async (f) => {
          const slug = f.name.replace(/\.md$/, '');
          const file = await getFile(collection, slug);
          const { data } = matter(file.content);
          return { slug, ...data };
        })
      );
      return res.status(200).json(items);
    }

    if (req.method === 'POST') {
      const { slug, data, content } = req.body;
      if (!/^[a-z0-9-]+$/.test(slug || '')) {
        return res.status(400).json({ error: 'slug inválido (use apenas letras minúsculas, números e hífen)' });
      }
      const existing = await getFile(collection, slug);
      if (existing) return res.status(409).json({ error: 'já existe um item com esse slug' });

      const front = { ...data };
      if (front.dataPublicacao) front.dataPublicacao = new Date(front.dataPublicacao);
      const body = matter.stringify(content ?? '', front);
      await putFile(collection, slug, body);
      return res.status(200).json({ ok: true, slug });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
