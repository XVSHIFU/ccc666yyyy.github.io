export const site = {
  name: 'qinghe',
  title: '清和的小站',
  description: '记录学习的足迹，也收藏生活的片刻。',
  github: 'https://github.com/XVSHIFU',
  email: 'cmy19935993759@gmail.com',
  defaultTheme: 'firefly',
};

export const themes = [
  { id: 'koharu', name: 'Koharu', label: '小春日和', description: '波浪封面 · 交错手账', source: 'https://github.com/cosZone/astro-koharu' },
  { id: 'firefly', name: 'Firefly', label: '流萤', description: '悬浮导航 · 三栏日记', source: 'https://github.com/CuteLeaf/Firefly' },
  { id: 'shirone', name: 'Shirone', label: '紫雾物语', description: '通栏横幅 · Material', source: 'https://github.com/LyraVoid/Shirone' },
  { id: 'solitude', name: 'Solitude', label: '独处时光', description: '杂志文章 · 蓝色名片', source: 'https://github.com/everfu/hexo-theme-solitude' },
  { id: 'redefine', name: 'Redefine', label: '重新定义', description: '全屏影像 · 沉浸首屏', source: 'https://github.com/evannotfound/hexo-theme-redefine' },
  { id: 'cactus', name: 'Cactus', label: '文字之间', description: '等宽字体 · 日期索引', source: 'https://github.com/chrismwilliams/astro-theme-cactus' },
  { id: 'traveritas', name: 'Traveritas', label: '醒梦之间', description: '衬线目录 · 浮窗叠影', source: 'https://traveritas.github.io/articles/' },
  { id: 'radar', name: 'Radar', label: '观测手记', description: '黑绿雷达 · 档案控制台', source: 'https://radarlaboratory.com/' },
  { id: 'goodfella', name: 'Good Fella', label: '橙色片场', description: '橙色字符 · 编辑画幅', source: 'https://good-fella.com/' },
  { id: 'ava', name: 'AVA', label: '红色构想', description: '点阵雕塑 · 巨幅字面', source: 'https://srg.ava-digital.site/' },
  { id: 'nfinite', name: 'Nfinite', label: '纸上生长', description: '满幅影像 · 轻盈纸层', source: 'https://nfinitepaper.com/' },
  { id: 'followart', name: 'Follow Art', label: '随行画廊', description: '鲜明色面 · 旋转展签', source: 'https://follow.art/' },
  { id: 'milkin', name: 'Milkin', label: '静物之间', description: '低声留白 · 错位作品集', source: 'https://www.maxmilkin.com/' },
  { id: 'digilab', name: 'Digilab', label: '林间实验', description: '乳白与紫 · 开阔景深', source: 'https://digilab.co/' },
  { id: 'stefan', name: 'Stefan', label: '切片画廊', description: '交互目录 · 惯性画廊', source: 'https://stefanvitasovic.dev/projects' },
  { id: 'buro', name: 'Büro 18', label: '时间漫游', description: '年份导览 · 横向叙事', source: 'https://18.burocratik.com/' },
] as const;
export type ThemeId = typeof themes[number]['id'];
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export function url(path: string = '/') { return `${base}/${path.replace(/^\/+/, '')}`; }
