/* ============================================================
   study room · data
   模块 = 商品；标价 = 学习时长；积分 = 结算所得
   ============================================================ */

const MODULES = [
  {
    id: 'vocab-basic', cat: 'english', catCn: '英语',
    en: 'english · vocab', name: '单词普通版',
    desc: '不背单词，一口气过 15 个新词，读完例句再走。',
    min: 30, pts: 30, tag: 'best seller', img: 'cards', theme: 'pink'
  },
  {
    id: 'vocab-target', cat: 'english', catCn: '英语',
    en: 'english · vocab', name: '单词目标版',
    desc: '不背单词，65 个词一组推完。今天的目标量，不商量。',
    min: 60, pts: 60, tag: 'fan fave', img: 'notebook', theme: 'orange'
  },
  {
    id: 'listening', cat: 'english', catCn: '英语',
    en: 'english · listening', name: '听力精听',
    desc: '两分钟音频，逐句听写，跟读到不看稿。',
    min: 25, pts: 25, tag: '', img: 'headphones', theme: 'cream'
  },
  {
    id: 'grammar', cat: 'english', catCn: '英语',
    en: 'english · grammar', name: '语法专项',
    desc: '一个语法点，十道题，错的那道抄进本子。',
    min: 40, pts: 40, tag: 'new', img: 'book', theme: 'pink'
  },
  {
    id: 'reading', cat: 'english', catCn: '英语',
    en: 'english · reading', name: '阅读精读',
    desc: '一篇阅读，划出五个长难句，翻到能讲出来。',
    min: 45, pts: 45, tag: '', img: 'magnifier', theme: 'orange'
  },
  {
    id: 'maths', cat: 'maths', catCn: '数学',
    en: 'maths · redo', name: '错题重做',
    desc: '八道错题，遮住答案重算，步骤写全。',
    min: 30, pts: 30, tag: '', img: 'calculator', theme: 'cream'
  },
  {
    id: 'classical', cat: 'chinese', catCn: '语文',
    en: 'chinese · dictation', name: '文言默写',
    desc: '默一篇，逐句订正，错的字单拎出来写三遍。',
    min: 25, pts: 25, tag: '', img: 'brush', theme: 'pink'
  },
  {
    id: 'physics', cat: 'physics', catCn: '物理',
    en: 'physics · derive', name: '公式推导',
    desc: '手推三个公式，推到能讲给空气听明白。',
    min: 35, pts: 35, tag: 'limited', img: 'magnet', theme: 'orange'
  }
];

const CATS = [
  { id: 'all', label: 'all modules' },
  { id: 'english', label: '英语' },
  { id: 'maths', label: '数学' },
  { id: 'chinese', label: '语文' },
  { id: 'physics', label: '物理' }
];

const VOUCHERS = [
  { id: 'milk-tea', en: 'milk tea', name: '奶茶一杯', desc: '中杯，加料随你挑。', cost: 120 },
  { id: 'dessert', en: 'dessert', name: '甜品一份', desc: '蛋糕或冰淇淋，今天不称体重。', cost: 90 },
  { id: 'game-hour', en: 'game hour', name: '游戏一小时', desc: '一局接一局，理直气壮。', cost: 150 },
  { id: 'sleep-in', en: 'sleep in', name: '睡到自然醒', desc: '不设闹钟，睡到不想睡。', cost: 200 },
  { id: 'movie', en: 'movie ticket', name: '电影票一张', desc: '挑个周末，一个人也去。', cost: 300 },
  { id: 'blind-box', en: 'blind box', name: '盲盒一个', desc: '买的就是拆开那一下。', cost: 500 }
];
