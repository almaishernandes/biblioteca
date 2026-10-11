import matter from 'gray-matter';
import { checkAuth, COLLECTIONS, getFile, putFile, deleteFile } from '../_github.js';

export default async function handler(req, res) {
  const { collection, slug } = req.query;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ error: 'coleção inválida' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'não autenticado' });

  try {
    if (req.method === 'GET') {
      const file = await getFile(collection, slug);
      if (!file) return res.status(404).json({ error: 'not found' });
      const { data, content } = matter(file.content);
      return res.status(200).json({ slug, data, content });
    }

    if (req.method === 'POST') {
      const { data, content, novoSlug } = req.body;
      const targetSlug = novoSlug || slug;
      if (!/^[a-z0-9-]+$/.test(targetSlug)) {
        return res.status(400).json({ error: 'slug inválido (use apenas letras minúsculas, números e hífen)' });
      }

      const front = { ...data };
      if (front.dataPublicacao) front.dataPublicacao = new Date(front.dataPublicacao);
      const body = matter.stringify(content ?? '', front);

      const current = await getFile(collection, slug);
      if (targetSlug !== slug) {
        const existingTarget = await getFile(collection, targetSlug);
        await putFile(collection, targetSlug, body, existingTarget?.sha);
        if (current) await deleteFile(collection, slug, current.sha);
      } else {
        await putFile(collection, targetSlug, body, current?.sha);
      }

      return res.status(200).json({ ok: true, slug: targetSlug });
    }

    if (req.method === 'DELETE') {
      const current = await getFile(collection, slug);
      if (current) await deleteFile(collection, slug, current.sha);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
