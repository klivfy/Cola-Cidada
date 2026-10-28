import { test, expect } from './fixtures.mjs';

// Este fluxo usa o Service Worker real; os demais testes o bloqueiam para
// manter as verificações de tela determinísticas.
test.use({ serviceWorkers: 'allow' });

test('app shell abre sem rede depois de ser instalado', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker indisponível');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => caches.keys().then((keys) => keys.some((k) => k.startsWith('monitor-cidadao-'))))).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('Painel público');
  await expect(page.locator('body')).toContainText('Presidência');
});
