import { test, expect, seed, go } from './fixtures.mjs';

test('o acompanhamento não atribui despesas sem dados oficiais', async ({ page }) => {
  await page.route('https://dadosabertos.camara.leg.br/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"dados":[]}' }));
  await page.route('https://legis.senado.leg.br/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await seed(page);
  await page.reload();
  await go(page, 'inicio');
  await expect(page.locator('#feed')).toContainText('Sem votações nominais recentes');
  await expect(page.locator('#feed')).not.toContainText('Reembolso de Verba');
  await expect(page.locator('#feed-filters')).not.toContainText('Auditorias CEAP');
});

test('falha das fontes aparece como indisponibilidade e oferece nova tentativa', async ({ page }) => {
  await page.route('https://dadosabertos.camara.leg.br/**', (route) => route.fulfill({ status: 503, body: 'indisponível' }));
  await page.route('https://legis.senado.leg.br/**', (route) => route.fulfill({ status: 503, body: 'indisponível' }));
  await seed(page);
  await page.reload();
  await go(page, 'inicio');
  await expect(page.locator('#feed')).toContainText('Não foi possível consultar', { timeout: 30_000 });
  await expect(page.locator('#feed')).toContainText('Tentar de novo');
  await expect(page.locator('#feed')).not.toContainText('Sem votações nominais recentes');
  await expect(page.locator('#agenda-list')).toContainText('Não foi possível carregar a agenda');
  await expect(page.locator('#agenda-list')).toContainText('Tentar de novo');
});

test('backup inválido e falha de gravação preservam os dados atuais', async ({ page }) => {
  await seed(page);
  await go(page, 'perfil');
  const outcome = await page.evaluate(async () => {
    const { store } = await import('/src/store.js');
    const original = store.exportJson();
    const exportedVersion = JSON.parse(original).schemaVersion;
    const preview = store.previewImport(original);
    const futureVersion = store.importJson('{"schemaVersion":999,"politicians":[]}');
    const wrongShape = store.importJson('{"politicians":[],"alerts":42,"prefs":null}');
    const unsafeUrl = store.importJson('{"politicians":[{"id":"a","name":"Teste","pageUrl":"javascript:alert(1)"}]}');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('Sem espaço'); };
    let failedWrite = false;
    try { store.set({ theme: 'dark' }); } catch { failedWrite = true; }
    Storage.prototype.setItem = setItem;
    return { exportedVersion, previewVersion: preview.version, futureVersion, wrongShape, unsafeUrl, failedWrite, unchanged: store.exportJson() === original };
  });
  expect(outcome).toEqual({ exportedVersion: 1, previewVersion: 1, futureVersion: false, wrongShape: false, unsafeUrl: false, failedWrite: true, unchanged: true });
});

test('falha ao carregar assembleia aparece como erro e a nova tentativa recupera a lista', async ({ page }) => {
  let attempts = 0;
  await page.route('**/src/data/states/sp.json', (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, body: 'indisponível' }) : route.continue();
  });
  await go(page, 'painel');
  await page.locator('[data-section="assembleias"]').click();
  await expect(page.locator('#painel-results')).toContainText('Não foi possível carregar');
  await expect(page.locator('#painel-results')).not.toContainText('Nenhuma pessoa encontrada');
  await page.locator('#painel-retry').click();
  await expect(page.locator('#painel-results .painel-card').first()).toBeVisible();
  expect(attempts).toBe(2);
});
