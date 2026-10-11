export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { password } = req.body || {};
  if (password && password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ ok: true });
  }
  res.status(401).json({ error: 'senha incorreta' });
}
