import { expect, test } from '@playwright/test';

test('home stage fills the viewport without a wave divider', async ({ page }) => {
  await page.goto('/');

  const homeStage = page.locator('[data-home-stage]');
  await expect(homeStage).toBeVisible();
  const stage = await homeStage.boundingBox();
  expect(stage?.height).toBe(await page.evaluate(() => document.documentElement.clientHeight));
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('primary navigation pages omit title banners while article pages keep their own intro', async ({ page }) => {
  const routes = [
    ['/blog/', '想到啥写啥，慢慢看不着急'],
    ['/projects/', '做过的项目与实验记录'],
    ['/about/', '写代码、搞研究、偶尔发呆'],
    ['/about/bookmarks/', '值得反复翻看的链接'],
    ['/about/software/', '收录常用软件、在线工具和工作中会反复打开的站点。'],
    ['/about/gear/', '日常使用的硬件与外设'],
    ['/plans/', '正在做和打算做的事'],
    ['/lab/', '各种好玩的小实验和未完成的东西'],
    ['/about/friends/', '一些有趣的人与站点'],
    ['/guestbook/', '想说什么都可以写在这里']
  ] as const;

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);

    for (const [route, subtitleText] of routes) {
      await page.goto(route);
      await expect(page.locator('[data-hero]')).toHaveCount(0);
      const subtitle = page.locator('[data-page-subtitle]');
      await expect(subtitle).toHaveText(subtitleText);
      const subtitleTextBox = await subtitle.locator('p').boundingBox();
      expect(subtitleTextBox?.y).toBeGreaterThanOrEqual(60);
      const main = page.locator('main');
      await expect(main).toBeVisible();
      const [subtitleBox, mainBox] = await Promise.all([subtitle.boundingBox(), main.boundingBox()]);
      expect(mainBox!.y).toBeGreaterThanOrEqual(subtitleBox!.y + subtitleBox!.height);
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }

    await page.goto('/posts/Infra-线性代数/');
    await expect(page.locator('[data-hero], .post-hero')).toHaveCount(0);
    await expect(page.locator('.post-intro h1')).toHaveText('Infra-线性代数');
    await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
  }
});
