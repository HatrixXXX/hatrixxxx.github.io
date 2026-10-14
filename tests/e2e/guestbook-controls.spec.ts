import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    (window as typeof window & {
      twikoo: { init: (options: { el: string }) => Promise<void> };
    }).twikoo = {
      init: async ({ el }) => {
        const mount = document.querySelector(el);
        if (!mount) return;
        mount.innerHTML = `
          <div class="tk-comments">
            <div class="tk-submit"></div>
            <div class="tk-comments-container">
              <div class="tk-comments-title"><span class="tk-comments-actions">
                <span class="tk-icon __comments" data-mock-action="search"><svg></svg></span>
                <span class="tk-icon __comments" data-mock-action="refresh"><svg></svg></span>
                <span class="tk-icon __comments" data-mock-action="settings"><svg></svg></span>
              </span></div>
              <div class="tk-comment"><div class="tk-main"><div class="tk-row">
                <span class="tk-nick">访客</span><div class="tk-action">
                  <button class="tk-action-link" type="button">赞</button>
                  <button class="tk-action-link" type="button">回复</button>
                </div>
              </div><div class="tk-content">留言内容</div></div></div>
            </div>
            <div class="tk-admin-container"><div class="tk-admin"><button class="tk-admin-close" type="button">关闭</button></div></div>
          </div>`;
        const actions = mount.querySelector('.tk-comments-actions')!;
        actions.querySelector('[data-mock-action="refresh"]')!.addEventListener('click', () => {
          actions.setAttribute('data-mock-loading', '');
          actions.querySelector('[data-mock-action="search"]')?.remove();
          actions.querySelector('[data-mock-action="refresh"]')?.remove();
          window.setTimeout(() => {
            const settings = actions.querySelector('[data-mock-action="settings"]')!;
            const search = document.createElement('span');
            search.className = 'tk-icon __comments';
            search.dataset.mockAction = 'search';
            search.innerHTML = '<svg></svg>';
            const refresh = document.createElement('span');
            refresh.className = 'tk-icon __comments';
            refresh.dataset.mockAction = 'refresh';
            refresh.innerHTML = '<svg></svg>';
            actions.insertBefore(search, settings);
            actions.insertBefore(refresh, settings);
            actions.removeAttribute('data-mock-loading');
          }, 1200);
        });
        const admin = mount.querySelector('.tk-admin')!;
        actions.querySelector('[data-mock-action="settings"]')!.addEventListener('click', () => admin.classList.add('__show'));
        mount.querySelector('.tk-admin-close')!.addEventListener('click', () => admin.classList.remove('__show'));
      }
    };
  });
  await page.goto('/guestbook/');
  await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'ready');
});

test('search and refresh stay visible while Twikoo refreshes its list', async ({ page }) => {
  const actions = page.locator('.tk-comments-actions');
  await actions.getByRole('button', { name: '刷新评论' }).click();
  await expect(actions).toHaveAttribute('data-mock-loading', '');
  await expect(actions.getByRole('button', { name: '搜索评论' })).toBeVisible({ timeout: 400 });
  await expect(actions.getByRole('button', { name: '刷新评论' })).toBeVisible({ timeout: 400 });
  await page.waitForTimeout(350);
  await expect(actions.getByRole('button', { name: '搜索评论' })).toBeVisible({ timeout: 400 });
  await expect(actions.getByRole('button', { name: '刷新评论' })).toBeVisible({ timeout: 400 });
  await expect(actions.locator('[data-mock-action="search"]')).toHaveCount(1);
  await expect(actions.locator('[data-mock-action="refresh"]')).toHaveCount(1);
  await expect(actions).not.toHaveAttribute('data-mock-loading', '');
  await expect(actions.locator('[data-twikoo-loading-control]')).toHaveCount(0);
  await expect(actions.getByRole('button', { name: '刷新评论' })).toBeEnabled();
});

test('opening settings hides and disables the three comment controls until close', async ({ page }) => {
  const actions = page.locator('.tk-comments-actions');
  await actions.getByRole('button', { name: '设置' }).click();
  await expect(page.locator('.tk-admin')).toHaveClass(/__show/);
  await expect(actions).toBeHidden();
  await expect(actions).toHaveAttribute('inert', '');
  await page.locator('.tk-admin-close').click();
  await expect(actions).toBeVisible();
  await expect(actions).not.toHaveAttribute('inert', '');
});

test('settings returns keyboard focus when its panel closes', async ({ page }) => {
  const settings = page.locator('.tk-comments-actions').getByRole('button', { name: '设置' });
  await settings.focus();
  await settings.press('Enter');
  const close = page.locator('.tk-admin-close');
  await expect(close).toBeFocused();
  await close.press('Enter');
  await expect(settings).toBeFocused();
});

test('comment body receives magnetic frame while nested action keeps its own frame', async ({ page }) => {
  const comment = page.locator('.tk-comment');
  const frame = page.locator('body > [data-magnetic-frame]');
  await comment.locator('.tk-content').hover();
  await expect(frame).toHaveAttribute('data-active', '');
  await expect(comment).toHaveCSS('cursor', /link\.cur/);
  const cardWidth = await comment.evaluate((element) => element.getBoundingClientRect().width);
  await expect.poll(() => frame.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(cardWidth);

  const action = comment.getByRole('button', { name: '点赞' });
  await action.hover();
  await expect.poll(() => frame.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(cardWidth / 2);
  await expect(action).toHaveAttribute('aria-label', '点赞');
});
