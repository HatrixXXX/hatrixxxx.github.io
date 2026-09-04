import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { PROTECTED_CONTENT, PROTECTED_VERIFIER_AAD } from '../../src/config/protected-content';
import {
  deriveContentKeyBytes,
  encryptEnvelope,
  importContentKey,
  type EncryptedEnvelope
} from '../../src/lib/protected-content/crypto';
import { utf8 } from '../../src/lib/protected-content/encoding';

const TEST_KEY = 'test-admin';
const MANIFEST_URL = '**/protected-content/manifest.json';
const ASSET_URL = '**/protected-content/assets/test-image.bin';
const FIRST_PAGE = '/__tests__/protected/';
const SECOND_PAGE = '/__tests__/remembered/';

interface ProtectedFixtures {
  manifest: Record<string, unknown>;
  asset: EncryptedEnvelope;
}

interface EndpointOptions {
  manifest?: 'valid' | 'corrupt-verifier' | 'tampered-kdf' | 'network-error';
  asset?: 'valid' | 'corrupt' | 'network-error';
  manifestDelayMs?: number;
}

let fixturePromise: Promise<ProtectedFixtures> | undefined;

function protectedFixtures(): Promise<ProtectedFixtures> {
  fixturePromise ??= (async () => {
    const keyBytes = await deriveContentKeyBytes(TEST_KEY);
    const key = await importContentKey(keyBytes, ['encrypt']);
    const verifier = await encryptEnvelope(
      utf8('hatrix-protected-content'),
      key,
      PROTECTED_VERIFIER_AAD
    );
    const image = await readFile(resolve('tests/fixtures/protected-content/private-image.png'));
    const asset = await encryptEnvelope(image, key, 'asset:test-image');

    return {
      manifest: {
        version: PROTECTED_CONTENT.formatVersion,
        salt: PROTECTED_CONTENT.saltBase64,
        argon2: PROTECTED_CONTENT.argon2,
        rememberForMs: PROTECTED_CONTENT.rememberForMs,
        routes: [FIRST_PAGE, SECOND_PAGE],
        verifier
      },
      asset
    };
  })();
  return fixturePromise;
}

async function mockProtectedEndpoints(page: Page, options: EndpointOptions = {}): Promise<void> {
  const fixtures = await protectedFixtures();
  await page.route(MANIFEST_URL, async (route) => {
    if (options.manifest === 'network-error') {
      await route.abort('failed');
      return;
    }
    if (options.manifestDelayMs) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, options.manifestDelayMs));
    }
    const manifest = structuredClone(fixtures.manifest);
    if (options.manifest === 'corrupt-verifier') {
      (manifest.verifier as EncryptedEnvelope).ciphertext = '***';
    }
    if (options.manifest === 'tampered-kdf') {
      (manifest.argon2 as Record<string, unknown>).memorySizeKiB =
        PROTECTED_CONTENT.argon2.memorySizeKiB + 1;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(manifest)
    });
  });
  await page.route(ASSET_URL, async (route) => {
    if (options.asset === 'network-error') {
      await route.abort('failed');
      return;
    }
    const envelope = options.asset === 'corrupt'
      ? { ...fixtures.asset, ciphertext: 'corrupt' }
      : fixtures.asset;
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: JSON.stringify(envelope)
    });
  });
  await page.route('https://giscus.app/**', (route) => route.abort());
}

async function injectSecondProtectedGate(page: Page): Promise<void> {
  await page.route(`**${FIRST_PAGE}`, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const secondGate = `
      <section data-protected-gate data-protected-route="${FIRST_PAGE}">
        <form data-unlock-form>
          <label>管理员 key 2<input name="key" type="password"></label>
          <label><input name="showKey" type="checkbox">显示 key 2</label>
          <label><input name="remember" type="checkbox">7 天免解锁 2</label>
          <button type="submit">解锁 2</button>
          <p aria-live="polite" data-unlock-status></p>
        </form>
        <script type="application/json" data-protected-envelope>{}</script>
        <div data-protected-mount></div>
      </section>`;
    await route.fulfill({ response, body: body.replace('</body>', `${secondGate}</body>`) });
  });
}

async function submitKey(page: Page, key: string, remember = false): Promise<void> {
  await page.getByLabel('管理员 key', { exact: true }).fill(key);
  if (remember) await page.getByLabel('7 天免解锁').check();
  await page.getByRole('button', { name: '解锁' }).click();
}

async function storedCredentialDetails(page: Page) {
  return page.evaluate(async () => {
    const records = await new Promise<Array<{ key?: CryptoKey; version?: number }>>((resolveRecords, reject) => {
      const open = indexedDB.open('hatrix-protected-content');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const transaction = open.result.transaction('credentials', 'readonly');
        const request = transaction.objectStore('credentials').getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolveRecords(request.result);
      };
    });
    const key = records[0]?.key;
    return {
      session: sessionStorage.getItem('hatrix-admin-session'),
      remembered: localStorage.getItem('hatrix-admin-remembered'),
      count: records.length,
      keyIsCryptoKey: key instanceof CryptoKey,
      keyExtractable: key?.extractable,
      keyUsages: key ? [...key.usages] : []
    };
  });
}

test('guest sees the complete gate and empty input has its own accessible error', async ({ page }) => {
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);

  await expect(page.locator('[data-protected-gate]')).toBeVisible();
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '退出管理员身份' })).toBeHidden();

  const input = page.getByLabel('管理员 key', { exact: true });
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toBeFocused();
  await page.getByRole('button', { name: '解锁' }).click();
  await expect(page.locator('[data-unlock-status]')).toHaveText('请输入管理员 key');
  await expect(input).toBeFocused();
});

test('multiple protected gates fail closed instead of sharing singleton state', async ({ page }) => {
  await injectSecondProtectedGate(page);
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);

  await expect(page.locator('[data-protected-gate]')).toHaveCount(2);
  const forms = page.locator('[data-unlock-form]');
  await expect(forms.locator('input, button')).toHaveCount(8);
  for (const control of await forms.locator('input, button').all()) {
    await expect(control).toBeDisabled();
  }
  await expect(forms.locator('[data-unlock-status]')).toHaveText([
    '加密内容无法读取，请稍后再试',
    '加密内容无法读取，请稍后再试'
  ]);
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
});

test('loading, wrong key, and the persisted third-failure cooldown are distinct', async ({ page }) => {
  await mockProtectedEndpoints(page, { manifestDelayMs: 250 });
  await page.goto(FIRST_PAGE);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await submitKey(page, 'wrong-key');
    await expect(page.locator('[data-unlock-status]')).toHaveText('正在验证…');
    await expect(page.locator('[data-unlock-status]')).toHaveText('Key 不正确，请重试');
  }

  await submitKey(page, 'wrong-key');
  await expect(page.locator('[data-unlock-status]')).toContainText(/请等待 [1-5] 秒后重试/);
  await expect(page.getByLabel('管理员 key', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('显示 key')).toBeDisabled();
  await expect(page.getByLabel('7 天免解锁')).toBeDisabled();
  await page.reload();
  await expect(page.locator('[data-unlock-status]')).toContainText(/请等待 [1-5] 秒后重试/);
  await expect(page.getByRole('button', { name: '解锁' })).toBeDisabled();
  await expect(page.getByLabel('显示 key')).toBeDisabled();
  await expect(page.getByLabel('7 天免解锁')).toBeDisabled();
  await expect(page.getByLabel('管理员 key', { exact: true })).toBeEnabled({ timeout: 7_000 });
  await expect(page.getByRole('button', { name: '解锁' })).toBeEnabled();
  await expect(page.getByLabel('显示 key')).toBeEnabled();
  await expect(page.getByLabel('7 天免解锁')).toBeEnabled();
});

test('network and corrupt ciphertext failures use separate messages', async ({ page }) => {
  await mockProtectedEndpoints(page, { manifest: 'network-error' });
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);
  await expect(page.locator('[data-unlock-status]')).toHaveText(
    '加密内容加载失败，请检查网络后重试'
  );

  await page.unrouteAll({ behavior: 'wait' });
  await mockProtectedEndpoints(page, { asset: 'corrupt' });
  await page.reload();
  await submitKey(page, TEST_KEY);
  await expect(page.locator('[data-unlock-status]')).toHaveText(
    '加密内容无法读取，请稍后再试'
  );
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
});

test('a structurally corrupt verifier reports corruption without adding cooldown', async ({ page }) => {
  await mockProtectedEndpoints(page, { manifest: 'corrupt-verifier' });
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);

  await expect(page.locator('[data-unlock-status]')).toHaveText(
    '加密内容无法读取，请稍后再试'
  );
  expect(await page.evaluate(() => localStorage.getItem('hatrix-admin-cooldown'))).toBeNull();
});

test('a tampered KDF manifest is rejected before Argon2 without adding cooldown', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { compileCount: 0 };
    (window as unknown as { __argon2Probe: typeof state }).__argon2Probe = state;
    const compile = WebAssembly.compile.bind(WebAssembly);
    WebAssembly.compile = async (bytes: BufferSource) => {
      state.compileCount += 1;
      return compile(bytes);
    };
  });
  await mockProtectedEndpoints(page, { manifest: 'tampered-kdf' });
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);

  await expect(page.locator('[data-unlock-status]')).toHaveText(
    '加密内容无法读取，请稍后再试'
  );
  expect(await page.evaluate(() => localStorage.getItem('hatrix-admin-cooldown'))).toBeNull();
  expect(await page.evaluate(() => (
    window as unknown as { __argon2Probe: { compileCount: number } }
  ).__argon2Probe.compileCount)).toBe(0);

  await page.unrouteAll({ behavior: 'wait' });
  await mockProtectedEndpoints(page);
  await page.reload();
  await submitKey(page, TEST_KEY);
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();
  expect(await page.evaluate(() => (
    window as unknown as { __argon2Probe: { compileCount: number } }
  ).__argon2Probe.compileCount)).toBeGreaterThan(0);
});

test('a public page without credential state does not request the protected runtime', async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/src/scripts/protected-content.ts')) runtimeRequests.push(pathname);
  });

  await page.goto('/');

  expect(runtimeRequests).toEqual([]);
});

test('a failed protected runtime import is retried on the next Astro page load', async ({ page }) => {
  let runtimeRequests = 0;
  let allowRuntime = false;
  await page.route('**/src/scripts/protected-content.ts', async (route) => {
    runtimeRequests += 1;
    if (!allowRuntime) await route.abort('failed');
    else await route.continue();
  });
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await expect.poll(() => runtimeRequests).toBeGreaterThan(0);
  await expect(page.locator('[data-unlock-status]')).toHaveText(
    '加密内容加载失败，请检查网络后重试'
  );
  await expect(page.getByRole('button', { name: '解锁' })).toBeDisabled();
  await page.waitForTimeout(250);
  const failedRequests = runtimeRequests;
  allowRuntime = true;

  await page.evaluate((path) => {
    history.pushState({}, '', path);
    document.dispatchEvent(new Event('astro:page-load'));
  }, SECOND_PAGE);

  await expect.poll(() => runtimeRequests).toBeGreaterThan(failedRequests);
  await expect(page.getByLabel('管理员 key', { exact: true })).toBeFocused();
});

test('a page transition during credential persistence revokes prepared Blob URLs', async ({ page }) => {
  await page.addInitScript(() => {
    const lifecycle = { created: [] as string[], revoked: [] as string[] };
    (window as unknown as { __blobLifecycle: typeof lifecycle }).__blobLifecycle = lifecycle;
    const createObjectUrl = URL.createObjectURL.bind(URL);
    const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      const url = createObjectUrl(blob);
      lifecycle.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      lifecycle.revoked.push(url);
      revokeObjectUrl(url);
    };

    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      setItem.call(this, key, value);
      if (key === 'hatrix-admin-session') {
        document.dispatchEvent(new Event('astro:before-swap'));
      }
    };
  });
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);

  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __blobLifecycle: { created: string[] } }
  ).__blobLifecycle.created.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const lifecycle = (
      window as unknown as { __blobLifecycle: { created: string[]; revoked: string[] } }
    ).__blobLifecycle;
    return lifecycle.revoked.includes(lifecycle.created[0]);
  })).toBe(true);
});

test('session unlock restores assets and integrations across navigation and refresh', async ({ page }) => {
  await mockProtectedEndpoints(page, { manifestDelayMs: 250 });
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);

  await expect(page.locator('[data-unlock-status]')).toHaveText('正在验证…');
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();
  const image = page.getByRole('button', { name: '查看大图：解锁后的测试图片' });
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect(image).toHaveAttribute('alt', '解锁后的测试图片');
  await expect(image).toHaveAttribute('title', '受保护图片标题');
  await expect(image).not.toHaveAttribute('data-protected-src');
  await expect(page.locator('[data-toc-link="protected-heading"]')).toHaveAttribute(
    'aria-current',
    'location'
  );
  await expect(page.locator('.mermaid svg')).toHaveCount(1);
  await expect(page.locator('[data-giscus-comments] script[src="https://giscus.app/client.js"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '退出管理员身份' })).toBeVisible();

  const oldBlobUrl = await image.getAttribute('src');
  const stored = await storedCredentialDetails(page);
  expect(stored.session).not.toBeNull();
  expect(stored.remembered).toBeNull();
  expect(`${stored.session}${stored.remembered}`).not.toContain(TEST_KEY);
  expect(stored.count).toBe(1);
  expect(stored.keyIsCryptoKey).toBe(true);
  expect(stored.keyExtractable).toBe(false);
  expect(stored.keyUsages).toEqual(['decrypt']);
  await expect(page.getByLabel('管理员 key', { exact: true })).toHaveValue('');

  await page.locator('[data-test-next]').click();
  await expect(page.getByText('protected-e2e-secret-remembered')).toBeVisible();
  expect(await page.evaluate((url) => fetch(url!).then(() => true, () => false), oldBlobUrl)).toBe(false);

  await page.reload();
  await expect(page.getByText('protected-e2e-secret-remembered')).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('hatrix:protected-content-ready'));
    document.dispatchEvent(new CustomEvent('hatrix:protected-content-ready'));
  });
  await expect(page.locator('.mermaid svg')).toHaveCount(1);
  await expect(page.locator('[data-giscus-comments] script[src="https://giscus.app/client.js"]')).toHaveCount(1);

  await page.goto('/');
  await expect(page.locator('[data-protected-gate]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '退出管理员身份' })).toBeVisible();
});

test('unlock snapshots remember mode and restores every control after loading', async ({ page }) => {
  await mockProtectedEndpoints(page, { manifestDelayMs: 400 });
  await page.goto(FIRST_PAGE);

  const key = page.getByLabel('管理员 key', { exact: true });
  const showKey = page.getByLabel('显示 key');
  const remember = page.getByLabel('7 天免解锁');
  const submit = page.getByRole('button', { name: '解锁' });
  await key.fill(TEST_KEY);
  await submit.click();
  await expect(page.locator('[data-unlock-status]')).toHaveText('正在验证…');
  const loadingDisabled = await Promise.all([
    key.isDisabled(),
    showKey.isDisabled(),
    remember.isDisabled(),
    submit.isDisabled()
  ]);

  await remember.evaluate((checkbox: HTMLInputElement) => {
    checkbox.checked = true;
  });
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();

  const stored = await storedCredentialDetails(page);
  expect(stored.session).not.toBeNull();
  expect(stored.remembered).toBeNull();
  expect(loadingDisabled).toEqual([true, true, true, true]);

  await page.getByRole('button', { name: '退出管理员身份' }).click();
  await expect(key).toBeEnabled();
  await expect(showKey).toBeEnabled();
  await expect(remember).toBeEnabled();
  await expect(submit).toBeEnabled();
});

test('remembered unlock crosses pages and an expired reference returns to guest', async ({ page }) => {
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY, true);
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();

  let stored = await storedCredentialDetails(page);
  expect(stored.session).toBeNull();
  expect(stored.remembered).not.toBeNull();

  await page.goto(SECOND_PAGE);
  await expect(page.getByText('protected-e2e-secret-remembered')).toBeVisible();
  await page.evaluate(() => {
    const raw = localStorage.getItem('hatrix-admin-remembered');
    if (!raw) throw new Error('missing remembered credential');
    const reference = JSON.parse(raw);
    reference.expiresAt = Date.now() - 1;
    localStorage.setItem('hatrix-admin-remembered', JSON.stringify(reference));
  });
  await page.reload();

  await expect(page.locator('[data-protected-gate]')).toBeVisible();
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
  await expect(page.getByLabel('管理员 key', { exact: true })).toBeFocused();
  stored = await storedCredentialDetails(page);
  expect(stored.remembered).toBeNull();
  expect(stored.count).toBe(0);
});

test('a version-mismatched reference is cleared and restores a usable guest gate', async ({ page }) => {
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();

  await page.evaluate(() => {
    const raw = sessionStorage.getItem('hatrix-admin-session');
    if (!raw) throw new Error('missing session credential');
    const reference = JSON.parse(raw);
    reference.version += 1;
    sessionStorage.setItem('hatrix-admin-session', JSON.stringify(reference));
  });
  await page.reload();

  const input = page.getByLabel('管理员 key', { exact: true });
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.locator('[data-unlock-status]')).toHaveText('');
  const stored = await storedCredentialDetails(page);
  expect(stored.session).toBeNull();
  expect(stored.count).toBe(0);
});

test('a stored key that fails verifier decryption is cleared and restores guest', async ({ page }) => {
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY);
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();

  await page.evaluate(async () => {
    const raw = sessionStorage.getItem('hatrix-admin-session');
    if (!raw) throw new Error('missing session credential');
    const reference = JSON.parse(raw);
    const wrongKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32),
      'AES-GCM',
      false,
      ['decrypt']
    );
    await new Promise<void>((resolveWrite, reject) => {
      const open = indexedDB.open('hatrix-protected-content');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const transaction = open.result.transaction('credentials', 'readwrite');
        transaction.objectStore('credentials').put({
          id: reference.id,
          version: reference.version,
          key: wrongKey
        });
        transaction.oncomplete = () => resolveWrite();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload();

  const input = page.getByLabel('管理员 key', { exact: true });
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.locator('[data-unlock-status]')).toHaveText('');
  const stored = await storedCredentialDetails(page);
  expect(stored.session).toBeNull();
  expect(stored.count).toBe(0);
});

test('logout clears both modes, revokes assets, and re-locks the current page', async ({ page }) => {
  await mockProtectedEndpoints(page);
  await page.goto(FIRST_PAGE);
  await submitKey(page, TEST_KEY, true);
  await expect(page.getByText('protected-e2e-secret-protected')).toBeVisible();

  const blobUrl = await page.locator('article img').getAttribute('src');
  await page.evaluate(() => {
    const remembered = localStorage.getItem('hatrix-admin-remembered');
    if (remembered) sessionStorage.setItem('hatrix-admin-session', remembered);
  });
  await page.getByRole('button', { name: '退出管理员身份' }).click();

  await expect(page.locator('[data-unlock-form]')).toBeVisible();
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '退出管理员身份' })).toBeHidden();
  await expect.poll(async () => (await storedCredentialDetails(page)).count).toBe(0);
  const stored = await storedCredentialDetails(page);
  expect(stored.session).toBeNull();
  expect(stored.remembered).toBeNull();
  expect(await page.evaluate((url) => fetch(url!).then(() => true, () => false), blobUrl)).toBe(false);
});

test('without JavaScript the response contains only the gate and ciphertext', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required');
  const context = await (browser as Browser).newContext({
    baseURL,
    javaScriptEnabled: false
  });
  const page = await context.newPage();
  const response = await page.goto(FIRST_PAGE);

  expect(await response?.text()).not.toContain('protected-e2e-secret-protected');
  await expect(page.locator('[data-protected-gate]')).toBeVisible();
  await expect(page.locator('[data-protected-envelope]')).toHaveCount(1);
  await expect(page.locator('[data-protected-test-content]')).toHaveCount(0);
  await context.close();
});
