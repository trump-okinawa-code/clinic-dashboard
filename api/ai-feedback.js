import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
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

  const prompts = {
    summary: `あなたはWEBマーケティングの専門家です。以下のクリニック・店舗のWEBサイトデータを分析し、担当者向けのコメントを日本語で作成してください。

クリニック名: ${clinicData.name}
業種: ${clinicData.type}
エリア: ${clinicData.area}
選択月: ${clinicData.selectedMonth}

今月のデータ:
- 訪問者数: ${clinicData.users}人（前月比 ${clinicData.usersDelta}%）
- 新規訪問者: ${clinicData.newUsers}人
- お問い合わせ数: ${clinicData.cv}件
- お問い合わせ率: ${clinicData.cvr}%
- 検索流入: ${clinicData.organic}人（前月比 ${clinicData.organicDelta}%）
- 平均閲覧時間: ${clinicData.engTime}秒

以下の形式で分析コメントを作成してください：
1. 今月の総評（1〜2文）
2. 良い点（具体的な数字を使って1点）
3. 改善が必要な点（具体的な数字を使って1点）
4. 来月への提案（1文）

※専門用語を使わず、クライアントが理解できる平易な言葉で書いてください。
※全体で200文字以内に収めてください。`,

    traffic: `WEBマーケティング専門家として、以下の流入分析データからコメントを作成してください。

クリニック名: ${clinicData.name}
選択月: ${clinicData.selectedMonth}

流入チャネルデータ:
${clinicData.channels ? clinicData.channels.map(c => `- ${c.ch}: ${c.u}人`).join('\n') : 'データなし'}

以下を含む200文字以内のコメントを作成：
1. 主要な流入源の評価
2. 改善すべき流入源
3. 具体的なアドバイス1点`,

    content: `WEBマーケティング専門家として、以下のページパフォーマンスデータからコメントを作成してください。

クリニック名: ${clinicData.name}
選択月: ${clinicData.selectedMonth}

上位ページ:
${clinicData.pages ? clinicData.pages.slice(0,5).map(p => `- ${p.name||p.url}: ${p.access}訪問`).join('\n') : 'データなし'}

200文字以内で：
1. 好調なページの評価
2. 改善が必要なページ
3. コンテンツ改善アドバイス`,

    seo: `WEBマーケティング専門家として、以下のSEOデータからコメントを作成してください。

クリニック名: ${clinicData.name}
選択月: ${clinicData.selectedMonth}

SEOデータ:
- 検索流入: ${clinicData.organic}人
- キーワード数: ${clinicData.kwCount}件
- 平均掲載順位: ${clinicData.avgPos}位

上位キーワード:
${clinicData.keywords ? clinicData.keywords.slice(0,5).map(k => `- 「${k.query}」: ${k.clicks}クリック、${k.position}位`).join('\n') : 'データなし'}

200文字以内で：
1. SEO状況の総評
2. 強化すべきキーワード
3. 具体的なSEO改善提案`,

    improve: `WEBマーケティング専門家として、以下のデータを元に改善提案を3つ作成してください。

クリニック名: ${clinicData.name}
業種: ${clinicData.type}

データサマリ:
- 訪問者数: ${clinicData.users}人
- お問い合わせ率: ${clinicData.cvr}%
- 検索流入: ${clinicData.organic}人

以下のJSON形式で返してください（他のテキストは不要）：
{
  "proposals": [
    {
      "priority": "high",
      "title": "改善タイトル（20文字以内）",
      "desc": "具体的な改善内容（80文字以内）",
      "effect": "期待効果（40文字以内）"
    },
    {
      "priority": "mid",
      "title": "...",
      "desc": "...",
      "effect": "..."
    },
    {
      "priority": "low",
      "title": "...",
      "desc": "...",
      "effect": "..."
    }
  ]
}`
  };

  const prompt = prompts[screenId] || prompts.summary;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;

    // improveタブはJSON形式で返す
    if (screenId === 'improve') {
      try {
        const clean = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json({ success: true, data: parsed });
      } catch {
        return res.status(200).json({ success: true, text });
      }
    }

    return res.status(200).json({ success: true, text });
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'AI生成エラー', detail: error.message });
  }
}
