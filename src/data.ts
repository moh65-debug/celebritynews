export interface Article {
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

export const articles: Article[] = [];
