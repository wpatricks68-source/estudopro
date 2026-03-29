export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(404).json({ error: 'Supabase não configurado' });
  }

  // Só expõe a anon key (nunca a service_role key)
  return res.status(200).json({ url, anonKey });
}
