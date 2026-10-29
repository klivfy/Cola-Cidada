// Alertas sem rede: as consultas são trocadas por funções falsas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectAlerts, prefOn, unreadCount } from '../../src/alerts.js';

test('só alertas não lidos entram no indicador; registros antigos começam não lidos', () => {
  assert.equal(unreadCount([{ id: 'antigo' }, { id: 'lido', read: true }, { id: 'novo', read: false }]), 2);
});

const camara = async (pols) => [
  { id: 'v1', data: '2026-09-02', descricao: 'Aprovado o PL do saneamento.', byPol: Object.fromEntries(pols.filter((p) => p.camaraId).map((p) => [p.id, 'Sim'])) },
];
const senado = async (pols) => [
  { key: 7, date: '2026-09-01', matter: 'PEC 1/2026', round: '2º turno', summary: 'Dispõe sobre a saúde.', result: 'Aprovado', yes: 60, no: 10, secret: false, bySenator: Object.fromEntries(pols.filter((p) => p.senadoId).map((p) => [p.id, 'Não'])) },
];
const expenses = async () => [
  { value: 7200.5, type: 'Divulgação', supplier: 'Gráfica X', date: '2026-08-20', docNumber: '99', receiptUrl: 'https://exemplo/nota.pdf' },
  { value: 120, type: 'Combustível', supplier: 'Posto', date: '2026-08-21', docNumber: '100' },
];
const bills = async () => [{ id: 55, type: 'PL', number: 10, year: 2026, summary: 'Cria o programa Y.', date: '2026-08-15', url: 'https://exemplo/pl' }];
const recent = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const ceaps = async (id) => ({
  grandes: [
    { id: 1, data: recent(10), valor: 9100, tipo: 'Divulgação da atividade parlamentar', fornecedor: 'Gráfica Y' },
    { id: 2, data: recent(200), valor: 8000, tipo: 'Aluguel', fornecedor: 'Imobiliária Z' }, // fora da janela de 90 dias
    { id: 3, data: recent(5), valor: 4000, tipo: 'Combustível', fornecedor: 'Posto' }, // abaixo do limite
  ].map((e) => ({ ...e, id: `${id}-${e.id}` })),
});
const deps = { camara, senado, expenses, bills, ceaps };
const DEP = { id: 'camara-1', camaraId: 1, name: 'Dep. A', party: 'PT', uf: 'SP' };
const SEN = { id: 'senado-2', senadoId: '2', name: 'Sen. B', party: 'PL', uf: 'RJ' };

test('sem acompanhar ninguém, só chegam as votações do Plenário (Câmara e Senado)', async () => {
  const { alerts, failures } = await collectAlerts({ politicians: [], prefs: {} }, deps);
  assert.deepEqual(failures, []);
  assert.deepEqual(alerts.map((a) => a.kind), ['plenario', 'plenario']);
  assert.match(alerts.find((a) => a.id === 'plen-senado:7').text, /PEC 1\/2026 \(2º turno\): Aprovado \(Sim 60, Não 10\)/);
});

test('acompanhando, chegam votos, gastos acima do limite e projetos, mais recentes primeiro', async () => {
  const { alerts } = await collectAlerts({ politicians: [DEP, SEN], prefs: {} }, deps);
  const kinds = alerts.map((a) => a.kind);
  assert.equal(kinds.filter((k) => k === 'votacao').length, 2);
  assert.equal(kinds.filter((k) => k === 'gasto').length, 2, 'a nota de R$ 120 fica de fora; entra a despesa grande do senador');
  assert.equal(kinds.filter((k) => k === 'proposicao').length, 1);
  assert.equal(alerts.find((a) => a.kind === 'gasto' && a.politicianId === DEP.id).url, 'https://exemplo/nota.pdf');
  const sen = alerts.filter((a) => a.kind === 'gasto' && a.politicianId === SEN.id);
  assert.equal(sen.length, 1, 'só a despesa grande e recente');
  assert.match(sen[0].text, /Sen\. B \(PL\/RJ\) usou R\$\s9\.100,00 da cota parlamentar .* Gráfica Y/);
  assert.equal(sen[0].id, 'ceaps:2:2-1');
  assert.deepEqual([...alerts.map((a) => a.ts)], [...alerts.map((a) => a.ts)].sort().reverse());
});

test('preferências desligadas não geram alertas; ausente conta como ligada', async () => {
  const prefs = { plenario: false, rollcall: false, expenses: false, bills: false };
  const { alerts } = await collectAlerts({ politicians: [DEP, SEN], prefs }, deps);
  assert.deepEqual(alerts, []);
  assert.equal(prefOn({}, 'plenario'), true);
});

test('uma fonte fora do ar vira aviso, e o resto continua', async () => {
  const { alerts, failures } = await collectAlerts({ politicians: [DEP], prefs: {} }, { ...deps, senado: async () => { throw new Error('fora'); } });
  assert.deepEqual(failures, ['Senado']);
  assert.ok(alerts.some((a) => a.id === 'plen-camara:v1'));
});
