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

// How many articles to fetch per query (total budget: ARTICLES_PER_QUERY × queries)
const ARTICLES_PER_QUERY = 3;
// Max new articles to enhance per run (AI calls are slow — keep reasonable)
const MAX_NEW_PER_RUN = 10;
// No cap on total articles — keep everything

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

interface NewsArticle {
    title: string;
    description: string;
    content: string;
    urlToImage: string;
    publishedAt: string;
    url: string;
    source: { name: string };
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
    // Use 'publishedAt' sorting and a short lookback (last 48 h) for maximum recency
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
    return (data.articles as NewsArticle[]).filter(
        a => a.title && a.title !== '[Removed]' && a.urlToImage
    );
}

// ─────────────────────────────────────────────
// AI enhancement — now topic-agnostic
// ─────────────────────────────────────────────
async function enhanceWithAI(article: NewsArticle, category: string): Promise<EnhancedContent> {
    const prompt = `
You are a sharp, engaging news editor for a trending news website that covers everything — politics, tech, sports, entertainment, science, business, and world affairs.

Enhance the following article. Make it compelling, accurate, and reader-friendly.

Category: ${category}
Source: ${article.source?.name || 'Unknown'}
Original Title: ${article.title}
Original Description: ${article.description || ''}
Original Content: ${article.content || ''}

Tasks:
1. Rewrite the Title to be punchy and click-worthy (but not clickbait — keep it factual).
2. Write a one-sentence Excerpt that hooks the reader immediately.
3. Rewrite the Content as 2–4 engaging paragraphs in a lively, professional tone.
4. Extract up to 5 Tags — key people, companies, topics, or places mentioned (e.g. "Elon Musk", "OpenAI", "NBA", "Gaza", "Federal Reserve"). Use proper names/nouns only.

Return ONLY a valid JSON object — no markdown, no extra text:
{
  "title": "New Title",
  "excerpt": "One-sentence hook.",
  "content": "<p>Paragraph 1</p><p>Paragraph 2</p>",
  "tags": ["Tag1", "Tag2"]
}
`.trim();

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
                model: 'stepfun/step-3.5-flash:free',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        const data: any = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? '{}';
        const result = JSON.parse(raw);

        return {
            title:   result.title   || article.title,
            excerpt: result.excerpt || article.description || '',
            content: result.content || `<p>${article.content || ''}</p>`,
            tags:    Array.isArray(result.tags) ? result.tags : [],
        };
    } catch (error) {
        console.error('  ✗ AI enhancement failed:', error);
        return {
            title:   article.title,
            excerpt: article.description || 'No excerpt available.',
            content: `<p>${(article.content || '').replace(/\[\+\d+ chars\]/, '')}</p>`,
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

    // ── Load existing articles ──────────────────
    if (fs.existsSync(dataPath)) {
        try {
            const content = fs.readFileSync(dataPath, 'utf8');
            const match = content.match(/export const articles[^=]*=\s*(\[[\s\S]*?\]);/);
            if (match) existingArticles = JSON.parse(match[1]);
        } catch (e) {
            console.error('Failed to read existing articles:', e);
        }
    }
    const existingUrls  = new Set(existingArticles.map(a => a.url));
    const existingTitles = new Set(existingArticles.map(a => a.title));
    console.log(`📰 Currently have ${existingArticles.length} articles.\n`);

    // ── Fetch from all topic queries in parallel ─
    console.log('🌐 Fetching trending news from NewsAPI across all topics...');
    const fetchResults = await Promise.allSettled(
        TRENDING_QUERIES.map(({ q, label }) =>
            fetchForQuery(q, ARTICLES_PER_QUERY).then(arts => ({ arts, label }))
        )
    );

    // Collect unique raw articles, preserving their category label
    const seen = new Set<string>();
    const candidates: Array<{ art: NewsArticle; label: string }> = [];

    for (const result of fetchResults) {
        if (result.status !== 'fulfilled') continue;
        const { arts, label } = result.value;
        for (const art of arts) {
            if (
                !seen.has(art.url) &&
                !existingUrls.has(art.url) &&
                !existingTitles.has(art.title)
            ) {
                seen.add(art.url);
                candidates.push({ art, label });
            }
        }
    }

    // Sort candidates by publishedAt descending (most recent first)
    candidates.sort(
        (a, b) =>
            new Date(b.art.publishedAt).getTime() - new Date(a.art.publishedAt).getTime()
    );

    const toProcess = candidates.slice(0, MAX_NEW_PER_RUN);

    if (toProcess.length === 0) {
        console.log('✅ No new articles found — everything is up to date.');
        return;
    }

    console.log(`\n✨ Found ${candidates.length} new unique articles. Enhancing ${toProcess.length} with AI...\n`);

    // ── Enhance each article with AI ────────────
    const newlyEnhanced: Article[] = [];

    for (const [i, { art, label }] of toProcess.entries()) {
        console.log(`  [${i + 1}/${toProcess.length}] [${label}] ${art.title}`);
        const enhanced = await enhanceWithAI(art, label);

        newlyEnhanced.push({
            id:         Math.random().toString(36).substr(2, 9),
            title:      enhanced.title,
            excerpt:    enhanced.excerpt,
            content:    enhanced.content,
            celebrities: enhanced.tags,   // field kept for backward-compat with existing UI
            category:   label,
            image_url:  art.urlToImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2670&auto=format&fit=crop',
            date:       new Date(art.publishedAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                        }),
            url:        art.url,
        });
    }

    // ── Merge, deduplicate, cap ──────────────────
    const combined = [...newlyEnhanced, ...existingArticles];

    // ── Write back to data.ts ────────────────────
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
