import fs from 'fs';
import path from 'path';

const NEWS_API_KEY = '3bd0e315887f40e9b2b8cf5335c2c008';
const OPENROUTER_API_KEY = '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';
const NEWS_API_URL = `https://newsapi.org/v2/everything?q=celebrity&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Article {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    image_url: string;
    date: string;
    celebrities: string[];
    url?: string; // Storing original URL for deduplication
}

interface NewsArticle {
    title: string;
    description: string;
    content: string;
    urlToImage: string;
    publishedAt: string;
    url: string;
}

interface EnhancedContent {
    title: string;
    excerpt: string;
    content: string;
    celebrities: string[];
}

async function enhanceWithAI(article: NewsArticle): Promise<EnhancedContent> {
    const prompt = `
        You are a celebrity news editor. Enhance the following news article for a gossip website.
        
        Original Title: ${article.title}
        Original Description: ${article.description}
        Original Content: ${article.content}

        Tasks:
        1. Rewrite the Title to be more engaging and "click-worthy".
        2. Rewrite the Excerpt (one sentence) to be intriguing.
        3. Rewrite the Content to be more fluid and "gossipy" (keep it professional but fun).
        4. Extract a list of Celebrities mentioned in the text.

        Return ONLY a JSON object in the following format:
        {
            "title": "New Title",
            "excerpt": "New Excerpt",
            "content": "<p>Paragraph 1</p><p>Paragraph 2</p>",
            "celebrities": ["Name 1", "Name 2"]
        }
    `;

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://celebritynews.local',
                'X-Title': 'Celebrity News'
            },
            body: JSON.stringify({
                model: 'arcee-ai/trinity-large-preview:free',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        const data: any = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        return result;
    } catch (error) {
        console.error('AI Enhancement failed for:', article.title, error);
        return {
            title: article.title,
            excerpt: article.description || 'No excerpt available.',
            content: `<p>${article.content?.replace(/\[\+\d+ chars\]/, '') || 'No content available.'}</p>`,
            celebrities: []
        };
    }
}

async function fetchAndEnhanceNews() {
    const dataPath = path.resolve('src/data.ts');
    let existingArticles: Article[] = [];

    // Read existing articles
    if (fs.existsSync(dataPath)) {
        try {
            const content = fs.readFileSync(dataPath, 'utf8');
            const jsonMatch = content.match(/export const articles: Article\[\] = (\[[\s\S]*?\]);/);
            if (jsonMatch) {
                existingArticles = JSON.parse(jsonMatch[1]);
            }
        } catch (e) {
            console.error('Failed to read existing articles:', e);
        }
    }

    console.log(`Currently have ${existingArticles.length} articles.`);
    console.log('Fetching fresh news from NewsAPI...');

    try {
        const response = await fetch(NEWS_API_URL);
        const data: any = await response.json();

        if (data.status !== 'ok') {
            throw new Error(`NewsAPI error: ${data.message}`);
        }

        const rawArticles = data.articles;
        const newRawArticles = rawArticles.filter((art: NewsArticle) =>
            !existingArticles.some(existing => existing.url === art.url || existing.title === art.title)
        ).slice(0, 5); // Limit news intensity per run

        if (newRawArticles.length === 0) {
            console.log('No new articles found.');
            return;
        }

        console.log(`Found ${newRawArticles.length} new articles. Enhancing with AI...`);

        const newlyEnhanced: Article[] = [];
        for (const [index, art] of newRawArticles.entries()) {
            console.log(`[${index + 1}/${newRawArticles.length}] Enhancing: ${art.title}`);
            const enhanced = await enhanceWithAI(art);
            newlyEnhanced.push({
                id: Math.random().toString(36).substr(2, 9),
                ...enhanced,
                image_url: art.urlToImage || 'https://images.unsplash.com/photo-1519671482538-518b760640aa?q=80&w=2669&auto=format&fit=crop',
                date: new Date(art.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                url: art.url
            });
        }

        // Combine and limit to 50 articles
        const combinedArticles = [...newlyEnhanced, ...existingArticles].slice(0, 50);

        const fileContent = `export interface Article {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    image_url: string;
    date: string;
    celebrities: string[];
    url?: string;
}

export const articles: Article[] = ${JSON.stringify(combinedArticles, null, 4)};
`;

        fs.writeFileSync(dataPath, fileContent);
        console.log(`Successfully updated ${dataPath}. Added ${newlyEnhanced.length} new articles. Total: ${combinedArticles.length}`);
    } catch (error) {
        console.error('Error fetching/enhancing news:', error);
        process.exit(1);
    }
}

fetchAndEnhanceNews();
