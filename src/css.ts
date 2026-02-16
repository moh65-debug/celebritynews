export const cssStyles = `:root {
    --bg-color: #0d0d0d;
    --text-color: #e0e0e0;
    --accent-color: #ff0055;
    --secondary-color: #1a1a1a;
    --glass-bg: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: var(--font-body);
    line-height: 1.6;
    overflow-x: hidden;
}

h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
    font-weight: 700;
    color: #fff;
}

a {
    color: inherit;
    text-decoration: none;
    transition: color 0.3s ease;
}

a:hover {
    color: var(--accent-color);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
header {
    background: rgba(13, 13, 13, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--glass-border);
    position: sticky;
    top: 0;
    z-index: 1000;
    padding: 20px 0;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 1.5rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--accent-color);
}

/* Hero Section */
.hero {
    padding: 80px 0;
    text-align: center;
    background: radial-gradient(circle at center, rgba(255, 0, 85, 0.15) 0%, transparent 70%);
}

.hero h1 {
    font-size: 4rem;
    margin-bottom: 20px;
    background: linear-gradient(to right, #fff, #ff0055);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: fadeIn 1s ease-out;
}

.hero p {
    font-size: 1.2rem;
    color: #aaa;
    max-width: 600px;
    margin: 0 auto;
}

/* News Grid */
.news-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    padding: 40px 0;
}

.news-card {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
}

.news-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(255, 0, 85, 0.2);
    border-color: var(--accent-color);
}

.card-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
}

.card-content {
    padding: 20px;
}

.card-date {
    font-size: 0.8rem;
    color: var(--accent-color);
    margin-bottom: 10px;
    display: block;
    text-transform: uppercase;
    font-weight: 600;
}

.card-title {
    font-size: 1.5rem;
    margin-bottom: 10px;
    line-height: 1.3;
}

.card-excerpt {
    font-size: 0.95rem;
    color: #bbb;
}

/* Article Page */
.article-header {
    padding: 60px 0 40px;
    text-align: center;
}

.article-header h1 {
    font-size: 3rem;
    margin-bottom: 10px;
}

.article-hero-image {
    width: 100%;
    height: 500px;
    object-fit: cover;
    border-radius: 20px;
    margin-bottom: 40px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
}

.article-content {
    font-size: 1.1rem;
    line-height: 1.8;
    color: #ccc;
    max-width: 800px;
    margin: 0 auto;
}

.back-link {
    display: inline-block;
    margin-bottom: 20px;
    font-weight: 600;
    color: var(--accent-color);
}

.celebrity-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 15px;
}

.celebrity-tag {
    background: var(--accent-color);
    color: #fff;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Search and Categories */
.search-container {
    margin-bottom: 30px;
}

.search-input {
    width: 100%;
    max-width: 500px;
    padding: 12px 20px;
    border-radius: 30px;
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: #fff;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.3s ease;
}

.search-input:focus {
    border-color: var(--accent-color);
}

.categories-container {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 15px;
    margin-bottom: 40px;
}

.category-link {
    padding: 8px 20px;
    border-radius: 20px;
    background: var(--secondary-color);
    border: 1px solid var(--glass-border);
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.3s ease;
}

.category-link:hover, .category-link.active {
    background: var(--accent-color);
    color: #fff;
    border-color: var(--accent-color);
}

/* Footer */
footer {
    border-top: 1px solid var(--glass-border);
    padding: 40px 0;
    margin-top: 60px;
    text-align: center;
    color: #666;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
    .hero h1 { font-size: 2.5rem; }
    .article-header h1 { font-size: 2rem; }
    .article-hero-image { height: 300px; }
}
`;
