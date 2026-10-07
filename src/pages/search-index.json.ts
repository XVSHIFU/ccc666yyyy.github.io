import { getPosts, getPostUrl, plainText } from '../lib/content';

export async function GET() {
  const posts = await getPosts();
  return new Response(JSON.stringify(posts.map(post => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    url: getPostUrl(post),
    example: post.data.example,
    content: plainText(post.body),
  }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
