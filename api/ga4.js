const { BetaAnalyticsDataClient } = require('@google-analytics/data');

function getAnalyticsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return new BetaAnalyticsDataClient({ credentials });
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

  const { propertyId, startDate, endDate } = req.query;
  if (!propertyId) {
    return res.status(400).json({ error: 'propertyIdが必要です' });
  }

  try {
    const client = getAnalyticsClient();

    const [monthly] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '365daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    });

    const [cv] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '365daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'yearMonth' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: ['tel_click', 'form_submit', 'reservation_click', 'line_click'] },
        },
      },
    });

    const [channels] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
    });

    const [pages] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'totalUsers' }, { name: 'averageSessionDuration' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    });

    const [devices] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'totalUsers' }],
    });

    const cvByMonth = {};
    (cv.rows || []).forEach(row => {
      const month = row.dimensionValues[0].value;
      const event = row.dimensionValues[1].value;
      const count = parseInt(row.metricValues[0].value);
      if (!cvByMonth[month]) cvByMonth[month] = { tel: 0, form: 0, rsv: 0, line: 0 };
      if (event === 'tel_click') cvByMonth[month].tel += count;
      if (event === 'form_submit') cvByMonth[month].form += count;
      if (event === 'reservation_click') cvByMonth[month].rsv += count;
      if (event === 'line_click') cvByMonth[month].line += count;
    });

    res.status(200).json({
      success: true,
      propertyId,
      fetchedAt: new Date().toISOString(),
      data: {
        monthly: (monthly.rows || []).map(row => ({
          month: row.dimensionValues[0].value,
          users: parseInt(row.metricValues[0].value),
          newUsers: parseInt(row.metricValues[1].value),
          sessions: parseInt(row.metricValues[2].value),
          avgDuration: Math.round(parseFloat(row.metricValues[3].value)),
          bounceRate: parseFloat(row.metricValues[4].value).toFixed(1),
          cv: cvByMonth[row.dimensionValues[0].value] || { tel: 0, form: 0, rsv: 0, line: 0 },
        })),
        channels: (channels.rows || []).map(row => ({
          channel: row.dimensionValues[0].value,
          users: parseInt(row.metricValues[0].value),
          sessions: parseInt(row.metricValues[1].value),
        })),
        pages: (pages.rows || []).map(row => ({
          path: row.dimensionValues[0].value,
          title: row.dimensionValues[1].value,
          users: parseInt(row.metricValues[0].value),
          avgDuration: Math.round(parseFloat(row.metricValues[1].value)),
        })),
        devices: Object.fromEntries(
          (devices.rows || []).map(row => [
            row.dimensionValues[0].value,
            parseInt(row.metricValues[0].value),
          ])
        ),
      },
    });
  } catch (error) {
    console.error('GA4 Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'サービスアカウントのメールアドレスをGA4に追加しましたか？',
    });
  }
};
