/* ============================================================
   STUDY ROOM — 站点注册表
   加一门学科 = 在 subjects 里加一条 + 建一个页面目录
   其余文件（封面计数、学科卡片、占位状态、导航）全部自动生效
   ============================================================ */
window.SITE = {
  name: "STUDY ROOM",
  cn: "自习室",
  handle: "@study_room.exe",
  tagline: "把喜欢的东西，一页一页学成自己的。",
  url: "https://study.room",

  subjects: [
    {
      id: "english",
      name: "英语",
      en: "English",
      script: "English",
      desc: "每日背词故事 · 逐词点译 · 语法拆解 · 基础与进阶测验",
      status: "live",
      href: "subjects/english/index.html",
      hero: "assets/art/hero-english.jpg",
      color: "#ff4f9d",
      tags: ["背词", "精读", "自测"],
      note: "DAY 01–02 已收录"
    },
    {
      id: "math",
      name: "数学",
      en: "Mathematics",
      script: "Maths",
      desc: "公式推导 · 例题拆解 · 错题回看",
      status: "soon",
      href: "#",
      hero: "assets/art/hero-math.jpg",
      color: "#6a4fd4",
      tags: ["公式", "例题"],
      note: "排队中"
    },
    {
      id: "chinese",
      name: "语文",
      en: "Chinese",
      script: "Chinese",
      desc: "古诗文精读 · 现代文拆解 · 素材积累",
      status: "soon",
      href: "#",
      hero: "assets/art/hero-chinese.jpg",
      color: "#2fb6b0",
      tags: ["古文", "阅读"],
      note: "排队中"
    },
    {
      id: "physics",
      name: "物理",
      en: "Physics",
      script: "Physics",
      desc: "概念梳理 · 受力与过程分析 · 实验笔记",
      status: "soon",
      href: "#",
      hero: "assets/art/hero-physics.jpg",
      color: "#bf3a2b",
      tags: ["概念", "过程"],
      note: "排队中"
    }
  ]
};
