/* ============================================================
   study room · data
   模块 = 商品；标价 = 学习时长；积分 = 结算所得
   ============================================================ */

/* 外链视频
   填了 link 的模块，买完、按下开始时都会问一句「要不要跳过去看」，
   书桌卡片上也会常驻一个「看视频」入口。
   现在挂的是 B 站搜索页当占位，把 up 主的视频地址整条换上去就行。 */
const bili = (kw) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(kw);

const MODULES = [
  /* ---------- 英语 ---------- */
  {
    id: 'vocab-basic', cat: 'english', catCn: '英语',
    en: 'english · vocab', name: '单词普通版',
    desc: '不背单词，一口气过 15 个新词，读完例句再走。',
    min: 30, pts: 30, tag: 'best seller', img: 'cards', theme: 'pink',
    link: ''
  },
  {
    id: 'vocab-target', cat: 'english', catCn: '英语',
    en: 'english · vocab', name: '单词目标版',
    desc: '不背单词，65 个词一组推完。今天的目标量，不商量。',
    min: 60, pts: 60, tag: 'fan fave', img: 'notebook', theme: 'orange',
    link: ''
  },
  {
    id: 'listening', cat: 'english', catCn: '英语',
    en: 'english · listening', name: '听力精听',
    desc: '两分钟音频，逐句听写，跟读到不看稿。',
    min: 25, pts: 25, tag: '', img: 'headphones', theme: 'cream',
    link: ''
  },
  {
    id: 'grammar', cat: 'english', catCn: '英语',
    en: 'english · grammar', name: '语法专项',
    desc: '一个语法点，十道题，错的那道抄进本子。',
    min: 40, pts: 40, tag: 'new', img: 'book', theme: 'pink',
    link: ''
  },
  {
    id: 'reading', cat: 'english', catCn: '英语',
    en: 'english · reading', name: '阅读精读',
    desc: '一篇阅读，划出五个长难句，翻到能讲出来。',
    min: 45, pts: 45, tag: '', img: 'magnifier', theme: 'orange',
    link: ''
  },

  /* ---------- 数学 ---------- */
  {
    id: 'maths-video', cat: 'maths', catCn: '数学',
    en: 'maths · lecture', name: '看教学视频',
    desc: '一节完整课，暂停三次记笔记，看完能自己复述。',
    min: 60, pts: 60, tag: 'best seller', img: 'video', theme: 'cream',
    link: bili('专升本 数学')
  },

  /* ---------- 政治 ---------- */
  {
    id: 'politics-video', cat: 'politics', catCn: '政治',
    en: 'politics · lecture', name: '看教学视频',
    desc: '一节课时长的串讲，边看边把框架画下来。',
    min: 90, pts: 90, tag: 'new', img: 'video', flip: true, theme: 'pink',
    link: bili('专升本 政治 网课')
  },
  {
    id: 'politics-recite', cat: 'politics', catCn: '政治',
    en: 'politics · recite', name: '背诵考题',
    desc: '三道大题，掐着表背，背完合上书默一遍。',
    min: 30, pts: 30, tag: '', img: 'exam', theme: 'orange',
    link: ''
  },
  {
    id: 'politics-drill', cat: 'politics', catCn: '政治',
    en: 'politics · drill', name: '做练习题',
    desc: '一整套选择题，错的标出来，找出它在哪一章。',
    min: 30, pts: 30, tag: '', img: 'workbook', theme: 'pink',
    link: ''
  },

  /* ---------- 遗传学 ---------- */
  {
    id: 'genetics-video', cat: 'genetics', catCn: '遗传学',
    en: 'genetics · lecture', name: '看教学视频',
    desc: '半节课，盯着遗传图谱看，看不懂的倒回去。',
    min: 30, pts: 30, tag: 'new', img: 'dna', theme: 'pink',
    link: bili('遗传学 专升本')
  },
  {
    id: 'genetics-recite', cat: 'genetics', catCn: '遗传学',
    en: 'genetics · recite', name: '背诵考题',
    desc: '实验设计与推导大题，背到能默写出每一步。',
    min: 30, pts: 30, tag: '', img: 'exam', flip: true, theme: 'cream',
    link: ''
  }
];

const CATS = [
  { id: 'all', label: 'all modules' },
  { id: 'english', label: '英语' },
  { id: 'maths', label: '数学' },
  { id: 'politics', label: '政治' },
  { id: 'genetics', label: '遗传学' }
];

const VOUCHERS = [
  { id: 'milk-tea', en: 'milk tea · large', name: '奶茶一杯（大杯）', desc: '大杯，加料随你挑。', cost: 150 },
  { id: 'milk-tea-m', en: 'milk tea · regular', name: '奶茶一杯（中杯）', desc: '中杯，少糖去冰，喝完接着学。', cost: 120 },
  { id: 'game-hour', en: 'game hour', name: '游戏一小时', desc: '一局接一局，理直气壮。', cost: 150 },
  { id: 'ai-chat', en: 'ai chat', name: '和 AI 聊天一小时', desc: '聊到忘了时间，这也算休息。', cost: 100 },
  { id: 'movie', en: 'movie ticket', name: '电影票一张', desc: '挑个周末，一个人也去。', cost: 300 },
  { id: 'blind-box', en: 'blind box', name: '盲盒一个', desc: '买的就是拆开那一下。', cost: 500 }
];
