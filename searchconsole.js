// api/searchconsole.js
// Search Consoleデータ取得エンドポイント
// GET /api/searchconsole?siteUrl=https://example.com&startDate=2024-01-01&endDate=2024-01-31

const { google } = require('googleapis');

function getSearchConsoleClient() {
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
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  const { siteUrl, startDate, endDate } = req.query;

  if (!siteUrl) {
    return res.status(400).json({ error: 'siteUrlが必要です（例：https://example.com）' });
  }

  try {
    const sc = getSearchConsoleClient();
    const start = startDate || (() => {
      const d = new Date(); d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const end = endDate || (() => {
      const d = new Date(); d.setDate(d.getDate() - 3);
      return d.toISOString().split('T')[0];
    })();

    // ========== キーワード別データ（TOP50）==========
    const kwRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: ['query'],
        rowLimit: 50,
        orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }],
      },
    });

    // ========== ページ別データ（TOP30）==========
    const pageRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: ['page'],
        rowLimit: 30,
        orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }],
      },
    });

    // ========== 月次推移（過去12ヶ月）==========
    const monthlyRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: (() => {
          const d = new Date(); d.setFullYear(d.getFullYear() - 1);
          return d.toISOString().split('T')[0];
        })(),
        endDate: end,
        dimensions: ['date'],
        rowLimit: 500,
      },
    });

    // 月次集計
    const monthlyMap = {};
    (monthlyRes.data.rows || []).forEach(row => {
      const month = row.keys[0].substring(0, 7); // YYYY-MM
      if (!monthlyMap[month]) monthlyMap[month] = { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
      monthlyMap[month].clicks += row.clicks;
      monthlyMap[month].impressions += row.impressions;
      monthlyMap[month].position += row.position;
      monthlyMap[month].count++;
    });
    const monthly = Object.entries(monthlyMap).map(([month, d]) => ({
      month,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0,
      avgPosition: d.count > 0 ? (d.position / d.count) : 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

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
        monthly,
      },
    });

  } catch (error) {
    console.error('Search Console API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'サービスアカウントをSearch Consoleのオーナーとして追加してください',
    });
  }
};
