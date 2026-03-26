const { google } = require('googleapis');

function getClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return google.webmasters({ version: 'v3', auth });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  const { siteUrl, startDate, endDate } = req.query;
  if (!siteUrl) {
    return res.status(400).json({ error: 'siteUrlが必要です' });
  }

  try {
    const sc = getClient();
    const end = endDate || (() => {
      const d = new Date(); d.setDate(d.getDate() - 3);
      return d.toISOString().split('T')[0];
    })();
    const start = startDate || (() => {
      const d = new Date(); d.setDate(d.getDate() - 33);
      return d.toISOString().split('T')[0];
    })();

    const [kwRes, pageRes] = await Promise.all([
      sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: start, endDate: end,
          dimensions: ['query'],
          rowLimit: 50,
          orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }],
        },
      }),
      sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: start, endDate: end,
          dimensions: ['page'],
          rowLimit: 30,
          orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }],
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      siteUrl,
      fetchedAt: new Date().toISOString(),
      data: {
        keywords: (kwRes.data.rows || []).map(row => ({
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: (row.ctr * 100).toFixed(1),
          position: row.position.toFixed(1),
        })),
        pages: (pageRes.data.rows || []).map(row => ({
          page: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: (row.ctr * 100).toFixed(1),
          position: row.position.toFixed(1),
        })),
      },
    });
  } catch (error) {
    console.error('GSC Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'サービスアカウントをSearch Consoleに追加しましたか？',
    });
  }
};
