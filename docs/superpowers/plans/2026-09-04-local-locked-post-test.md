# Local Locked Post Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建本地管理员 key 配置模板，并增加一篇不推送的加锁测试文章。

**Architecture:** `.env.local` 保存本机 `HATRIX_ADMIN_KEY`，继续由公共仓库忽略；测试文章放在独立的 `.private-content` 仓库中，沿用现有 posts collection、加密组件和 `/posts/<legacySlug>/` 路由。测试文章保持未提交，只服务本地调试。

**Tech Stack:** Astro 7、Markdown Content Collection、`.env.local`、独立私有内容仓库

## Global Constraints

- 不读取、生成或写入用户的真实管理员 key。
- `.env.local` 只保留空值，且不得进入 Git 暂存区。
- 测试文章必须设置 `draft: false`、`locked: true`，正文不得包含 key 或其他敏感信息。
- 不提交或推送 `.private-content` 中的测试文章，不触发线上内容部署。
- 不修改其他会话当前正在编辑的 E2E 文件。

---

### Task 1: 创建本地配置和加锁测试文章

**Files:**
- Create: `.env.local`
- Create: `.private-content/posts/2026-09-04-加锁功能测试.md`

**Interfaces:**
- Consumes: `HATRIX_ADMIN_KEY`、现有文章 schema 和 `legacySlug` 路由规则。
- Produces: 本地 `/posts/加锁功能测试/` 加锁页面；用户填写 key 并重启预览后可解锁。

- [ ] **Step 1: 确认目标不存在且工作区没有同名改动**

Run:

```powershell
Test-Path -LiteralPath .env.local
Test-Path -LiteralPath '.private-content/posts/2026-09-04-加锁功能测试.md'
git status --short
git -C .private-content status --short
```

Expected: 两个 `Test-Path` 都返回 `False`；已存在的其他会话改动保持原样。

- [ ] **Step 2: 创建空的本地 key 配置**

Create `.env.local`:

```dotenv
# 填写与 GitHub Actions Secret HATRIX_ADMIN_KEY 相同的值，至少 8 个字符。
HATRIX_ADMIN_KEY=
```

- [ ] **Step 3: 创建真实的加锁测试文章**

Create `.private-content/posts/2026-09-04-加锁功能测试.md`:

```markdown
---
title: 加锁功能测试
description: 用于检查本地文章加锁、解锁和凭据恢复流程
pubDate: 2026-09-04
cover: /images/default-cover.svg
type: 技术笔记
draft: false
locked: true
math: false
mermaid: false
legacySlug: 加锁功能测试
---

## 测试说明

这篇文章只用于本地验证加锁功能。未解锁时，页面不应显示下面的正文。

## 解锁后的内容

如果能看到这段文字，说明正文已经在浏览器中成功解密。
```

- [ ] **Step 4: 验证忽略规则、文件内容和 schema**

Run:

```powershell
git check-ignore -v .env.local
git status --short
git -C .private-content status --short
corepack pnpm check
```

Expected: `.env.local` 命中 `.gitignore`；公共仓库不会列出该文件；私有内容仓库只列出新测试文章；Astro check 为 0 errors。

- [ ] **Step 5: 保留用户填写和运行步骤**

用户在 `.env.local` 的等号后填写与 GitHub Secret 相同的 key，然后运行：

```powershell
corepack pnpm exec astro dev stop
corepack pnpm dev --host 127.0.0.1 --port 4321
```

打开 `http://127.0.0.1:4321/posts/加锁功能测试/`。正确 key 应显示“如果能看到这段文字”；测试文章在用户明确要求前保持未提交、未推送。
