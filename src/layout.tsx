import { html } from 'hono/html'

export const Layout = (props: { title: string; children: any; head?: any }) => {
    return html`<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${props.title} - Celebrity News</title>
      <meta name="description" content="The latest celebrity news, gossip, and trends.">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="/styles.css"> 
      ${props.head}
    </head>
    <body>
      <div class="container">
        <header>
            <nav>
                <div class="logo">Celeb<span style="color:#fff">News</span></div>
                <div>
                   <!-- Add nav items if needed -->
                </div>
            </nav>
        </header>
        ${props.children}
        <footer>
            <p>&copy; ${new Date().getFullYear()} Celebrity News. All rights reserved.</p>
        </footer>
      </div>
    </body>
  </html>`
}
