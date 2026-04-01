import { Hono } from 'hono'
import { Layout } from './layout'
import { articles } from './data'
import { cssStyles } from './css'

const app = new Hono()

// All distinct categories present in the data
const ALL_CATEGORIES = [
    'Breaking', 'Politics', 'Tech', 'Sports',
    'Entertainment', 'Business', 'Science', 'World',
]

app.get('/', (c) => {
    const query    = c.req.query('q')?.toLowerCase()
    const category = c.req.query('category')

    let filteredArticles = articles

    if (query) {
        filteredArticles = filteredArticles.filter(a =>
            a.title.toLowerCase().includes(query) ||
            a.excerpt.toLowerCase().includes(query) ||
            a.celebrities.some(tag => tag.toLowerCase().includes(query))
        )
    }

    if (category) {
        filteredArticles = filteredArticles.filter(a =>
            (a.category ?? '') === category
        )
    }

    return c.html(
        <Layout title="Home">
            <div class="hero">
                <h1>TRENDING NEWS</h1>
                <p>The latest breaking stories across politics, tech, sports, entertainment, and beyond.</p>
            </div>

            <div class="container" style="text-align: center;">
                <div class="search-container">
                    <form method="get" action="/">
                        <input
                            type="text"
                            name="q"
                            placeholder="Search news, topics, or people..."
                            class="search-input"
                            value={query || ''}
                        />
                    </form>
                </div>

                <div class="categories-container">
                    <a href="/" class={!category ? 'category-link active' : 'category-link'}>All</a>
                    {ALL_CATEGORIES.map(cat => (
                        <a
                            href={`/?category=${encodeURIComponent(cat)}`}
                            class={category === cat ? 'category-link active' : 'category-link'}
                        >
                            {cat}
                        </a>
                    ))}
                </div>
            </div>

            <div class="news-grid">
                {filteredArticles.length > 0 ? (
                    filteredArticles.map((article) => (
                        <a href={`/article/${article.id}`} class="news-card">
                            <img src={article.image_url} alt={article.title} class="card-image" loading="lazy" />
                            <div class="card-content">
                                <span class="card-date">
                                    {article.category ? `${article.category} · ` : ''}{article.date}
                                </span>
                                <h2 class="card-title">{article.title}</h2>
                                <p class="card-excerpt">{article.excerpt}</p>
                                <div class="celebrity-tags">
                                    {article.celebrities?.slice(0, 4).map(tag => (
                                        <span class="celebrity-tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </a>
                    ))
                ) : (
                    <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                        <h3>No results found for your search.</h3>
                        <a href="/" class="back-link">Show all news</a>
                    </div>
                )}
            </div>
        </Layout>
    )
})

app.get('/article/:id', (c) => {
    const id      = c.req.param('id')
    const article = articles.find((a) => a.id === id)

    if (!article) {
        return c.html(
            <Layout title="Not Found">
                <div style="text-align: center; padding: 100px 0;">
                    <h1>404 - Article Not Found</h1>
                    <a href="/" class="back-link">← Back to Home</a>
                </div>
            </Layout>, 404
        )
    }

    return c.html(
        <Layout title={article.title}>
            <div class="article-header">
                <h1>{article.title}</h1>
                <div class="container" style="display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;">
                    {article.category && (
                        <span class="celebrity-tag" style="font-size: 0.85rem;">{article.category}</span>
                    )}
                    <span class="card-date" style="font-size: 1rem;">{article.date}</span>
                    <div class="celebrity-tags" style="margin-top: 0;">
                        {article.celebrities?.map(tag => (
                            <span class="celebrity-tag">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>
            <img src={article.image_url} alt={article.title} class="article-hero-image" />
            <div class="container" style="max-width: 800px;">
                <a href="/" class="back-link">← Back to News</a>
                <div class="article-content" dangerouslySetInnerHTML={{ __html: article.content }}></div>
            </div>
        </Layout>
    )
})

app.get('/styles.css', (c) => {
    return c.text(cssStyles, 200, { 'Content-Type': 'text/css' })
})

export default app
