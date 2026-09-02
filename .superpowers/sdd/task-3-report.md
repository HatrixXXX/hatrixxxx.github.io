# Task 3 migration report

## RED / GREEN evidence

- RED: `corepack pnpm vitest run tests/unit/classify-post.test.ts tests/unit/migrate-posts.test.ts`
  exited 1 with two expected missing-module failures for
  `scripts/migration/classify-post` and `scripts/migration/migrate-posts`.
- RED: `corepack pnpm vitest run tests/unit/migrate-posts.test.ts`
  exited 1 after adding the malformed-title regression case:
  `expected undefined to be 'FPGA 开发'`.
- GREEN: `corepack pnpm vitest run tests/unit/classify-post.test.ts tests/unit/migrate-posts.test.ts`
  exited 0: 2 files, 9 tests passed.
- Full suite: `corepack pnpm test:run` exited 0: 5 files, 15 tests passed.
- Type/content check: `corepack pnpm check` exited 0: 0 errors, 0 warnings.
- Production build: `corepack pnpm build` exited 0.

## Migration evidence

- Published posts: `_posts` 40; `src/content/posts` 40.
- Drafts: `_draft` 2 Markdown files; `src/drafts` 2 Markdown files.
- Parsed Markdown-body comparison: 0 mismatches across all 40 posts.
- Draft byte comparison: 0 mismatches across both drafts.
- Every migrated post has `legacySlug` and `category`; all six configured categories occur.
- 18 posts have series metadata across the five specified numbered series. The one
  source-title typo (`PGA开发`) retains its original title while using its filename
  identity to retain the `FPGA 开发` series association.
- A second migration run produced identical directory hashes:
  posts `a97f849d35a2023a43745a8cccab4183999a8efaade654792d5ff7fd7dc89f57`,
  drafts `a0b24698340a957538a9e6878e84c6aa22d54451eb6c896be1dfc796956ade5b`.

## Commit

`feat: migrate Jekyll posts into Astro collections`

## Concerns

`pnpm check` and `pnpm build` retain existing warnings: the configured Markdown
plugin API is deprecated, `src/content/projects` is empty, and legacy article
math contains KaTeX-incompatible input. No article body was changed to silence
these warnings.

## Reviewer follow-up: non-empty tags

- RED: `corepack pnpm vitest run tests/unit/classify-post.test.ts` exited 1:
  `设计模式简介` and `计算机组成结构` each produced `[]` instead of their
  required precise tags.
- GREEN: the same focused command exited 0: 1 file, 9 tests passed after adding
  the deterministic `设计模式` and `计算机组成` tag rules.
- Regenerated with `corepack pnpm migrate:posts`.
- Full migration verification reported: 40 source posts and 40 migrated posts;
  2 source drafts and 2 copied drafts; `bodyMismatches: []`,
  `draftByteMismatches: []`, and `emptyTagPosts: []`.
- `corepack pnpm test:run` exited 0: 5 files, 17 tests passed.
- `corepack pnpm check` exited 0 and its Astro diagnostic summary was
  `0 errors`, `0 warnings`, `0 hints`; `corepack pnpm build` exited 0.

The diagnostic summary counts only Astro's analysed file diagnostics. It does
not count CLI logger messages emitted before that summary. In the follow-up
check/build output, those separate messages were the deprecated Markdown-plugin
API notice and the empty `src/content/projects` glob warning; neither is an
Astro diagnostic warning. Article bodies and existing frontmatter values were
not changed to suppress either message.
