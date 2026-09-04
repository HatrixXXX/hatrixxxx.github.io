import { expect, test } from '@playwright/test';

test('home and shared Header use the exact responsive typography', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const desktop = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector<HTMLElement>('[data-home-title]')!).fontSize,
    subtitle: getComputedStyle(document.querySelector<HTMLElement>('.home-subtitle')!).fontSize,
    navigation: getComputedStyle(
      document.querySelector<HTMLElement>('.desktop-nav > ul > li > a')!
    ).fontSize,
    headerFont: getComputedStyle(
      document.querySelector<HTMLElement>('[data-site-header]')!
    ).fontFamily
  }));
  expect(desktop).toEqual({
    title: '42.75px',
    subtitle: '25.8px',
    navigation: '15.21px',
    headerFont: expect.stringMatching(/^['"]?IBM Plex Mono['"]?/)
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector<HTMLElement>('[data-home-title]')!).fontSize,
    subtitle: getComputedStyle(document.querySelector<HTMLElement>('.home-subtitle')!).fontSize
  }));
  expect(mobile).toEqual({ title: '27.75px', subtitle: '17.25px' });

  await page.goto('/projects/');
  await page.evaluate(() => document.fonts.ready);
  const ordinaryHeaderFont = await page
    .locator('[data-site-header]')
    .evaluate((header) => getComputedStyle(header).fontFamily);
  expect(ordinaryHeaderFont).toMatch(/^['"]?IBM Plex Mono['"]?/);
});

test('home renders only the fullscreen cover experience', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-stage]')).toBeVisible();
  await expect(page.locator('[data-home-title]')).toHaveText('Hatrixの窝');
  await expect(page.locator('.home-subtitle')).toHaveAttribute(
    'aria-label',
    '轻松即单纯，速成即精准'
  );
  await expect(page.locator('[data-home-typing]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-home-typing-cursor]')).toHaveText('|');
  await expect(page.locator('header[data-site-header] [data-home-blog-link]')).toHaveCount(2);
  const blogArrow = page.locator(
    '[data-home-stage] [data-home-blog-arrow][data-home-blog-link]'
  );
  await expect(blogArrow).toHaveCount(1);
  await expect(blogArrow).toHaveAttribute('href', '/blog/');
  await expect(page.locator('.brand, .home-blog-entry, footer[data-site-footer]')).toHaveCount(0);
  await expect(page.locator('[data-sakana-layer], [data-cursor-trail]')).toHaveCount(0);
  await expect(page.locator('article[data-post-card], .pagination')).toHaveCount(0);
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);
  const background = await page.locator('[data-home-stage]').evaluate(
    (node) => getComputedStyle(node).backgroundImage
  );
  expect(background).toContain('/images/cover.png');
  const fontFamily = await page.locator('[data-home-stage]').evaluate(
    (node) => getComputedStyle(node).fontFamily
  );
  expect(fontFamily).toMatch(/^['"]?IBM Plex Mono['"]?/);
  expect((await page.request.get('/images/cover.png')).status()).toBe(200);
});

test('home types the tagline with a bar cursor', async ({ page }) => {
  await page.goto('/');
  const typing = page.locator('[data-home-typing]');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'typing');
  await expect.poll(() => typing.textContent()).toContain('轻');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'complete');
});

test('home arrow prefetches and reveals the blog', async ({ page }) => {
  const blogRequests: string[] = [];
  const clientRouterMarker = crypto.randomUUID();
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/blog/') blogRequests.push(request.url());
  });
  await page.goto('/');
  await page.evaluate((marker) => {
    (window as typeof window & { __homeClientRouterMarker?: string }).__homeClientRouterMarker =
      marker;
  }, clientRouterMarker);
  await expect.poll(() => blogRequests.length).toBeGreaterThan(0);
  await page.locator('[data-home-blog-arrow]').click({ noWaitAfter: true });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const animations = document.getAnimations();
        return {
          uncover: animations
            .filter(
              (animation) =>
                animation instanceof CSSAnimation &&
                animation.animationName === 'home-uncover-left'
            )
            .map((animation) => ({
              animationName: (animation as CSSAnimation).animationName,
              pseudoElement: (animation.effect as KeyframeEffect | null)?.pseudoElement ?? null
            })),
          newRoot: animations.filter(
            (animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement ===
              '::view-transition-new(root)'
          ).length
        };
      })
    )
    .toEqual({
      uncover: [
        {
          animationName: 'home-uncover-left',
          pseudoElement: '::view-transition-old(root)'
        }
      ],
      newRoot: 0
    });
  await page.waitForURL('**/blog/');
  await expect(page).toHaveURL('/blog/');
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __homeClientRouterMarker?: string })
          .__homeClientRouterMarker
    )
  ).toBe(clientRouterMarker);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        reveal: document.documentElement.hasAttribute('data-home-reveal'),
        distance: document.documentElement.style.getPropertyValue('--home-reveal-distance'),
        duration: document.documentElement.style.getPropertyValue('--home-reveal-duration')
      }))
    )
    .toEqual({ reveal: false, distance: '', duration: '' });

  await page.goBack();
  await page.waitForURL((url) => url.pathname === '/');
  const typing = page.locator('[data-home-typing]');
  await expect(typing).toHaveAttribute('data-home-typing-state', /^(typing|complete)$/);
  await expect.poll(() => typing.textContent()).toContain('轻');
  await expect(page.locator('[data-home-stage]')).toHaveAttribute('data-home-drag-state', 'idle');

  const mutationTimes = await typing.evaluate(
    (node) =>
      new Promise<number[]>((resolve) => {
        const startedAt = performance.now();
        const times: number[] = [];
        const observer = new MutationObserver(() => times.push(performance.now() - startedAt));
        observer.observe(node, { childList: true });
        window.setTimeout(() => {
          observer.disconnect();
          resolve(times);
        }, 520);
      })
  );
  expect(mutationTimes.length).toBeGreaterThanOrEqual(2);
  expect(mutationTimes.every((time, index) => index === 0 || time - mutationTimes[index - 1] > 100))
    .toBe(true);
});

test('home owns blog prefetch timing at idle and interactive entry points', async ({ browser }) => {
  for (const trigger of ['idle', 'pointerenter', 'focus', 'drag'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const state = window as typeof window & { __homeIdleCallbacks?: IdleRequestCallback[] };
      state.__homeIdleCallbacks = [];
      window.requestIdleCallback = (callback: IdleRequestCallback) => {
        state.__homeIdleCallbacks?.push(callback);
        return state.__homeIdleCallbacks?.length ?? 1;
      };
      window.cancelIdleCallback = () => undefined;
    });
    await page.goto('/');
    await expect(page.locator('[data-home-blog-link][data-astro-prefetch]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __homeIdleCallbacks?: IdleRequestCallback[] })
              .__homeIdleCallbacks?.length ?? 0
        )
      )
      .toBeGreaterThan(0);
    await expect(page.locator('link[rel="prefetch"][href="/blog/"]')).toHaveCount(0);

    if (trigger === 'idle') {
      await page.evaluate(() => {
        const state = window as typeof window & { __homeIdleCallbacks?: IdleRequestCallback[] };
        for (const callback of state.__homeIdleCallbacks ?? []) {
          callback({ didTimeout: false, timeRemaining: () => 50 });
        }
      });
    } else if (trigger === 'pointerenter') {
      await page.locator('[data-home-blog-arrow]').dispatchEvent('pointerenter');
    } else if (trigger === 'focus') {
      await page.locator('[data-home-blog-arrow]').focus();
    } else {
      const stage = page.locator('[data-home-stage]');
      const box = await stage.boundingBox();
      if (!box) throw new Error('Missing home stage bounds');
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.65);
      await page.mouse.down();
    }

    await expect(page.locator('link[rel="prefetch"][href="/blog/"]')).toHaveCount(1);
    if (trigger === 'drag') await page.mouse.up();
    await context.close();
  }
});

test('home desktop Blog link uses the shared reveal navigation', async ({ page }) => {
  const clientRouterMarker = crypto.randomUUID();
  await page.goto('/');
  await page.evaluate((marker) => {
    (window as typeof window & { __homeHeaderMarker?: string }).__homeHeaderMarker = marker;
  }, clientRouterMarker);

  const blogLink = page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '博客文章', exact: true });
  await expect(blogLink).toBeVisible();
  await blogLink.click({ noWaitAfter: true });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSAnimation && animation.animationName === 'home-uncover-left'
          )
      )
    )
    .toBe(true);
  await page.waitForURL('**/blog/');
  await expect(page).toHaveURL('/blog/');
  expect(
    await page.evaluate(
      () => (window as typeof window & { __homeHeaderMarker?: string }).__homeHeaderMarker
    )
  ).toBe(clientRouterMarker);
});

test('repeated ordinary clicks keep one marked reveal navigation', async ({ page }) => {
  await page.route('**/blog/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  const marker = crypto.randomUUID();
  await page.goto('/');
  await page.evaluate((value) => {
    const state = window as typeof window & { __repeatClickMarker?: string };
    state.__repeatClickMarker = value;
    sessionStorage.setItem('__blogPreparations', '[]');
    sessionStorage.removeItem('__homeUncoverSeen');
    document.addEventListener('astro:before-preparation', (event) => {
      if (event.to.pathname === '/blog/') {
        const preparations = JSON.parse(
          sessionStorage.getItem('__blogPreparations') ?? '[]'
        ) as Array<{ kind: unknown }>;
        preparations.push({ kind: event.info?.kind ?? null });
        sessionStorage.setItem('__blogPreparations', JSON.stringify(preparations));
      }
    });
    document.addEventListener('astro:after-swap', () => {
      requestAnimationFrame(() => {
        const seen = document
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSAnimation && animation.animationName === 'home-uncover-left'
          );
        sessionStorage.setItem('__homeUncoverSeen', String(seen));
      });
    });
  }, marker);

  await page.locator('[data-home-blog-arrow]').evaluate((link) => {
    const click = () =>
      link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window })
      );
    click();
    click();
  });

  await page.waitForURL('**/blog/');
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('__blogPreparations') ?? '[]') as unknown[]
    )
  ).toEqual([{ kind: 'home-reveal' }]);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __repeatClickMarker?: string }).__repeatClickMarker
    )
  ).toBe(marker);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('__homeUncoverSeen')))
    .toBe('true');
  await expect
    .poll(() =>
      page.evaluate(() => ({
        reveal: document.documentElement.hasAttribute('data-home-reveal'),
        distance: document.documentElement.style.getPropertyValue('--home-reveal-distance'),
        duration: document.documentElement.style.getPropertyValue('--home-reveal-duration')
      }))
    )
    .toEqual({ reveal: false, distance: '', duration: '' });
});

test('a competing route cannot inherit or revive the pending blog reveal', async ({ page }) => {
  await page.route('**/blog/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => {
    document.addEventListener(
      'astro:before-swap',
      (event) => {
        if (event.to.pathname !== '/projects/') return;
        const root = event.newDocument.documentElement;
        (
          window as typeof window & {
            __competingSwap?: { reveal: string | null; distance: string; duration: string };
          }
        ).__competingSwap = {
          reveal: root.getAttribute('data-home-reveal'),
          distance: root.style.getPropertyValue('--home-reveal-distance'),
          duration: root.style.getPropertyValue('--home-reveal-duration')
        };
      },
      { once: true }
    );
  });

  await page.evaluate(() => {
    const click = (selector: string) => {
      const link = document.querySelector<HTMLElement>(selector);
      if (!link) throw new Error(`Missing ${selector}`);
      link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window })
      );
    };
    click('[data-home-blog-arrow]');
    click('.desktop-nav a[href="/projects/"]');
  });

  await page.waitForURL('**/projects/');
  await expect(page).toHaveURL('/projects/');
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __competingSwap?: { reveal: string | null; distance: string; duration: string };
          }
        ).__competingSwap
    )
  ).toEqual({ reveal: null, distance: '', duration: '' });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        reveal: document.documentElement.hasAttribute('data-home-reveal'),
        distance: document.documentElement.style.getPropertyValue('--home-reveal-distance'),
        duration: document.documentElement.style.getPropertyValue('--home-reveal-duration'),
        uncover: document
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSAnimation && animation.animationName === 'home-uncover-left'
          )
      }))
    )
    .toEqual({ reveal: false, distance: '', duration: '', uncover: false });
});

test('home drag snaps back below threshold and navigates above it', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    const progress = step / 4;
    await page.mouse.move(box.width * (0.75 - 0.07 * progress), box.height * 0.55);
    await page.waitForTimeout(45);
  }
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.width * 0.5, box.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForURL('**/blog/');
});

test('home fast flick navigates below the distance threshold', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height * 0.65;
  const distance = 80;
  expect(distance).toBeGreaterThanOrEqual(48);
  expect(distance).toBeLessThan(box.width * 0.16);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(12);
  await page.mouse.move(startX - distance, y);
  await page.mouse.up();
  await page.waitForURL('**/blog/');
});

test('home ignores a mismatched pointer release until the active pointer ends', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.addEventListener(
      'pointerdown',
      (event) => {
        (window as typeof window & { __homePointerId?: number }).__homePointerId = event.pointerId;
      },
      { capture: true, once: true }
    );
  });
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height * 0.65;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 24, y);

  await page.evaluate(() => {
    document.documentElement.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerId: 999 })
    );
  });

  await expect(stage).toHaveAttribute('data-home-drag-state', 'dragging');
  expect(
    await page.evaluate(() => {
      const root = document.documentElement;
      const activePointer = (window as typeof window & { __homePointerId?: number }).__homePointerId;
      return activePointer === undefined ? false : root.hasPointerCapture(activePointer);
    })
  ).toBe(true);
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
});

test('home rejects a stale flick velocity after a 900ms pause', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height * 0.65;
  const distance = 80;
  expect(distance).toBeGreaterThanOrEqual(48);
  expect(distance).toBeLessThan(box.width * 0.16);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(12);
  await page.mouse.move(startX - distance, y);
  await page.waitForTimeout(900);
  await page.mouse.up();

  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
});

test('a committed 20 percent drag always reveals for 620ms', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.addEventListener(
      'astro:before-swap',
      (event) => {
        (window as typeof window & { __homeRevealDuration?: string }).__homeRevealDuration =
          event.newDocument.documentElement.style.getPropertyValue('--home-reveal-duration');
      },
      { once: true }
    );
  });
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height * 0.65;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - box.width * 0.2, y, { steps: 4 });
  await page.mouse.up();

  await page.waitForURL('**/blog/');
  expect(
    await page.evaluate(
      () => (window as typeof window & { __homeRevealDuration?: string }).__homeRevealDuration
    )
  ).toBe('620ms');
});

test('home cancels a vertical-dominant drag without leaving residue', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  const startX = box.x + box.width * 0.75;
  const startY = box.y + box.height * 0.65;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 24, startY + 120, { steps: 4 });
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--home-drag-x')
    )
  ).toBe('');
});

test('home releases active drags on pointer cancel and window blur', async ({ page }) => {
  for (const cancellation of ['pointercancel', 'blur'] as const) {
    await page.goto('/');
    await page.evaluate(() => {
      document.addEventListener(
        'pointerdown',
        (event) => {
          (window as typeof window & { __homePointerId?: number }).__homePointerId =
            event.pointerId;
        },
        { capture: true, once: true }
      );
    });
    const stage = page.locator('[data-home-stage]');
    const box = await stage.boundingBox();
    if (!box) throw new Error('Missing home stage bounds');
    const startX = box.x + box.width * 0.75;
    const y = box.y + box.height * 0.65;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 80, y, { steps: 3 });

    if (cancellation === 'pointercancel') {
      await page.evaluate(() => {
        const pointerId = (window as typeof window & { __homePointerId?: number }).__homePointerId;
        document.documentElement.dispatchEvent(
          new PointerEvent('pointercancel', {
            bubbles: true,
            isPrimary: true,
            pointerId
          })
        );
      });
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    }
    await page.mouse.up();

    await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
    const residue = await page.evaluate(() => {
      const root = document.documentElement;
      const pointerId = (window as typeof window & { __homePointerId?: number }).__homePointerId;
      return {
        capture: pointerId === undefined ? null : root.hasPointerCapture(pointerId),
        dragX: root.style.getPropertyValue('--home-drag-x')
      };
    });
    expect(residue).toEqual({ capture: false, dragX: '' });
    await expect(page).toHaveURL('/');
  }
});

test('home controls do not start the drag gesture', async ({ page }) => {
  await page.goto('/');
  const theme = page.locator('[data-theme-toggle]');
  const box = await theme.boundingBox();
  if (!box) throw new Error('Missing theme control bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 180, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-home-stage]')).toHaveAttribute('data-home-drag-state', 'idle');
});

test('home respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-home-typing]')).toHaveText('轻松即单纯，速成即精准');
  const animations = await page.locator('[data-home-blog-arrow]').evaluate((node) => ({
    arrow: getComputedStyle(node.querySelector('svg')!).animationName,
    cursor: getComputedStyle(document.querySelector('[data-home-typing-cursor]')!).animationName
  }));
  expect(animations).toEqual({ arrow: 'none', cursor: 'none' });
});

test('pagination and legacy post paths stay available', async ({ page }) => {
  const missingFirstPage = await page.request.get('/page/1/');
  expect(missingFirstPage.status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);

  await page.goto('/page/7/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(4);

  await page.goto('/page/3/');
  const spacedSlugLink = page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first();
  await expect(spacedSlugLink).toBeVisible();
  const resolvedPath = await spacedSlugLink.evaluate(
    (link) => new URL((link as HTMLAnchorElement).href).pathname
  );
  expect(resolvedPath).toBe(encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/'));
});

test('site footer stays compact on paginated pages', async ({ page }) => {
  await page.goto('/page/2/');
  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toBeVisible();
  await expect(footer.locator('section, img, li')).toHaveCount(0);
  const bounds = await footer.boundingBox();
  expect(bounds?.height).toBeLessThan(64);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1152, height: 720 },
  { width: 960, height: 600 },
  { width: 720, height: 450 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 }
]) {
  test(`home cannot scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
    await page.evaluate(() => window.scrollTo(0, 9999));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('home and paginated routes omit contextual sidebar cards', async ({ page }) => {
  for (const path of ['/', '/page/2/']) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack], [data-music-player]')).toHaveCount(0);
  }
});
