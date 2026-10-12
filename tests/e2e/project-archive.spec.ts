import { expect, test } from '@playwright/test';

const titles = [
  'FPGA-3DGS渲染',
  'CoNet在线笔记',
  'RoboMaster步兵',
  'DreamChaser战队周边',
  '实验室文化墙'
];

test('project atlas opens one complete dossier and returns focus to its card', async ({ page }) => {
  await page.goto('/projects/');
  const cards = page.locator('[data-project-card]');
  await expect(cards).toHaveCount(5);
  for (const [index, title] of titles.entries()) {
    await expect(cards.nth(index)).toContainText(title);
  }

  const card = cards.first().getByRole('button', { name: /FPGA-3DGS/ });
  await card.focus();
  await page.keyboard.press('Enter');
  const dossier = page.getByRole('dialog', { name: /FPGA-3DGS/ });
  await expect(dossier).toBeVisible();
  await expect(dossier).toContainText('制作经历');
  await expect(dossier).toContainText('过程趣事');
  await expect(dossier).toContainText('照片待补充');
  await page.keyboard.press('Escape');
  await expect(dossier).not.toBeVisible();
  await expect(card).toBeFocused();
});

test('project dossier stays usable on a narrow screen with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects/');
  await page.locator('[data-project-card]').last().getByRole('button').click();
  const dossier = page.getByRole('dialog', { name: /实验室文化墙/ });
  await expect(dossier).toBeVisible();
  await expect(dossier.getByRole('button', { name: '关闭档案' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await dossier.getByRole('button', { name: '关闭档案' }).click();
  await expect(dossier).not.toBeVisible();
});
