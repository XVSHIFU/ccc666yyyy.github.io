import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [slug, ...titleParts] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('用法：npm run new:post -- my-post "文章标题"\nslug 请使用小写英文字母、数字与连接号。');
  process.exit(1);
}

const title = titleParts.join(' ').trim() || slug;
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'src/content/posts', `${slug}.md`);
const content = `---
title: ${JSON.stringify(title)}
description: "在这里写一两句文章简介。"
published: ${today}T12:00:00+08:00
category: 随笔
tags: []
example: false
---

从这里开始写。
`;

try {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
  console.log(`已创建：${target}`);
} catch (error) {
  if (error?.code === 'EEXIST') {
    console.error(`文章已存在，不会覆盖：${target}`);
    process.exit(1);
  }
  throw error;
}
