// api/ga4.js
// GA4データ取得エンドポイント
// GET /api/ga4?propertyId=XXXXXXXX&startDate=2024-01-01&endDate=2024-01-31

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// サービスアカウントキーは環境変数から取得（Vercelの環境変数に設定）
function getAnalyticsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return new BetaAnalyticsDataClient({ credentials });
}

module.exports = async (req, res) => {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 簡易認証（リクエストヘッダーのAPIキーを確認）
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  const { propertyId, startDate, endDate } = req.query;

  if (!propertyId) {
    return res.status(400).json({ error: 'propertyIdが必要です' });
  }

  try {
    const analyticsClient = getAnalyticsClient();

    // ========== 月次データ取得（過去12ヶ月）==========
    const [monthlyResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '365daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    });

    // ========== CV（コンバージョン）データ ==========
    const [cvResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '365daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'yearMonth' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['tel_click', 'form_submit', 'reservation_click', 'line_click', 'purchase'],
          },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    });

    // ========== チャネル別データ ==========
    const [channelResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
    });

    // ========== 参照元URL別データ ==========
    const [referrerResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    });

    // ========== ページ別データ ==========
    const [pageResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 30,
    });

    // ========== 端末別データ ==========
    const [deviceResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
    });

    // ========== 年齢・性別データ ==========
    const [ageResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'userAgeBracket' }],
      metrics: [{ name: 'totalUsers' }],
    });

    const [genderResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'userGender' }],
      metrics: [{ name: 'totalUsers' }],
    });

    // ========== ボタンクリックイベント ==========
    const [buttonResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: startDate || '30daysAgo', endDate: endDate || 'yesterday' }],
      dimensions: [{ name: 'customEvent:event_id' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'click' },
        },
      },
    });

    // ========== データ整形 ==========
    const formatMonthly = (rows) => {
      return rows.map(row => ({
        month: row.dimensionValues[0].value, // YYYYMM形式
        users: parseInt(row.metricValues[0].value),
        newUsers: parseInt(row.metricValues[1].value),
        sessions: parseInt(row.metricValues[2].value),
        avgSessionDuration: parseFloat(row.metricValues[3].value),
        pageViews: parseInt(row.metricValues[4].value),
        bounceRate: parseFloat(row.metricValues[5].value),
      }));
    };

    const formatCV = (rows) => {
      const cvByMonth = {};
      rows.forEach(row => {
        const month = row.dimensionValues[0].value;
        const event = row.dimensionValues[1].value;
        const count = parseInt(row.metricValues[0].value);
        if (!cvByMonth[month]) cvByMonth[month] = { tel: 0, form: 0, rsv: 0, line: 0, total: 0 };
        if (event === 'tel_click') cvByMonth[month].tel += count;
        if (event === 'form_submit') cvByMonth[month].form += count;
        if (event === 'reservation_click') cvByMonth[month].rsv += count;
        if (event === 'line_click') cvByMonth[month].line += count;
        cvByMonth[month].total += count;
      });
      return cvByMonth;
    };

    const formatChannels = (rows) => {
      return rows.map(row => ({
        channel: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      }));
    };

    const formatPages = (rows) => {
      return rows.map(row => ({
        path: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
        avgDuration: parseFloat(row.metricValues[2].value),
        bounceRate: parseFloat(row.metricValues[3].value),
      }));
    };

    const formatDevice = (rows) => {
      const result = { mobile: 0, desktop: 0, tablet: 0 };
      rows.forEach(row => {
        const device = row.dimensionValues[0].value.toLowerCase();
        const users = parseInt(row.metricValues[0].value);
        if (device === 'mobile') result.mobile = users;
        else if (device === 'desktop') result.desktop = users;
        else if (device === 'tablet') result.tablet = users;
      });
      return result;
    };

    const formatButtonClicks = (rows) => {
      const result = {};
      rows.forEach(row => {
        const eventId = row.dimensionValues[0].value;
        const count = parseInt(row.metricValues[0].value);
        result[eventId] = count;
      });
      return result;
    };

    // ========== レスポンス ==========
    res.status(200).json({
      success: true,
      propertyId,
      fetchedAt: new Date().toISOString(),
      data: {
        monthly: formatMonthly(monthlyResponse.rows || []),
        cv: formatCV(cvResponse.rows || []),
        channels: formatChannels(channelResponse.rows || []),
        referrers: referrerResponse.rows?.map(r => ({
          source: r.dimensionValues[0].value,
          users: parseInt(r.metricValues[0].value),
        })) || [],
        pages: formatPages(pageResponse.rows || []),
        devices: formatDevice(deviceResponse.rows || []),
        age: ageResponse.rows?.map(r => ({
          bracket: r.dimensionValues[0].value,
          users: parseInt(r.metricValues[0].value),
        })) || [],
        gender: genderResponse.rows?.map(r => ({
          gender: r.dimensionValues[0].value,
          users: parseInt(r.metricValues[0].value),
        })) || [],
        buttonClicks: formatButtonClicks(buttonResponse.rows || []),
      },
    });

  } catch (error) {
    console.error('GA4 API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'サービスアカウントにGA4へのアクセス権限があるか確認してください',
    });
  }
};
