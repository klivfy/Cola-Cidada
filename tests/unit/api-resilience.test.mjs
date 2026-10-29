import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { allStateDeputies, searchDeputies, clearLiveCache } from '../../src/api.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearLiveCache();
});

test('falha de arquivo regional não vira lista vazia e pode ser tentada novamente', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => [{ id: 'x', name: 'Maria' }] };
  };
  await assert.rejects(allStateDeputies('RR'), /Falha ao carregar/);
  assert.deepEqual(await allStateDeputies('RR'), [{ id: 'x', name: 'Maria' }]);
  assert.equal(calls, 2);
});

test('consultas simultâneas compartilham a requisição e atualizar ignora cache anterior', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ dados: [{ id: calls, nome: 'Maria', siglaPartido: 'ABC', siglaUf: 'SP' }] }) };
  };
  const [first, same] = await Promise.all([searchDeputies('Maria'), searchDeputies('Maria')]);
  assert.deepEqual(first, same);
  assert.equal(calls, 1);
  assert.deepEqual(await searchDeputies('Maria'), first);
  assert.equal(calls, 1);
  clearLiveCache();
  assert.equal((await searchDeputies('Maria'))[0].camaraId, 2);
  assert.equal(calls, 2);
});
