// Contratos da prefeitura no PNCP (src/contas.js), sem rede: o fetch é trocado por uma função falsa.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recentContracts, stateBodies, toContract } from '../../src/contas.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../../src/data/${f}`, import.meta.url), 'utf8'));
const entes = read('entes.json');
const { cidades } = read('cidades.json');
const cnpjs = read('cnpjs.json');

const raw = (n, date, extra = {}) => ({
  numeroControlePNCP: `46523171000104-2-${String(n).padStart(6, '0')}/2026`,
  dataPublicacaoPncp: `${date}T10:00:00`,
  objetoContrato: ` Obra ${n} `,
  nomeRazaoSocialFornecedor: `EMPRESA ${n}`,
  valorGlobal: n * 1000,
  tipoContrato: { nome: 'Contrato' },
  orgaoEntidade: { cnpj: '46523171000104' },
  anoContrato: 2026,
  sequencialContrato: n,
  emendaParlamentar: null,
  ...extra,
});

let real;
let urls;
beforeEach(() => { real = globalThis.fetch; urls = []; });
afterEach(() => { globalThis.fetch = real; });
const respond = (pages) => async (url) => {
  urls.push(url);
  const page = Number(new URL(url).searchParams.get('pagina'));
  return { ok: true, status: 200, json: async () => ({ data: pages[page - 1] ?? [], totalRegistros: pages.flat().length, totalPaginas: pages.length }) };
};

test('contrato do PNCP vira o resumo da tela, com link e marca de emenda', () => {
  const c = toContract(raw(7, '2026-10-01', { emendaParlamentar: { numero: 1 } }));
  assert.deepEqual(c, { id: '46523171000104-2-000007/2026', date: '2026-10-01', object: 'Obra 7', supplier: 'EMPRESA 7', value: 7000, kind: 'Contrato', emenda: true, url: 'https://pncp.gov.br/app/contratos/46523171000104/2026/7' });
  assert.equal(toContract(raw(1, '2026-10-01', { valorGlobal: null })).value, null);
});

test('normaliza o tamanho de página aceito pelo PNCP', async () => {
  globalThis.fetch = respond([[raw(1, '2026-10-01')]]);
  await recentContracts('44444444000144', { size: 1, now: new Date('2026-10-15T12:00:00Z') });
  assert.equal(new URL(urls[0]).searchParams.get('tamanhoPagina'), '10');
});

test('lê da última página para trás e separa os maiores contratos dos mais recentes', async () => {
  globalThis.fetch = respond([[raw(1, '2026-09-20'), raw(9, '2026-09-21')], [raw(3, '2026-09-30'), raw(4, '2026-10-02'), raw(5, '2026-10-01')]]);
  const r = await recentContracts('46523171000104', { keep: 2, size: 50, now: new Date('2026-10-15T12:00:00Z') });
  assert.equal(r.total, 5);
  assert.equal(r.partial, false);
  assert.equal(r.sum, (1 + 9 + 3 + 4 + 5) * 1000);
  assert.deepEqual(r.biggest.map((c) => c.value), [9000, 5000]);
  assert.deepEqual(r.items.map((c) => c.date), ['2026-10-02', '2026-10-01']);
  assert.deepEqual(urls.map((u) => new URL(u).searchParams.get('pagina')).sort(), ['1', '2']);
  const q = new URL(urls[0]).searchParams;
  assert.equal(q.get('dataInicial'), '20260915');
  assert.equal(q.get('dataFinal'), '20261015');
  assert.equal(q.get('cnpjOrgao'), '46523171000104');
});

test('com mais de 500 contratos lê só as 10 últimas páginas e avisa que é parcial; sem contratos devolve vazio', async () => {
  const pages = Array.from({ length: 12 }, (_, i) => [raw(i + 1, `2026-10-${String(i + 1).padStart(2, '0')}`)]);
  globalThis.fetch = respond(pages);
  const r = await recentContracts('11111111000111', { now: new Date('2026-10-15T12:00:00Z') });
  assert.equal(r.total, 12);
  assert.equal(r.partial, true);
  assert.equal(urls.length, 11, 'a primeira página e as 10 últimas (a primeira não é lida de novo se estiver entre elas)');
  globalThis.fetch = respond([]);
  const none = await recentContracts('22222222000122', { now: new Date('2026-10-15T12:00:00Z') });
  assert.deepEqual(none, { days: 30, total: 0, partial: false, sum: 0, biggest: [], items: [] });
});

test('falha do PNCP tenta de novo uma vez e depois avisa', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
  await assert.rejects(recentContracts('33333333000133'), /PNCP respondeu 503/);
  assert.equal(calls, 2);
});

test('cnpjs.json cobre as 78 prefeituras e as prefeituras das contas levam o CNPJ (câmaras e governos, não)', () => {
  assert.equal(Object.keys(cnpjs).length, 78);
  for (const c of cidades) assert.match(cnpjs[c.ibge], /^\d{14}$/, c.nome);
  const sp = stateBodies('SP', entes, cidades, cnpjs);
  assert.deepEqual(sp.filter((b) => b.cnpj).map((b) => b.key), ['pref-SP', 'pref-3534401', 'pref-3518800']);
  assert.equal(sp.find((b) => b.key === 'pref-SP').cnpj, cnpjs[3550308]);
  assert.ok(sp.filter((b) => /^(gov|al|cm)/.test(b.key)).every((b) => !b.cnpj));
  assert.ok(stateBodies('SP', entes, cidades).every((b) => !b.cnpj), 'sem o catálogo de CNPJs, nenhum órgão mostra contratos');
});
