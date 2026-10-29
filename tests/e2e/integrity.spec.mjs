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
    const invalidRead = store.importJson('{"politicians":[],"alerts":[{"id":"a","text":"Teste","read":"sim"}]}');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('Sem espaço'); };
    let failedWrite = false;
    try { store.set({ theme: 'dark' }); } catch { failedWrite = true; }
    Storage.prototype.setItem = setItem;
    return { exportedVersion, previewVersion: preview.version, futureVersion, wrongShape, unsafeUrl, invalidRead, failedWrite, unchanged: store.exportJson() === original };
  });
  expect(outcome).toEqual({ exportedVersion: 1, previewVersion: 1, futureVersion: false, wrongShape: false, unsafeUrl: false, invalidRead: false, failedWrite: true, unchanged: true });
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

test('leitura dos alertas persiste e atualiza o indicador do cabeçalho', async ({ page }) => {
  await seed(page, { politicians: [], alerts: [
    { id: 'antigo', ts: '2026-01-01', kind: 'plenario', text: 'Registro antigo' },
    { id: 'lido', ts: '2026-01-02', kind: 'votacao', text: 'Registro já lido', read: true },
  ] });
  await go(page, 'alertas');
  await expect(page.locator('#header-alerts')).toHaveAttribute('aria-label', 'Alertas, 1 não lido');
  await page.locator('[data-alert-read="antigo"]').click();
  await expect(page.locator('#header-alerts')).toHaveAttribute('aria-label', 'Alertas, 0 não lidos');
  await expect(page.locator('#header-unread-dot')).toBeHidden();
  await page.reload();
  await expect(page.locator('[data-alert-read="antigo"]')).toContainText('Marcar como não lido');
  await page.locator('[data-alert-read="lido"]').click();
  await expect(page.locator('#header-alerts')).toHaveAttribute('aria-label', 'Alertas, 1 não lido');
  await page.locator('#mark-all-read').click();
  await expect(page.locator('#header-alerts')).toHaveAttribute('aria-label', 'Alertas, 0 não lidos');
  await page.evaluate(async () => {
    const { store } = await import('/src/store.js');
    store.addAlerts([{ id: 'novo', ts: '2026-01-03', kind: 'plenario', text: 'Novo registro' }]);
  });
  await expect(page.locator('#header-alerts')).toHaveAttribute('aria-label', 'Alertas, 1 não lido');
  const backedUp = await page.evaluate(async () => {
    const { store } = await import('/src/store.js');
    const json = store.exportJson();
    return store.importJson(json) && JSON.parse(json).alerts.filter((a) => a.read !== true).length === 1;
  });
  expect(backedUp).toBe(true);
});
