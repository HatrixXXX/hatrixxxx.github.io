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

test('about section routes keep their document titles without title banners', async ({ page }) => {
  for (const section of ABOUT_SECTION_LINKS) {
    const response = await page.goto(section.href);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(`^${section.label} \\|`));
    await expect(page.locator('[data-hero]')).toHaveCount(0);
    if (section.slug === 'friends') {
      await expect(page.locator('.friend-card')).toHaveCount(17);
      await expect(page.getByRole('link', { name: 'KraHsu' })).toHaveAttribute(
        'href',
        'https://blog.krahsu.top/'
      );
    } else if (section.slug !== 'software') {
      await expect(page.getByText('内容还在整理')).toBeVisible();
    }
  }
});

test('friend sidebar cards wrap their content with the declared bottom padding', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/about/friends/');

  const bottomSpacing = await page.locator('[data-profile-card], [data-site-stats]').evaluateAll((cards) =>
    cards.map((card) => {
      const lastChild = card.lastElementChild as HTMLElement;
      const cardRect = card.getBoundingClientRect();
      const childRect = lastChild.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        actual: cardRect.bottom - childRect.bottom - Number.parseFloat(style.borderBottomWidth),
        expected: Number.parseFloat(style.paddingBottom)
      };
    })
  );

  expect(bottomSpacing).toHaveLength(2);
  for (const spacing of bottomSpacing) {
    expect(Math.abs(spacing.actual - spacing.expected)).toBeLessThan(2);
  }
});

test('guestbook uses pathname-mapped Giscus comments', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.route('https://giscus.app/**', (route) => route.abort());
  const response = await page.goto('/guestbook/');

  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toHaveClass(/guestbook-page/);
  const shell = page.locator('[data-guestbook-shell]');
  await expect(shell).toBeVisible();
  await expect(shell.getByRole('heading', { name: '留言板' })).toBeVisible();
  const shellMaterial = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      backdropFilter: style.backdropFilter
    };
  });
  expect(shellMaterial.backgroundColor).toMatch(/^rgba\(.+, 0\.\d+\)$/);
  expect(shellMaterial.backdropFilter).not.toBe('none');
  const comments = page.locator('[data-giscus-comments]');
  await expect(comments).toHaveAccessibleName('评论');
  await expect(comments).toHaveAttribute('data-giscus-mapping', 'pathname');
  await expect(comments).toHaveAttribute('data-giscus-theme-mode', 'dark');
  const overlay = await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
  expect(overlay).toContain('rgba(23, 21, 29');
  await expect(page.getByRole('link', { name: '首页', exact: true })).toHaveCSS('color', 'rgb(233, 228, 220)');

  await page.setViewportSize({ width: 390, height: 844 });
  const backButtonBox = await page.getByRole('link', { name: '返回主页' }).boundingBox();
  const mobileShellBox = await shell.boundingBox();
  expect(backButtonBox).not.toBeNull();
  expect(mobileShellBox).not.toBeNull();
  expect(mobileShellBox!.y - (backButtonBox!.y + backButtonBox!.height)).toBeGreaterThanOrEqual(12);
});

test('profile and article routes retain their contextual sidebar with one separate player dock', async ({ page }) => {
  for (const path of ['/about/hobbies/', '/posts/Infra-线性代数/']) {
    await page.goto(path);
    const stack = path.startsWith('/posts/') ? page.locator('.post-sidebar') : page.locator('[data-sidebar-stack]');
    await expect(stack).toHaveCount(1);
    await expect(stack.locator('[data-music-player]')).toHaveCount(0);
    await expect(page.locator('[data-music-player]')).toHaveCount(1);
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-display-mode', 'dock');
    if (path.startsWith('/posts/')) {
      await expect(stack.locator('[data-table-of-contents]')).toHaveCount(1);
      continue;
    }
    await expect(stack.locator(':scope > [data-profile-card]')).toHaveCount(1);
    await expect(stack.locator(':scope > [data-site-stats]')).toHaveCount(0);
    expect(
      await stack.locator(':scope > *').evaluateAll((children) =>
        children.map((child) =>
          child.hasAttribute('data-profile-card')
            ? 'profile'
            : child.hasAttribute('data-site-stats')
              ? 'stats'
              : 'unknown'
        )
      )
    ).toEqual(['profile']);
  }
});

test('selected about routes omit the profile sidebar and let content use the full container', async ({ page }) => {
  for (const path of ['/about/', '/about/bookmarks/', '/about/software/', '/about/gear/']) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack], [data-profile-card]')).toHaveCount(0);
    const main = page.locator('main.container');
    const content = path === '/about/software/'
      ? main
      : main.locator(':scope > article, :scope > .about-content');
    const [mainBox, contentBox] = await Promise.all([main.boundingBox(), content.boundingBox()]);
    expect(mainBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(contentBox!.x).toBeCloseTo(mainBox!.x, 1);
    expect(contentBox!.width).toBeCloseTo(mainBox!.width, 1);
  }
});

test('about sidebar exposes the requested profile and social links without statistics', async ({ page }) => {
  await page.goto('/about/hobbies/');
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
  await expect(wechat).toHaveAccessibleName('微信');
  await expect(wechat.getByText('待补充', { exact: true })).toHaveCount(0);
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

  await expect(page.locator('[data-site-stats]')).toHaveCount(0);
});

test('contextual sidebar cards remain readable in the light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/about/');

  await expect(page.locator('.about-main article > h1')).toHaveCSS('color', 'rgb(50, 45, 56)');
  await expect(page.locator('[data-profile-card]')).toHaveCount(0);
  await page.goto('/about/hobbies/');
  await expect(page.locator('[data-profile-card] h2')).toHaveCSS('color', 'rgb(50, 45, 56)');
  await expect(page.locator('[data-profile-card]').getByText('轻松即单纯，速成即精准')).toHaveCSS('color', 'rgb(101, 90, 107)');
  await expect(page.locator('[data-site-stats]')).toHaveCount(0);
});

test('the player dock reveals half a record and keeps playback controls independent from collapse', async ({ page }) => {
  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  const toggle = player.locator('[data-player-toggle]');
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  const record = await player.locator('.turntable').boundingBox();
  expect(record).not.toBeNull();
  expect(record!.x).toBeLessThan(0);
  expect(record!.x + record!.width).toBeGreaterThan(45);
  expect(record!.x + record!.width).toBeLessThan(70);
  await toggle.click({ position: { x: 92, y: 58 } });
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.getByRole('slider', { name: '音量调节' }).fill('0.4');
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.locator('[data-player-title]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.getByRole('button', { name: '收起音乐播放器' }).click();
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  await toggle.press('Enter');
  await player.locator('[data-player-play]').focus();
  await page.keyboard.press('Escape');
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  await expect(toggle).toBeFocused();
});

test('Sakana does not capture pointer input from mobile sidebar links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about/hobbies/');
  await expect(page.locator('[data-sakana-layer]')).toHaveCSS('pointer-events', 'none');

  const socialLink = page.getByRole('link', { name: '知乎', exact: true });
  await socialLink.evaluate((link) => link.scrollIntoView({ block: 'end' }));
  await expect(socialLink).toBeInViewport();
  await expect(socialLink).toHaveCSS('pointer-events', 'auto');
  await expect(socialLink).toHaveAttribute('data-social-id', 'zhihu');
});
