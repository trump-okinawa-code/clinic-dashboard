// api/clients.js
// クライアント（クリニック）一覧管理エンドポイント
// GET /api/clients → 全クライアント取得
// POST /api/clients → クライアント追加
// クライアント設定はVercel KV（またはJSON）で管理

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  // =====================================================
  // クライアント設定（本番では DBやKVストアに移行）
  // 環境変数 CLIENTS_JSON にJSONを保存しておく
  // =====================================================
  let clients;
  try {
    clients = JSON.parse(process.env.CLIENTS_JSON || '[]');
  } catch {
    clients = getDefaultClients();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, clients });
  }

  if (req.method === 'POST') {
    // 新規クライアント追加（管理者のみ）
    const newClient = req.body;
    if (!newClient.name || !newClient.ga4PropertyId) {
      return res.status(400).json({ error: 'name と ga4PropertyId は必須です' });
    }
    clients.push({
      id: Date.now().toString(),
      ...newClient,
      createdAt: new Date().toISOString(),
    });
    // 本番ではDBに保存。デモでは返すだけ
    return res.status(200).json({ success: true, message: 'クライアントを追加しました', client: clients[clients.length - 1] });
  }
};

// デフォルトクライアント設定（環境変数がない場合のフォールバック）
function getDefaultClients() {
  return [
    {
      id: '1',
      name: 'さくら歯科クリニック',
      type: '歯科',
      area: '那覇市',
      color: '#378ADD',
      ga4PropertyId: process.env.DEMO_GA4_PROPERTY_ID || '',
      gscSiteUrl: process.env.DEMO_GSC_SITE_URL || '',
      hasForm: true,
      hasLine: false,
    },
    // 本番ではDBから取得
  ];
}
