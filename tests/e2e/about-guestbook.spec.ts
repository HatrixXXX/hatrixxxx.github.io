import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS } from '../../src/config/navigation';

const expectedSocials = [
  { id: 'rss', label: 'RSS', href: '/rss.xml', external: false },
  { id: 'github', label: 'GitHub', href: 'https://github.com/HatrixXXX', external: true },
  { id: 'bilibili', label: 'Bilibili', href: 'https://space.bilibili.com/352420563', external: true },
  { id: 'zhihu', label: '知乎', href: 'https://www.zhihu.com/people/hatrixxxx', external: true },
  {
    id: 'xiaohongshu',
    label: '小红书',
    href: 'xhsdiscover://user/62a6030000000000190299d',
    external: false
  },
  {
    id: 'qqmusic',
    label: 'QQ 音乐',
    href: 'https://y.qq.com/n/ryqq_v2/profile/like/song?uin=oi65oiCA7e4A7c',
    external: true
  },
  { id: 'email', label: '邮件', href: 'mailto:3113624526@qq.com', external: false }
] as const;

test('about section routes render their labels and empty states', async ({ page }) => {
  for (const section of ABOUT_SECTION_LINKS) {
    const response = await page.goto(section.href);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(section.label);
    await expect(page.getByText('内容还在整理')).toBeVisible();
  }
});

test('guestbook uses pathname-mapped Giscus comments', async ({ page }) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  const response = await page.goto('/guestbook/');

  expect(response?.status()).toBe(200);
  const comments = page.locator('[data-giscus-comments]');
  await expect(comments.getByRole('heading', { name: '留言' })).toBeVisible();
  await expect(comments).toHaveAttribute('data-giscus-mapping', 'pathname');
});

test('about and article routes render the ordered contextual sidebar stack', async ({ page }) => {
  for (const path of ['/about/', '/about/hobbies/', '/posts/本科数学大杂烩/']) {
    await page.goto(path);
    const stack = page.locator('[data-sidebar-stack]');
    await expect(stack).toHaveCount(1);
    await expect(stack.locator(':scope > [data-profile-card]')).toHaveCount(1);
    await expect(stack.locator(':scope > [data-site-stats]')).toHaveCount(1);
    await expect(stack.locator(':scope > [data-music-player]')).toHaveCount(1);
    expect(
      await stack.locator(':scope > *').evaluateAll((children) =>
        children.map((child) =>
          child.hasAttribute('data-profile-card')
            ? 'profile'
            : child.hasAttribute('data-site-stats')
              ? 'stats'
              : child.hasAttribute('data-music-player')
                ? 'player'
                : 'unknown'
        )
      )
    ).toEqual(['profile', 'stats', 'player']);
  }
});

test('about sidebar exposes the requested profile, social links and static statistics', async ({ page }) => {
  await page.goto('/about/');
  const profile = page.locator('[data-profile-card]');
  await expect(profile.getByRole('heading', { name: 'Hatrixの窝' })).toBeVisible();
  await expect(profile.getByText('轻松即单纯，速成即精准')).toBeVisible();

  const socialItems = profile.locator('[data-social-id]');
  await expect(socialItems).toHaveCount(8);
  for (const social of expectedSocials) {
    const link = profile.getByRole('link', { name: social.label, exact: true });
    await expect(link).toHaveAttribute('data-social-id', social.id);
    await expect(link).toHaveAttribute('href', social.href);
    if (social.external) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'me noreferrer');
    } else {
      await expect(link).not.toHaveAttribute('target', '_blank');
    }
  }

  const wechat = profile.locator('span[data-social-id="wechat"]');
  await expect(wechat).toHaveAttribute('data-social-pending', 'wechat');
  await expect(wechat).toHaveAttribute('aria-disabled', 'true');
  await expect(wechat).toHaveAccessibleName(/微信.*待补充/);
  await expect(wechat.getByText('待补充', { exact: true })).toBeVisible();
  await expect(wechat.locator('a, button, [tabindex]')).toHaveCount(0);

  await expect(profile.locator('[data-social-id="zhihu"] text')).toHaveAttribute(
    'font-size',
    '16'
  );
  await expect(profile.locator('[data-social-id="xiaohongshu"] text')).toHaveAttribute(
    'font-size',
    '16'
  );

  const qqMusicIcon = profile.getByRole('link', { name: 'QQ 音乐' }).locator('svg');
  await expect(qqMusicIcon.locator('[data-qqmusic-logo="disc"]')).toHaveAttribute(
    'fill',
    'currentColor'
  );
  await expect(qqMusicIcon.locator('[data-qqmusic-logo="mark"]')).toHaveCount(1);
  await expect(qqMusicIcon.locator('[data-qqmusic-logo="mark"]')).toHaveAttribute(
    'fill',
    'var(--qqmusic-cutout)'
  );
  for (const absent of ['Gitee', 'Stack Overflow', 'Twitter', 'Telegram', 'QQ']) {
    await expect(profile.getByRole('link', { name: absent, exact: true })).toHaveCount(0);
  }

  const stats = page.locator('[data-site-stats]');
  await expect(stats.locator('[data-stat="posts"]')).toHaveText('40');
  await expect(stats.locator('[data-stat="visitors"]')).toHaveText('—');
});

test('contextual sidebar cards remain readable in the light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/about/');

  await expect(page.locator('.about-main article > h1')).toHaveCSS('color', 'rgb(22, 26, 32)');
  await expect(page.locator('[data-profile-card] h2')).toHaveCSS('color', 'rgb(22, 26, 32)');
  await expect(page.locator('[data-site-stats] h2')).toHaveCSS('color', 'rgb(22, 26, 32)');
  await expect(page.locator('[data-site-stats] dd').first()).toHaveCSS(
    'color',
    'rgb(48, 52, 59)'
  );
  await expect(page.locator('[data-music-player] strong')).toHaveCSS(
    'color',
    'rgb(48, 52, 59)'
  );
});

test('Sakana does not capture pointer input from mobile sidebar links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about/');
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-sakana-state', 'ready');

  const socialLink = page.getByRole('link', { name: '知乎', exact: true });
  await socialLink.evaluate((link) => link.scrollIntoView({ block: 'end' }));
  await expect(socialLink).toBeInViewport();

  const hitTarget = await socialLink.evaluate((link) => {
    const bounds = link.getBoundingClientRect();
    const hit = document.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2
    );
    return {
      socialId: hit?.closest('[data-social-id]')?.getAttribute('data-social-id') ?? null,
      interceptedBySakana: hit?.closest('.sakana-character') !== null
    };
  });
  expect(hitTarget).toEqual({ socialId: 'zhihu', interceptedBySakana: false });
});
