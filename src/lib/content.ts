import { getCollection, type CollectionEntry } from 'astro:content';
import { url } from './site';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(includeArchived = false): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => includeArchived || !data.archived);
  return posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

export function getPostUrl(post: Post): string {
  return url(post.data.permalink || `/posts/${post.id}/`);
}

export function formatDate(date: Date, short = false): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: short ? '2-digit' : 'long', day: 'numeric', timeZone: 'Asia/Shanghai',
  }).format(date);
}

export function readingTime(body = ''): string {
  const chinese = (body.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (body.replace(/[\u3400-\u9fff]/g, '').match(/[a-zA-Z0-9]+/g) || []).length;
  return `${Math.max(1, Math.ceil(chinese / 320 + words / 200))} 分钟阅读`;
}

export function categoryUrl(category: string): string {
  return url(`/categories/${encodeURIComponent(category)}/`);
}

export function tagUrl(tag: string): string {
  return url(`/tags/${encodeURIComponent(tag)}/`);
}

export function plainText(markdown = ''): string {
  return markdown.replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
