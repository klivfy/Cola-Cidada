// Testes de lógica pura (sem navegador): física de interface, mandatos e orientação de bancada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, rubberband, velocityFrom } from '../../src/motion.js';
import { defaultMandate, mandateProgress, esc, initials, photoUrl } from '../../src/ui.js';
import { safeUrl } from '../../src/urls.js';
import { parseBloc, orientationFor } from '../../src/plenary.js';

test('projeção de inércia: parado não anda, lançamento rápido vai longe', () => {
  assert.equal(project(0), 0);
  assert.ok(project(1000) > 400 && project(1000) < 600);
  assert.ok(project(-1000) < 0);
});

test('rubber-band resiste cada vez mais e nunca passa da dimensão', () => {
  const a = rubberband(100, 800), b = rubberband(400, 800);
  assert.ok(a < 100 && b < 400 && b > a);
  assert.ok(rubberband(1e6, 800) < 800);
});

test('velocidade usa só as amostras dos últimos 100 ms', () => {
  const v = velocityFrom([{ v: 0, t: 0 }, { v: 0, t: 500 }, { v: 50, t: 550 }, { v: 100, t: 600 }]);
  assert.equal(Math.round(v), 1000);
  assert.equal(velocityFrom([{ v: 10, t: 0 }]), 0);
  // quadro lento (>100 ms entre as duas últimas amostras): mantém a velocidade em vez de zerar
  assert.equal(Math.round(velocityFrom([{ v: 0, t: 0 }, { v: 40, t: 108 }])), 370);
});

test('mandato estadual: SP começa em 15/03, demais em 01/02; todos terminam em 31/01/2027', () => {
  assert.deepEqual(defaultMandate('dep-estadual', 'SP'), ['2023-03-15', '2027-01-31']);
  assert.deepEqual(defaultMandate('dep-estadual', 'mg'), ['2023-02-01', '2027-01-31']);
  assert.deepEqual(defaultMandate('vereador'), ['2025-01-01', '2028-12-31']);
});

test('cadastro antigo com a data da ALESP é recalculado pela UF', () => {
  const legacy = { roleKey: 'dep-estadual', uf: 'BA', mandate: ['2023-03-15', '2027-03-14'] };
  assert.equal(mandateProgress(legacy).end, new Date('2027-01-31').toLocaleDateString('pt-BR'));
  const custom = { roleKey: 'governador', mandate: ['2023-01-01', '2026-12-31'] };
  assert.equal(mandateProgress(custom).end, new Date('2026-12-31').toLocaleDateString('pt-BR'));
});

test('esc neutraliza HTML', () => {
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('blocos: abreviação da Câmara e partidos de federações', () => {
  const bloc = parseBloc({ name: 'UNIÃO, PP, PSD, REPUBLICANOS, MDB, Federação PSDB CIDADANIA, PODE', federation: false });
  assert.ok(bloc.abbr.startsWith('unipppsd'));
  assert.ok(bloc.parties.includes('psdb') && bloc.parties.includes('cidadania'));
});

test('orientação: partido próprio > federação > bloco; liberado e vazio', () => {
  const blocs = [parseBloc({ name: 'UNIÃO, PP, PSD, REPUBLICANOS', federation: false })];
  const orient = [
    { codTipoLideranca: 'P', siglaPartidoBloco: 'PL', orientacaoVoto: 'Liberado' },
    { codTipoLideranca: 'P', siglaPartidoBloco: 'PSD', orientacaoVoto: '' },
    { codTipoLideranca: 'B', siglaPartidoBloco: 'Fdr PT-PCdoB-PV', orientacaoVoto: 'Sim' },
    { codTipoLideranca: 'B', siglaPartidoBloco: 'Bl UniPpPsd...', orientacaoVoto: 'Não' },
  ];
  assert.equal(orientationFor('PL', orient, blocs), 'Liberado');
  assert.equal(orientationFor('PCdoB', orient, blocs), 'Sim');
  assert.equal(orientationFor('PSD', orient, blocs), 'Não');
  assert.equal(orientationFor('NOVO', orient, blocs), null);
});

test('summarizeProposition só devolve dados oficiais e aceita apenas links da Câmara/Senado', async () => {
  const { summarizeProposition } = await import('../../src/analysis.js');
  const ok = summarizeProposition({ type: 'PL', number: 1, year: 2024, summary: 'Dispõe sobre saneamento.', date: '2024-03-01', url: 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=1' });
  assert.ok(ok.url.startsWith('https://www.camara.leg.br/'));
  assert.equal(ok.date, '2024-03-01');
  for (const k of ['practicalEffect', 'financialEffect', 'winnersAndLosers']) assert.equal(k in ok, false, `${k} voltou`);
  assert.equal(summarizeProposition({ summary: 'x', url: 'javascript:alert(1)' }).url, '');
  assert.equal(summarizeProposition({ summary: 'x', url: 'https://evil.example/camara.leg.br/' }).url, '');
});

test('ministro do STF não tem mandato: o cartão mostra cargo vitalício em vez de barra', () => {
  const m = mandateProgress({ roleKey: 'ministro-stf' });
  assert.equal(m.open, true);
  assert.match(m.label, /vitalício/);
  assert.deepEqual(defaultMandate('prefeito'), ['2025-01-01', '2028-12-31']);
});

test('iniciais ignoram o título que vem antes do nome', () => {
  assert.equal(initials('Pref. Abilio Brunini'), 'AB');
  assert.equal(initials('Presidente Lula'), 'L');
  assert.equal(initials('Gov. Mateus Simões'), 'MS');
  assert.equal(initials('Min. Cármen Lúcia'), 'CL');
  assert.equal(initials('Dep. Álvaro Dias'), 'ÁD');
  assert.equal(initials('Ver. Aiache'), 'A');
  assert.equal(initials('Tabata Amaral'), 'TA');
  assert.equal(initials('Dr. '), 'D');
  assert.equal(initials('Cap Silva'), 'CS', 'sem ponto não é título');
  assert.equal(initials('Cap. Silva'), 'S');
  assert.equal(initials(''), '');
});

test('fotos oficiais: sempre https e direto na URL final do Senado', () => {
  assert.equal(photoUrl(''), '');
  assert.equal(photoUrl('http://www.camara.leg.br/internet/deputado/bandep/204379.jpg'), 'https://www.camara.leg.br/internet/deputado/bandep/204379.jpg');
  assert.equal(photoUrl('http://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg'), 'https://legis.senado.leg.br/senadores/fotos-oficiais/5672');
  assert.equal(photoUrl('https://exemplo.org/a.png'), 'https://exemplo.org/a.png');
  assert.equal(photoUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://usuario:senha@exemplo.org/'), '');
  assert.equal(safeUrl('//exemplo.org/'), '');
  assert.equal(safeUrl('http://exemplo.org/'), '');
  assert.equal(safeUrl('https://exemplo.org/ caminho'), '');
  assert.equal(safeUrl('/src/app.js'), '/src/app.js');
  assert.equal(safeUrl('/\\exemplo.org/'), '');
});
