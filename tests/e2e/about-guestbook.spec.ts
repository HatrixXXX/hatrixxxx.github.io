import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS } from '../../src/config/navigation';
import { playlist } from '../../src/data/playlist';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

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

const compactContentSurfaces = [
  { path: '/about/', selector: '.about-main > article' },
  { path: '/toolbox/', selector: '[data-tool-deck]' },
  { path: '/plans/', selector: '.empty-state' },
  { path: '/digest/', selector: '.empty-state' }
] as const;

test('about section routes keep their document titles without title banners', async ({ page }) => {
  for (const section of ABOUT_SECTION_LINKS) {
    const response = await page.goto(section.href);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(`^${section.label} \\|`));
    await expect(page.locator('[data-hero]')).toHaveCount(0);
    await expect(page.getByText('内容还在整理')).toBeVisible();
  }
});

test('friend portal cancels an early release and opens a new tab at one second without release', async ({ page, context }) => {
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const portal = page.locator('[data-friend-portal]');
  await expect(portal).toBeVisible();
  await expect(portal.locator('img.portal-frame')).toHaveAttribute('src', '/assets/friends/portal-frame.png');
  await expect(portal.locator('img.portal-vortex')).toHaveAttribute('src', '/assets/friends/portal-vortex.webp');
  const box = await portal.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(portal).toHaveAttribute('data-state', 'charging');
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect(portal).toHaveAttribute('data-state', 'idle');
  await page.waitForTimeout(850);
  await expect(page).toHaveURL(/\/friends\/$/);
  expect(context.pages()).toHaveLength(1);

  await context.route('https://**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Friend</title>' }));
  const popupPromise = context.waitForEvent('page');
  await page.mouse.down();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/^https:\/\/(www\.cnblogs\.com\/sasasatori|polaris\.xn--6qq986b3xl\/|penry\.asia\/|blog\.krahsu\.top\/)/, { timeout: 5000 });
  await expect.poll(() => popup.evaluate(() => document.hasFocus())).toBe(true);
  await expect(page).toHaveURL(/\/friends\/$/);
  await page.bringToFront();
  await expect(portal).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('[data-progress-value]')).toHaveText('0%');
  await page.mouse.up();
  expect(Number(await portal.locator('[data-progress-circle]').evaluate((element) => (element as SVGCircleElement).style.strokeDashoffset))).toBeGreaterThan(280);
  await page.waitForTimeout(1300);
  await expect(page.locator('[data-progress-value]')).toHaveText('0%');
  await expect(page).toHaveURL(/\/friends\/$/);
});

test('friend portal waits for its artwork before ending a client navigation', async ({ page }) => {
  await page.route('**/assets/friends/portal-*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 9000));
    await route.continue();
  });
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('a[href="/friends/"]').first().click();
  await expect(page).toHaveURL(/\/friends\/$/);

  await page.waitForTimeout(5500);
  await expect(page.locator('#page-loader')).toBeVisible();
  await expect.poll(() => page.locator('.portal-frame').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect.poll(() => page.locator('.portal-vortex').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('friend portal retries artwork after a failed image request', async ({ page }) => {
  const failed = new Set<string>();
  await page.route('**/assets/friends/portal-*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!failed.has(path)) {
      failed.add(path);
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('a[href="/friends/"]').first().click();
  await expect(page).toHaveURL(/\/friends\/$/);

  await expect.poll(() => page.locator('.portal-frame').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect.poll(() => page.locator('.portal-vortex').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(failed.size).toBe(2);
});

test('friend portal reports an artwork failure instead of showing an empty doorway', async ({ page }) => {
  await page.route('**/assets/friends/portal-*', (route) => route.abort('failed'));
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('a[href="/friends/"]').first().click();
  await expect(page).toHaveURL(/\/friends\/$/);
  await expect(page.locator('[data-friend-portal]')).toHaveAttribute('data-state', 'blocked');
  await expect(page.locator('[data-portal-hint]')).toHaveText('传送门图片加载失败，请刷新页面重试');
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('friend portal retries artwork on a hard navigation', async ({ page }) => {
  const failed = new Set<string>();
  await page.route('**/assets/friends/portal-*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!failed.has(path)) {
      failed.add(path);
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.goto('/friends/');
  await expect.poll(() => page.locator('.portal-frame').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect.poll(() => page.locator('.portal-vortex').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  expect(failed.size).toBe(2);
});

test('friend portal keeps its artwork node during client navigation', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    document.addEventListener('astro:after-swap', () => {
      (window as Window & { portalAtSwap?: Element | null }).portalAtSwap = document.querySelector('[data-friend-portal]');
    }, { once: true });
  });
  await page.locator('a[href="/friends/"]').first().click();
  await expect(page).toHaveURL(/\/friends\/$/);
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(await page.evaluate(() => (window as Window & { portalAtSwap?: Element | null }).portalAtSwap === document.querySelector('[data-friend-portal]'))).toBe(true);
});

test('friend portal loads from the home card without replacing its artwork', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    document.addEventListener('astro:after-swap', () => {
      (window as Window & { portalAtSwap?: Element | null }).portalAtSwap = document.querySelector('[data-friend-portal]');
    }, { once: true });
  });
  await page.locator('a[href="/friends/"]').first().click();
  await expect(page).toHaveURL(/\/friends\/$/);
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(await page.evaluate(() => (window as Window & { portalAtSwap?: Element | null }).portalAtSwap === document.querySelector('[data-friend-portal]'))).toBe(true);
  await expect.poll(() => page.locator('.portal-frame').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
  await expect.poll(() => page.locator('.portal-vortex').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
});

test('friend portal keeps its size after leaving and entering again', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();

  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('a[href="/friends/"]').first().click();
    await expect(page).toHaveURL(/\/friends\/$/);
    await expect(page.locator('#page-loader')).toBeHidden();
    await expect.poll(() => page.locator('.portal-stage').evaluate((stage) => stage.getBoundingClientRect().width)).toBeGreaterThan(400);
    await expect.poll(() => page.locator('.portal-frame').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1254);
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#page-loader')).toBeHidden();
  }
});

test('friend portal page does not scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('overflow-y', 'hidden');
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('friend portal opens at one second while the keyboard key stays down', async ({ page, context }) => {
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await context.route('https://**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Friend</title>' }));
  const portal = page.locator('[data-friend-portal]');
  await portal.focus();
  await page.keyboard.down('Space');
  const popupPromise = context.waitForEvent('page');
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/^https:\/\//);
  await page.bringToFront();
  await expect(portal).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('[data-progress-value]')).toHaveText('0%');
  await page.keyboard.up('Space');
});

test('friend portal keeps the one second hold without an animated meter in reduced motion', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await context.route('https://**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Friend</title>' }));
  const portal = page.locator('[data-friend-portal]');
  await portal.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  await expect(portal).toHaveAttribute('data-state', 'charging');
  await expect(page.locator('[data-progress-value]')).toHaveText('0%');
  await page.keyboard.up('Space');
  await expect(portal).toHaveAttribute('data-state', 'idle');
  const popupPromise = context.waitForEvent('page');
  await page.keyboard.down('Space');
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/^https:\/\//);
  await page.bringToFront();
  await page.keyboard.up('Space');
});

test('friend portal visits every destination once per shuffled round without a boundary repeat', async ({ page, context }) => {
  await page.addInitScript(() => { Math.random = () => 0.999_999; });
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await context.route('https://**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Friend</title>' }));
  const portal = page.locator('[data-friend-portal]');
  const destinations = JSON.parse((await portal.getAttribute('data-destinations')) ?? '[]') as string[];
  const visited: string[] = [];

  for (let turn = 0; turn <= destinations.length; turn += 1) {
    await portal.focus();
    const popupPromise = context.waitForEvent('page');
    await page.keyboard.down('Space');
    const popup = await popupPromise;
    await popup.waitForURL(/^https:\/\//);
    visited.push(popup.url());
    await page.bringToFront();
    await page.keyboard.up('Space');
    await popup.close();
  }

  expect(new Set(visited.slice(0, destinations.length)).size).toBe(destinations.length);
  expect(visited[destinations.length]).not.toBe(visited[destinations.length - 1]);
});

test('friend portal shows its blue outline on hover', async ({ page }) => {
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const portal = page.locator('[data-friend-portal]');
  const outline = portal.locator('.portal-hover-ring');
  await expect(outline).toHaveCSS('opacity', '0');
  await portal.hover();
  await expect(outline).toHaveCSS('opacity', '1');
  await page.mouse.move(0, 0);
  await expect(outline).toHaveCSS('opacity', '0');
});

test('friend portal removes listeners left by an earlier page script', async ({ page }) => {
  await page.goto('/friends/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const portal = page.locator('[data-friend-portal]');
  await portal.evaluate((element) => {
    element.addEventListener('pointerdown', () => {
      element.setAttribute('data-legacy-fired', 'true');
      window.setTimeout(() => window.location.assign('/about/'), 1500);
    });
  });

  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  await portal.click();
  await expect(portal).not.toHaveAttribute('data-legacy-fired', 'true');
  await page.waitForTimeout(1700);
  await expect(page).toHaveURL(/\/friends\/$/);
});

test('compact content surfaces begin below desktop navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const surface of compactContentSurfaces) {
    await page.goto(surface.path);
    const headerBottom = await page.locator('header.site-header').evaluate((element) => element.getBoundingClientRect().bottom);
    const surfaceBox = await page.locator(surface.selector).first().boundingBox();

    expect(surfaceBox, `${surface.path} ${surface.selector}`).not.toBeNull();
    expect(surfaceBox!.y - headerBottom, `${surface.path} ${surface.selector}`).toBeGreaterThanOrEqual(8);
    expect(surfaceBox!.y - headerBottom, `${surface.path} ${surface.selector}`).toBeLessThanOrEqual(24);
  }
});

test('guestbook mounts Twikoo on its own pathname', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { twikoo: { init: (options: { el: string; path: string }) => Promise<void> } }).twikoo = {
      init: async ({ el, path }) => {
        const mount = document.querySelector(el);
        mount?.closest('[data-twikoo-comments]')?.setAttribute('data-mock-path', path);
        const button = document.createElement('button');
        button.className = 'tk-button';
        button.textContent = '提交';
        const textarea = document.createElement('textarea');
        textarea.className = 'tk-textarea__inner';
        mount?.append(button, textarea);
      }
    };
  });
  await page.route('https://comments.hatrix.site/**', (route) => route.abort());
  const response = await page.goto('/guestbook/');

  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toHaveClass(/guestbook-page/);
  const shell = page.locator('[data-guestbook-shell]');
  await expect(shell).toBeVisible();
  await expect(shell).toHaveCSS('animation-name', 'guestbook-float');
  const desktopShellBox = await shell.boundingBox();
  expect(desktopShellBox).not.toBeNull();
  expect(desktopShellBox!.y).toBeGreaterThan(60);
  expect(desktopShellBox!.y + desktopShellBox!.height).toBeLessThan(882);
  await expect(shell).toHaveAccessibleName('留言板');
  await expect(shell.getByText('GitHub Discussions', { exact: true })).toHaveCount(0);
  await expect(shell.locator('.guestbook-serial, .guestbook-header, .guestbook-board-heading')).toHaveCount(0);
  await expect(shell).toHaveCSS('border-image-source', /terminal-frame\.png/);
  const screen = shell.locator('[data-guestbook-scroll]');
  await expect(screen).toHaveCSS('overflow-y', 'auto');
  await expect(screen).toHaveCSS('scrollbar-width', 'none');
  const comments = page.locator('[data-twikoo-comments]');
  await expect(comments).toHaveAccessibleName('评论');
  await expect(comments).toHaveAttribute('data-twikoo-path', '/guestbook/');
  await expect(comments).toHaveAttribute('data-twikoo-env-id', 'https://comments.hatrix.site');
  await expect(comments).toHaveAttribute('data-mock-path', '/guestbook/');
  await expect(comments.locator('iframe')).toHaveCount(0);
  await expect(comments.locator('.tk-button')).toHaveCSS('cursor', /link\.cur/);
  await expect(comments.locator('.tk-textarea__inner')).toHaveCSS('cursor', /text\.cur/);
  const overlay = await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
  expect(overlay).toContain('rgba(23, 21, 29');
  await expect(page.getByRole('link', { name: '首页', exact: true })).toHaveCSS('color', 'rgb(233, 228, 220)');

  await page.setViewportSize({ width: 390, height: 844 });
  const backButtonBox = await page.getByRole('link', { name: '返回主页' }).boundingBox();
  const mobileShellBox = await shell.boundingBox();
  expect(backButtonBox).not.toBeNull();
  expect(mobileShellBox).not.toBeNull();
  expect(mobileShellBox!.y - (backButtonBox!.y + backButtonBox!.height)).toBeGreaterThanOrEqual(12);
  expect(mobileShellBox!.y + mobileShellBox!.height).toBeLessThan(828);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
  await screen.evaluate((element) => {
    const extraComments = document.createElement('div');
    extraComments.style.height = '1000px';
    element.firstElementChild?.append(extraComments);
  });
  await expect(page.locator('#page-loader')).toBeHidden();
  const screenBox = await screen.boundingBox();
  expect(screenBox).not.toBeNull();
  await page.mouse.move(screenBox!.x + screenBox!.width / 2, screenBox!.y + screenBox!.height / 2);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(shell).toHaveCSS('animation-name', 'none');
});

test('Twikoo runtime styles survive client navigation to guestbook and an article', async ({ page }) => {
  await page.addInitScript(() => {
    const global = window as typeof window & {
      twikoo: { init: (options: { el: string }) => Promise<void> };
      __twikooStyleInjected?: boolean;
    };
    global.twikoo = {
      init: async ({ el }) => {
        if (!global.__twikooStyleInjected) {
          const style = document.createElement('style');
          style.setAttribute('data-twikoo', '');
          style.textContent = '.tk-avatar { width: 40px; height: 40px; }';
          document.head.append(style);
          global.__twikooStyleInjected = true;
        }
        const avatar = document.createElement('span');
        avatar.className = 'tk-avatar';
        const comments = document.createElement('div');
        comments.className = 'tk-comments';
        comments.append(avatar);
        document.querySelector(el)?.replaceChildren(comments);
      }
    };
  });

  const avatar = page.locator('[data-twikoo-comments] .tk-avatar');
  await page.goto('/guestbook/');
  await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'ready');
  await expect(avatar).toHaveCSS('width', '40px');

  await page.locator('[data-back-button]').click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('a[href="/guestbook/"]').first().click();
  await page.waitForURL('**/guestbook/');
  await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'ready');
  await expect(avatar).toHaveCSS('width', '40px');
  await expect(page.locator('style[data-twikoo]')).toHaveCount(1);

  await page.locator('.desktop-nav a[href="/blogs/"]').click();
  await page.waitForURL('**/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('[data-post-card][data-active="true"] h2 a').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname.startsWith('/posts/'));
  await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'ready');
  await expect(avatar).toHaveCSS('width', '40px');
  await expect(page.locator('style[data-twikoo]')).toHaveCount(1);
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
  for (const path of ['/about/', '/toolbox/']) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack], [data-profile-card]')).toHaveCount(0);
    const main = page.locator('main.container');
    const content = path === '/toolbox/'
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

test('contextual sidebar cards remain readable in the dark theme', async ({ page }) => {
  await page.goto('/about/');

  await expect(page.locator('.about-main article h1')).toHaveCSS('color', 'rgb(245, 240, 232)');
  await expect(page.locator('[data-profile-card]')).toHaveCount(0);
  await page.goto('/about/hobbies/');
  await expect(page.locator('[data-profile-card] h2')).toHaveCSS('color', 'rgb(245, 240, 232)');
  await expect(page.locator('[data-profile-card]').getByText('轻松即单纯，速成即精准')).toHaveCSS('color', 'rgb(185, 176, 194)');
  await expect(page.locator('[data-site-stats]')).toHaveCount(0);
});

test('the player dock reveals half a record and keeps its record action independent from collapse', async ({ page }) => {
  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  const toggle = player.locator('[data-player-toggle]');
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  const record = await player.locator('[data-turntable-record]').boundingBox();
  const card = await player.boundingBox();
  expect(record).not.toBeNull();
  expect(card).not.toBeNull();
  expect(record!.x).toBeLessThan(0);
  const exposedWidth = Math.min(record!.x + record!.width, card!.x + card!.width) - Math.max(record!.x, 0);
  expect(exposedWidth).toBeGreaterThan(45);
  expect(exposedWidth).toBeLessThanOrEqual(80);
  await toggle.click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.locator('[data-player-record]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await expect(player.locator('[data-player-track]')).toHaveText(`${playlist[0].title}-${playlist[0].artist}`);
  await player.click({ position: { x: 12, y: 12 } });
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await player.locator('[data-player-record]').focus();
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
