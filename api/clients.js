module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  let clients = [];
  try {
    clients = JSON.parse(process.env.CLIENTS_JSON || '[]');
  } catch (e) {
    clients = [];
  }

  res.status(200).json({ success: true, clients });
};
