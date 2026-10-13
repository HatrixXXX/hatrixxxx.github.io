export interface Bookmark {
  title: string;
  url: string;
  category: string;
  description: string;
}

// A small public selection from the published “杂货铺” post.
export const BOOKMARKS: Bookmark[] = [
  {
    title: '扬神的博客',
    url: 'https://www.cnblogs.com/sasasatori',
    category: '技术博客',
    description: '个人技术文章与实践记录。'
  },
  {
    title: "X-Jeff's Blog",
    url: 'https://shichaoxin.com/',
    category: '技术博客',
    description: '计算机视觉与机器学习相关的个人文章。'
  },
  {
    title: "Siboehm's Blog",
    url: 'https://siboehm.com/',
    category: '技术博客',
    description: '围绕机器学习系统、编译器和性能优化的技术文章。'
  },
  {
    title: 'Git Game',
    url: 'https://learngitbranching.js.org/?locale=zh_CN',
    category: '交互练习',
    description: '通过可视化关卡练习 Git 分支、提交与合并。'
  },
  {
    title: '钢笔工具',
    url: 'https://bezier.method.ac/',
    category: '交互练习',
    description: '用互动练习熟悉贝塞尔曲线与钢笔工具。'
  },
  {
    title: 'LearnCpp',
    url: 'https://www.learncpp.com/',
    category: '系统课程',
    description: '按章节组织的 C++ 语言教程。'
  },
  {
    title: 'HDLBits',
    url: 'https://hdlbits.01xz.net/wiki/Problem_sets',
    category: '系统课程',
    description: '通过在线题目练习数字电路与 Verilog。'
  },
  {
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/zh-CN/',
    category: '开发文档',
    description: 'Web 技术文档与前端开发参考资料。'
  },
  {
    title: 'GAMES 101',
    url: 'https://sites.cs.ucsb.edu/~lingqi/teaching/games101.html',
    category: '系统课程',
    description: '计算机图形学入门课程及配套资料。'
  },
  {
    title: '动手学深度学习',
    url: 'https://zh.d2l.ai/',
    category: '系统课程',
    description: '结合代码与数学讲解深度学习的在线教材。'
  },
  {
    title: 'Robot Academy',
    url: 'https://robotacademy.net.au/',
    category: '系统课程',
    description: '面向机器人学的课程与教学资源。'
  },
  {
    title: '3Blue1Brown',
    url: 'https://www.3blue1brown.com/',
    category: '数学与可视化',
    description: '用动画和可视化解释数学概念。'
  },
  {
    title: 'PythonRobotics',
    url: 'https://atsushisakai.github.io/PythonRobotics/index.html',
    category: '开源项目',
    description: '用 Python 示例演示机器人算法的开源资料。'
  },
  {
    title: '中文独立博客列表',
    url: 'https://github.com/timqian/chinese-independent-blogs',
    category: '开源项目',
    description: '持续收集中文独立博客的开源列表。'
  },
  {
    title: 'CS 自学指南',
    url: 'https://csdiy.wiki/',
    category: '学习路线',
    description: '整理计算机科学自学课程与学习路径。'
  },
  {
    title: 'Developer Roadmaps',
    url: 'https://roadmap.sh/',
    category: '学习路线',
    description: '按岗位和技术主题梳理开发者学习路线。'
  },
  {
    title: 'Math Major Roadmap',
    url: 'https://math.mit.edu/academics/undergrad/roadmaps.php',
    category: '学习路线',
    description: 'MIT 数学本科课程与方向的路线资料。'
  },
  {
    title: 'Human System Optimization',
    url: 'https://github.com/zijie0/HumanSystemOptimization',
    category: '跨界阅读',
    description: '从系统视角整理个人成长与生活实践的开源项目。'
  }
];
