import type { APIContext } from 'astro';
import { getPosts, getPostUrl } from '../lib/content';
import { site as settings, url } from '../lib/site';

const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!));

export async function GET({ site }: APIContext) {
  const origin = site ?? new URL('http://localhost:4321');
  const posts = await getPosts();
  const absolute = (path: string) => new URL(path, origin).href;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${escapeXml(settings.title)}</title><link>${escapeXml(absolute(url('/')))}</link><description>${escapeXml(settings.description)}</description><language>zh-CN</language>${posts.map(post => `<item><title>${escapeXml(post.data.title)}</title><link>${escapeXml(absolute(getPostUrl(post)))}</link><guid isPermaLink="true">${escapeXml(absolute(getPostUrl(post)))}</guid><description>${escapeXml(`${post.data.example ? '【示例文章】' : ''}${post.data.description}`)}</description><pubDate>${post.data.published.toUTCString()}</pubDate><category>${escapeXml(post.data.category)}</category></item>`).join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
