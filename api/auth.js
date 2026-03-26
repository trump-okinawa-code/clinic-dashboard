module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { id, password } = req.body;
  const adminId = process.env.ADMIN_ID || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'pass123';
  const clientId = process.env.CLIENT_ID || 'user';
  const clientPass = process.env.CLIENT_PASSWORD || 'pass456';

  let role = null;
  if (id === adminId && password === adminPass) role = 'admin';
  else if (id === clientId && password === clientPass) role = 'client';

  if (!role) {
    return res.status(401).json({ success: false, error: 'IDまたはパスワードが違います' });
  }

  res.status(200).json({
    success: true,
    role,
    apiKey: process.env.DASHBOARD_API_KEY,
  });
};
