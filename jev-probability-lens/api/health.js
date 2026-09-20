export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(200).json({
    ready: Boolean(process.env.TYPESAFE_API_KEY),
    provider: 'TypeSafe',
    model: process.env.TYPESAFE_MODEL || 'jev-latest',
    key_exposed: false,
    app: 'jev-probability-lens',
    runtime: 'vercel-node'
  });
}
