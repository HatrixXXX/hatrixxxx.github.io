# 作品图鉴参考

`project-atlas-mecha-concept-v1.png` 是用户选定的封面视觉参考，旁边的同名 `.prompt.txt` 记录生成提示词。原图保持不变，不直接作为整页背景。透明抠图的提示词另存为 `project-atlas-cover-cutout-v1.prompt.txt`。

页面封面使用 `public/assets/projects/project-atlas-cover-v1.webp`：从选定图中分离书体，保留书脊、厚页、装甲和圆形仪表，再裁去透明边缘。翻页和扫描由 `ProjectBook.astro`、`project-book.css` 与 `project-book.ts` 实现。
