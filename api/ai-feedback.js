// api/ai-feedback.js
const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: '認証エラー' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { screenId, clinicData } = req.body;
  if (!screenId || !clinicData) {
    return res.status(400).json({ error: 'パラメータ不足' });
  }

  const name = clinicData.name || 'クライアント';
  const type = clinicData.type || 'その他';
  const area = clinicData.area || '';
  const month = clinicData.selectedMonth || '最新月';
  const users = clinicData.users || 0;
  const usersDelta = clinicData.usersDelta || 0;
  const cv = clinicData.cv || 0;
  const cvr = clinicData.cvr || '0.00';
  const organic = clinicData.organic || 0;
  const organicDelta = clinicData.organicDelta || 0;
  const engTime = clinicData.engTime || 0;
  const kwCount = clinicData.kwCount || 0;
  const avgPos = clinicData.avgPos || '―';

  const pages = (clinicData.pages || []).slice(0, 5)
    .map(p => `・${p.name || p.url}（${p.access}訪問）`).join('\n') || 'データなし';

  const keywords = (clinicData.keywords || []).slice(0, 5)
    .map(k => `・「${k.query}」クリック${k.clicks}回、${k.position}位`).join('\n') || 'データなし';

  const channels = (clinicData.channels || []).slice(0, 6)
    .map(c => `・${c.ch}：${c.u}人`).join('\n') || 'データなし';

  const prompts = {
    summary: `あなたはWEBマーケティングの専門家です。以下の実データを元に、${name}の担当者向けコメントを作成してください。

【${month}のデータ】
- 業種: ${type}／エリア: ${area}
- 訪問者数: ${users}人（前月比${usersDelta >= 0 ? '+' : ''}${usersDelta}%）
- お問い合わせ数: ${cv}件、お問い合わせ率: ${cvr}%
- 検索流入: ${organic}人（前月比${organicDelta >= 0 ? '+' : ''}${organicDelta}%）
- 平均閲覧時間: ${Math.floor(engTime/60)}分${engTime%60}秒

【ルール】
・専門用語を使わず、クライアントが理解できる言葉で書く
・具体的な数字を必ず使う
・良い点1つ、改善点1つを含める
・全体で150〜200文字以内
・箇条書きは使わず、自然な文章で書く`,

    traffic: `WEBマーケティング専門家として、${name}（${month}）の流入分析コメントを作成してください。

【流入チャネルデータ】
${channels}

【ルール】
・専門用語を使わず平易な言葉で
・主要な流入源の評価と改善アドバイスを含める
・全体で150文字以内・自然な文章で`,

    content: `WEBマーケティング専門家として、${name}（${month}）のページ分析コメントを作成してください。

【上位ページ】
${pages}

【ルール】
・専門用語を使わず平易な言葉で
・好調なページと改善が必要なページに言及
・全体で150文字以内・自然な文章で`,

    seo: `WEBマーケティング専門家として、${name}（${month}）のSEO分析コメントを作成してください。

【SEOデータ】
- 検索流入: ${organic}人（前月比${organicDelta >= 0 ? '+' : ''}${organicDelta}%）
- キーワード数: ${kwCount}件
- 平均掲載順位: ${avgPos}

【上位キーワード】
${keywords}

【ルール】
・専門用語を使わず平易な言葉で
・順位改善の余地があるキーワードに言及
・全体で150文字以内・自然な文章で`,

    users: `WEBマーケティング専門家として、${name}（${month}）のユーザー属性コメントを作成してください。

【データ】
- 訪問者数: ${users}人
- 業種: ${type}、エリア: ${area}

【ルール】
・ターゲット層への提案を含める
・全体で150文字以内・自然な文章で`,

    bench: `WEBマーケティング専門家として、${name}（${month}）のベンチマーク分析コメントを作成してください。

【データ】
- 訪問者数: ${users}人
- お問い合わせ率: ${cvr}%
- 検索流入: ${organic}人

【ルール】
・業界平均との比較に言及
・改善の優先ポイントを1つ
・全体で150文字以内・自然な文章で`,

    industry: `WEBマーケティング専門家として、${name}（${type}・${area}）の業界平均比較コメントを作成してください。

【自社データ】
- 訪問者数: ${users}人
- お問い合わせ率: ${cvr}%
- 検索流入: ${organic}人

【ルール】
・業界平均と比べた強み・弱みに言及
・全体で150文字以内・自然な文章で`,

    ranking: `WEBマーケティング専門家として、${name}（${month}）のランキング分析コメントを作成してください。

【データ】
- 訪問者数: ${users}人
- お問い合わせ率: ${cvr}%

【ルール】
・順位向上のアドバイスを含める
・全体で150文字以内・自然な文章で`,

    ahrefs: `WEBマーケティング専門家として、${name}のSEO外部データ（Ahrefs）コメントを作成してください。

【データ】
- 検索流入: ${organic}人
- キーワード数: ${kwCount}件

【ルール】
・被リンク獲得や権威性向上のアドバイス
・全体で150文字以内・自然な文章で`,

    improve: `WEBマーケティング専門家として、${name}（${type}・${area}）の改善提案を3つ作成してください。

【現状データ（${month}）】
- 訪問者数: ${users}人（前月比${usersDelta >= 0 ? '+' : ''}${usersDelta}%）
- お問い合わせ率: ${cvr}%
- 検索流入: ${organic}人

【出力形式】必ず以下のJSONのみを返してください（説明文・コードブロック不要）:
{"proposals":[{"priority":"high","title":"タイトル20文字以内","desc":"具体的な改善内容80文字以内","effect":"期待効果40文字以内"},{"priority":"mid","title":"...","desc":"...","effect":"..."},{"priority":"low","title":"...","desc":"...","effect":"..."}]}`
  };

  const prompt = prompts[screenId] || prompts.summary;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text.trim();

    if (screenId === 'improve') {
      try {
        const clean = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json({ success: true, data: parsed });
      } catch(e) {
        console.error('JSON parse error:', e.message, 'text:', text.slice(0, 200));
        return res.status(200).json({ success: true, text });
      }
    }

    return res.status(200).json({ success: true, text });
  } catch (error) {
    console.error('Claude API error:', error.message);
    return res.status(500).json({ error: 'AI生成エラー', detail: error.message });
  }
};
