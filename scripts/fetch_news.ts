import fs from 'fs';
import path from 'path';

const NEWS_API_KEY = '3bd0e315887f40e9b2b8cf5335c2c008';
const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─────────────────────────────────────────────
// Trending topic queries — broad & newsworthy
// ─────────────────────────────────────────────
const TRENDING_QUERIES = [
    { q: 'breaking news today',        label: 'Breaking' },
    { q: 'politics scandal',           label: 'Politics' },
    { q: 'technology AI',              label: 'Tech' },
    { q: 'sports highlights',          label: 'Sports' },
    { q: 'celebrity entertainment',    label: 'Entertainment' },
    { q: 'business economy markets',   label: 'Business' },
    { q: 'science discovery',          label: 'Science' },
    { q: 'world news conflict',        label: 'World' },
];

const ARTICLES_PER_QUERY = 5;
const MAX_NEW_PER_RUN = 10;

// ─────────────────────────────────────────────
// Quality filtering
// ─────────────────────────────────────────────
const JUNK_PATTERNS = [
    // supplements / health spam
    /male enhancement/i, /weight loss (supplement|pill|gummy)/i, /keto gummies/i,
    /cbd gummies/i, /testosterone boost/i, /libido/i, /erect/i, /penis/i,
    // finance spam
    /crypto presale/i, /presale/i, /meme coin/i, /token sale/i,
    /earn money online/i, /work from home/i, /make money/i,
    // gaming / streaming deals (not real news)
    /game pass/i, /playstation plus/i, /xbox (game pass|play anywhere)/i,
    /free trial/i, /now streaming/i, /where to watch/i, /how to watch/i,
    /ott release date/i, /tickets (are )?on sale/i,
    // pr / promo
    /press release/i, /globe newswire/i, /pr newswire/i, /sponsored/i,
    /affiliate/i, /buy now/i, /limited (offer|time)/i,
    // sport betting / predictions
    /best bets/i, /betting odds/i, /prediction.*odds/i,
    // misc low quality
    /best vpn/i, /best antivirus/i, /review roundup/i,
    /researchbuzz/i, /comics preview/i, /\[preview\]/i,
];

const TRUSTED_SOURCES = new Set([
    'bbc news', 'reuters', 'associated press', 'the guardian', 'the new york times',
    'washington post', 'bloomberg', 'financial times', 'al jazeera', 'npr',
    'cnn', 'abc news', 'nbc news', 'cbs news', 'sky news', 'the economist',
    'techcrunch', 'the verge', 'wired', 'ars technica', 'mit technology review',
    'espn', 'sports illustrated', 'the athletic',
    'rolling stone', 'variety', 'the hollywood reporter', 'entertainment weekly',
    'politico', 'axios', 'the hill', 'foreign policy',
    'nature', 'science', 'new scientist',
    'fortune', 'forbes', 'business insider', 'wall street journal',
    'time', 'newsweek', 'usa today', 'los angeles times', 'the independent',
    'huffpost', 'the atlantic', 'vice', 'new york post',
    'fox news', 'cnbc', 'marketwatch', 'the verge',
    'boston herald', 'silicon angle', 'toms hardware',
]);

interface NewsArticle {
    title: string;
    description: string;
    content: string;
    urlToImage: string;
    publishedAt: string;
    url: string;
    source: { name: string };
}

function isQualityArticle(a: NewsArticle): boolean {
    if (!a.title || a.title === '[Removed]') return false;
    if (!a.urlToImage) return false;
    if (!a.description || a.description.length < 60) return false;

    const text = `${a.title} ${a.description} ${a.url}`;
    if (JUNK_PATTERNS.some(p => p.test(text))) return false;

    // Require either a trusted source OR a long description (sign of real article)
    const sourceName = (a.source?.name ?? '').toLowerCase();
    const isTrusted = TRUSTED_SOURCES.has(sourceName);
    if (!isTrusted && a.description.length < 120) return false;

    return true;
}

// ─────────────────────────────────────────────
// Robust JSON extraction from AI response
// ─────────────────────────────────────────────
function safeParseAIJson(raw: string): Record<string, any> | null {
    if (!raw) return null;
    let cleaned = raw
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    try { return JSON.parse(cleaned); } catch (_) {}

    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
    }

    if (start !== -1) {
        try {
            let partial = cleaned.slice(start);
            partial = partial.replace(/,\s*"[^"]*$/, '');
            partial = partial.replace(/:\s*"[^"]*$/, ': ""');
            const openArrays = (partial.match(/\[/g) ?? []).length - (partial.match(/\]/g) ?? []).length;
            partial += ']'.repeat(Math.max(0, openArrays)) + '}';
            return JSON.parse(partial);
        } catch (_) {}
    }

    return null;
}

interface Article {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    image_url: string;
    date: string;
    celebrities: string[];
    category: string;
    url?: string;
}

interface EnhancedContent {
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
}

// ─────────────────────────────────────────────
// Fetch trending articles for a single query
// ─────────────────────────────────────────────
async function fetchForQuery(q: string, pageSize: number): Promise<NewsArticle[]> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const url =
        `https://newsapi.org/v2/everything` +
        `?q=${encodeURIComponent(q)}` +
        `&sortBy=publishedAt` +
        `&from=${since}` +
        `&language=en` +
        `&pageSize=${pageSize}` +
        `&apiKey=${NEWS_API_KEY}`;

    const res = await fetch(url);
    const data: any = await res.json();

    if (data.status !== 'ok') {
        console.warn(`  ⚠ NewsAPI error for "${q}": ${data.message}`);
        return [];
    }
    return (data.articles as NewsArticle[]).filter(isQualityArticle);
}

// ─────────────────────────────────────────────
// AI enhancement — deep, insightful content
// ─────────────────────────────────────────────
async function enhanceWithAI(article: NewsArticle, category: string): Promise<EnhancedContent> {
    const sanitise = (s: string) => (s ?? '')
        .replace(/\[\+\d+ chars\]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, 1000);

    const prompt = `You are a senior journalist writing for a high-quality news website. Your goal is to write a deep, insightful, well-structured article that genuinely informs the reader.

Category: ${category}
Source: ${article.source?.name || 'Unknown'}
Title: ${sanitise(article.title)}
Description: ${sanitise(article.description)}
Content snippet: ${sanitise(article.content)}

Write a full article following these strict rules:
- Title: punchy, factual, not clickbait.
- Excerpt: one compelling sentence summarising the story.
- Content: EXACTLY 4 to 6 paragraphs wrapped in <p> tags. Each paragraph must be 3-5 sentences. Cover: (1) what happened and why it matters, (2) background/context, (3) key details and quotes/data, (4) reactions or implications, (5-6) broader significance or what to watch next. Make it feel like a real, in-depth news article, not a summary.
- Tags: up to 5 proper noun tags (people, organisations, places).
- Use ONLY plain ASCII characters — no curly quotes, em-dashes, or Unicode symbols.

Return ONLY a valid JSON object with keys: title, excerpt, content, tags.`;

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://trendingnews.local',
                'X-Title': 'Trending News'
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-3-super-120b-a12b:free',
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        const data: any = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? '';
        const result = safeParseAIJson(raw);

        if (!result) throw new Error(`Unparseable: ${raw.slice(0, 100)}`);

        // Enforce minimum content depth — reject if fewer than 3 <p> tags
        const pCount = (result.content?.match(/<p>/g) ?? []).length;
        if (pCount < 3) throw new Error(`Content too short (${pCount} paragraphs)`);

        return {
            title:   typeof result.title   === 'string' && result.title   ? result.title   : article.title,
            excerpt: typeof result.excerpt === 'string' && result.excerpt ? result.excerpt : article.description,
            content: typeof result.content === 'string' && result.content ? result.content : `<p>${article.description}</p>`,
            tags:    Array.isArray(result.tags) ? result.tags.filter((t: any) => typeof t === 'string') : [],
        };
    } catch (error) {
        console.warn(`  ⚠ AI fallback: ${(error as Error).message}`);
        // Fallback: use original description — at least honest
        return {
            title:   article.title,
            excerpt: article.description || '',
            content: `<p>${(article.description || '').trim()}</p>`,
            tags:    [],
        };
    }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function fetchAndEnhanceNews() {
    const dataPath = path.resolve('src/data.ts');
    let existingArticles: Article[] = [];

    if (fs.existsSync(dataPath)) {
        try {
            const content = fs.readFileSync(dataPath, 'utf8');
            const match = content.match(/export const articles[^=]*=\s*(\[[\s\S]*?\]);/);
            if (match) existingArticles = JSON.parse(match[1]);
        } catch (e) {
            console.error('Failed to read existing articles:', e);
        }
    }

    const existingUrls   = new Set(existingArticles.map(a => a.url));
    const existingTitles = new Set(existingArticles.map(a => a.title));
    console.log(`📰 Currently have ${existingArticles.length} articles.\n`);

    console.log('🌐 Fetching trending news from NewsAPI across all topics...');
    const fetchResults = await Promise.allSettled(
        TRENDING_QUERIES.map(({ q, label }) =>
            fetchForQuery(q, ARTICLES_PER_QUERY).then(arts => ({ arts, label }))
        )
    );

    const seen = new Set<string>();
    const candidates: Array<{ art: NewsArticle; label: string }> = [];

    for (const result of fetchResults) {
        if (result.status !== 'fulfilled') continue;
        const { arts, label } = result.value;
        for (const art of arts) {
            if (!seen.has(art.url) && !existingUrls.has(art.url) && !existingTitles.has(art.title)) {
                seen.add(art.url);
                candidates.push({ art, label });
            }
        }
    }

    candidates.sort((a, b) =>
        new Date(b.art.publishedAt).getTime() - new Date(a.art.publishedAt).getTime()
    );

    const toProcess = candidates.slice(0, MAX_NEW_PER_RUN);

    if (toProcess.length === 0) {
        console.log('✅ No new articles found — everything is up to date.');
        return;
    }

    console.log(`\n✨ Found ${candidates.length} quality candidates. Enhancing top ${toProcess.length} with AI...\n`);

    const newlyEnhanced: Article[] = [];

    for (const [i, { art, label }] of toProcess.entries()) {
        console.log(`  [${i + 1}/${toProcess.length}] [${label}] ${art.title}`);
        const enhanced = await enhanceWithAI(art, label);

        newlyEnhanced.push({
            id:          Math.random().toString(36).substr(2, 9),
            title:       enhanced.title,
            excerpt:     enhanced.excerpt,
            content:     enhanced.content,
            celebrities: enhanced.tags,
            category:    label,
            image_url:   art.urlToImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2670&auto=format&fit=crop',
            date:        new Date(art.publishedAt).toLocaleDateString('en-US', {
                             month: 'short', day: 'numeric', year: 'numeric'
                         }),
            url:         art.url,
        });
    }

    const combined = [...newlyEnhanced, ...existingArticles];

    const fileContent = `export interface Article {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    image_url: string;
    date: string;
    celebrities: string[];   // repurposed as general topic tags
    category: string;
    url?: string;
}

export const articles: Article[] = ${JSON.stringify(combined, null, 4)};
`;

    fs.writeFileSync(dataPath, fileContent);
    console.log(`\n✅ Done! Added ${newlyEnhanced.length} new articles. Total: ${combined.length}.`);
}

fetchAndEnhanceNews();
