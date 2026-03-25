// api/auth.js
// 認証エンドポイント（ログイン）
// POST /api/auth { id, password }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, password } = req.body;

  // 環境変数からユーザー情報を取得
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

  // 簡易トークン生成（本番ではJWT推奨）
  const token = Buffer.from(`${id}:${role}:${Date.now()}:${process.env.DASHBOARD_API_KEY}`).toString('base64');

  res.status(200).json({
    success: true,
    role,
    token,
    apiKey: process.env.DASHBOARD_API_KEY, // フロントに渡してAPI呼び出しに使用
    message: 'ログイン成功',
  });
};
