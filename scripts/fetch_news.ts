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

// Fetch more per query so quality filter has enough to work with
const ARTICLES_PER_QUERY = 5;
// Max new articles to enhance per run
const MAX_NEW_PER_RUN = 10;
// No cap on total articles — keep everything

// ─────────────────────────────────────────────
// Quality filtering
// ─────────────────────────────────────────────
const JUNK_KEYWORDS = [
    'male enhancement', 'weight loss supplement', 'keto gummies', 'cbd gummies',
    'crypto presale', 'presale', 'affiliate', 'sponsored', 'buy now', 'limited offer',
    'game pass', 'playstation plus', 'xbox game pass', 'free trial',
    'review roundup', 'best vpn', 'best antivirus', 'penis', 'erect',
    'earn money', 'work from home', 'make money online',
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
    'huffpost', 'vice', 'buzzfeed news', 'the atlantic',
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
    if (!a.description || a.description.length < 40) return false;

    const text = `${a.title} ${a.description}`.toLowerCase();
    if (JUNK_KEYWORDS.some(kw => text.includes(kw))) return false;

    // Allow unlisted sources only if description is substantial (>100 chars)
    const sourceName = (a.source?.name ?? '').toLowerCase();
    if (!TRUSTED_SOURCES.has(sourceName) && a.description.length < 100) return false;

    return true;
}

// ─────────────────────────────────────────────
// Robust JSON extraction from AI response
// ─────────────────────────────────────────────
function safeParseAIJson(raw: string): Record<string, any> | null {
    if (!raw) return null;

    // Strip markdown fences
    let cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

    // Attempt 1: direct parse
    try { return JSON.parse(cleaned); } catch (_) {}

    // Attempt 2: extract first { ... } block
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
    }

    // Attempt 3: truncated JSON — close open strings/arrays/object
    if (start !== -1) {
        try {
            let partial = cleaned.slice(start);
            // Drop an incomplete trailing key or value
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
    celebrities: string[];   // repurposed as general topic tags
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
// AI enhancement — topic-agnostic
// ─────────────────────────────────────────────
async function enhanceWithAI(article: NewsArticle, category: string): Promise<EnhancedContent> {
    // Sanitise inputs so the AI does not produce broken JSON
    const sanitise = (s: string) => (s ?? '')
        .replace(/\[\+\d+ chars\]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')  // strip control chars
        .trim()
        .slice(0, 800);                            // cap length to avoid truncation

    const prompt = `You are a sharp news editor for a trending news website.

Category: ${category}
Source: ${article.source?.name || 'Unknown'}
Title: ${sanitise(article.title)}
Description: ${sanitise(article.description)}
Content: ${sanitise(article.content)}

Rewrite this into a compelling news article. Rules:
- Use ONLY ASCII characters — no curly quotes, em-dashes, or special symbols.
- Keep content paragraphs short (2-3 sentences each).
- Return ONLY a JSON object with keys: title, excerpt, content, tags.
- content value: 2-3 <p> tags with plain ASCII text inside.
- tags value: array of up to 5 proper noun strings.`;

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
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        const data: any = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? '';
        const result = safeParseAIJson(raw);

        if (!result) {
            throw new Error(`Unparseable response: ${raw.slice(0, 100)}`);
        }

        return {
            title:   typeof result.title   === 'string' && result.title   ? result.title   : article.title,
            excerpt: typeof result.excerpt === 'string' && result.excerpt ? result.excerpt : article.description,
            content: typeof result.content === 'string' && result.content ? result.content : `<p>${article.description}</p>`,
            tags:    Array.isArray(result.tags) ? result.tags.filter((t: any) => typeof t === 'string') : [],
        };
    } catch (error) {
        console.warn(`  ⚠ AI fallback used: ${(error as Error).message}`);
        return {
            title:   article.title,
            excerpt: article.description || 'No excerpt available.',
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

    // Most recent first
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
