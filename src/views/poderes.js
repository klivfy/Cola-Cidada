// Gastos por Poder: quanto cada ente monitorado gasta com pessoal no Executivo, no Legislativo e no Judiciário,
// e quanto do limite da LRF isso representa. Dados abertos, sem cadastro; instantâneo do RGF (Siconfi).
import { store } from '../store.js';
import { FEDERATION_UNITS, loadPoderes } from '../api.js';
import { POWERS, FUNCTIONS, STATE_LIMITS, status, kindLabel, entesOfState, rankStates, rankFunction, functionRows } from '../poderes.js';
import { esc, skeleton, tablist, $ } from '../ui.js';

const view = { tab: 'estado', uf: '', measure: 'p:E' };

const compact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const money = (v) => (v == null ? 'não informado' : compact.format(v));
const pct = (v) => (v == null ? 'não informado' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const usePct = (v) => `${Math.round(v * 100)}%`;
const period = (p) => `12 meses até o ${p.periodo}º quadrimestre de ${p.ano}`;

const homeUf = () => {
  const d = store.get().domicile || {};
  return String(d.state || d.uf || 'SP').toUpperCase();
};

function powerBlock(power, p) {
  const head = (chip) => `<div class="row between"><h3 class="u-fw-600">${power.name}</h3>${chip}</div>`;
  if (!p) return `<div class="stack u-gap-8">${head('')}<p class="sm muted">Sem relatório entregue ao Tesouro nos últimos períodos.</p></div>`;
  if (p.nota) {
    return `<div class="stack u-gap-8">${head('<span class="chip">sem comparação</span>')}<p class="sm muted">${esc(p.nota)}</p></div>`;
  }
  const st = status(p.uso);
  const orgs = p.orgaos.map((o) => o.nome).join(', ') + (p.orgaosTotal > p.orgaos.length ? ` e mais ${p.orgaosTotal - p.orgaos.length}` : '');
  return `
  <div class="stack u-gap-8">
    ${head(`<span class="chip ${st.tone}">${esc(st.label)}</span>`)}
    <p class="xs muted">${esc(orgs)}</p>
    <dl class="painel-figures">
      <div><dt>Pessoal (líquida)</dt><dd><b>${money(p.liquida)}</b><span class="xs muted">${pct(p.pctRcl)} da receita corrente líquida</span></dd></div>
      ${p.limite != null ? `<div><dt>Limite máximo informado</dt><dd><b>${money(p.limite)}</b></dd></div>` : ''}
    </dl>
    ${
      p.uso != null
        ? `<div class="bar" aria-hidden="true"><i data-w="${Math.min(100, Math.round(p.uso * 100))}"></i></div>
           <p class="xs">Usa <b>${usePct(p.uso)}</b> do limite. ${esc(period(p))}.</p>`
        : `<p class="xs muted">${esc(period(p))}.</p>`
    }
  </div>`;
}

const pctShare = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`;

function functionBlock(f) {
  const rows = functionRows(f);
  if (!rows.length) return '<p class="sm muted">Despesa por função: sem declaração anual no Tesouro.</p>';
  return `
  <div class="stack u-gap-8">
    <h3 class="u-fw-600">Despesa total por função</h3>
    <p class="xs muted">Gasto liquidado em ${f.ano}: <b>${money(f.total)}</b>. Função não é Poder: aposentadorias e outros gastos de cada Poder podem estar em outras funções.</p>
    <dl class="painel-figures">
      ${rows
        .map((r) => `<div><dt>${esc(r.name)}<span class="xs muted"> · ${esc(r.hint)}</span></dt><dd><b>${money(r.valor)}</b><span class="xs muted">${pctShare(r.pct)} do total</span></dd></div>`)
        .join('')}
    </dl>
  </div>`;
}

function enteCard(e) {
  const isCity = e.tipo === 'capital' || e.tipo === 'polo';
  return `
  <li class="card painel-card poder-card">
    <div class="painel-card-head">
      <span class="painel-icon"><span class="mi" aria-hidden="true">${isCity ? 'location_city' : 'flag'}</span></span>
      <div class="painel-card-text">
        <h2 class="painel-name">${esc(e.nome)}${e.uf && isCity ? ` — ${esc(e.uf)}` : ''}</h2>
        <p class="sm muted">${kindLabel(e)}</p>
      </div>
    </div>
    ${POWERS.filter((w) => w.key in e.poderes).map((w) => powerBlock(w, e.poderes[w.key])).join('<hr>')}
    ${isCity ? '<p class="xs muted">Município não tem Judiciário próprio: a Justiça local é do estado.</p>' : ''}
    <hr>
    ${functionBlock(e.funcoes)}
  </li>`;
}

function stateTab(data) {
  const uf = view.uf;
  const list = [...data.entes.filter((e) => e.tipo === 'uniao'), ...entesOfState(data, uf)];
  const name = FEDERATION_UNITS.find((u) => u.uf === uf)?.name || uf;
  return `
    <p class="sm u-fw-600" role="status" aria-live="polite">${list.length} entes: a União e, em ${esc(name)}, o governo${list.length > 2 ? ', a capital e as duas maiores cidades' : ''}</p>
    <ul class="painel-grid painel-bodies" aria-label="Gastos por Poder">${list.map(enteCard).join('')}</ul>`;
}

const MEASURES = [
  ...POWERS.map((w) => ({ id: `p:${w.key}`, label: `${w.name}: pessoal sobre a receita (limite da LRF)` })),
  ...FUNCTIONS.slice(0, 3).map((f) => ({ id: `f:${f.key}`, label: `${f.name}: parcela do gasto total do estado` })),
];

function compareTab(data) {
  const [kind, key] = view.measure.split(':');
  if (kind === 'f') {
    const fn = FUNCTIONS.find((f) => f.key === key);
    const rows = rankFunction(data, key);
    return `
    <p class="sm muted">Os 27 estados pela parcela da despesa total (liquidada, DCA) que vai à função <b>${esc(fn.name)}</b> (${esc(fn.hint)}).
    Função não é Poder: aposentadorias e outros gastos de cada Poder podem estar em outras funções.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Estados por parcela da função ${esc(fn.name)}">
      <table class="party-table">
        <caption class="sr-only">Despesa da função ${esc(fn.name)} em cada estado</caption>
        <thead><tr><th scope="col">Estado</th><th scope="col">Gasto na função</th><th scope="col">% da despesa total</th></tr></thead>
        <tbody>${rows
          .map(({ ente, f, valor, pct: share }) =>
            f ? `<tr><th scope="row">${esc(ente.nome)}</th><td>${money(valor)}</td><td>${pctShare(share)}</td></tr>`
              : `<tr><th scope="row">${esc(ente.nome)}</th><td colspan="2" class="muted">sem declaração</td></tr>`)
          .join('')}</tbody>
      </table>
    </div>`;
  }
  const power = POWERS.find((w) => w.key === key);
  const rows = rankStates(data, power.key);
  const limit = STATE_LIMITS[power.key];
  return `
    <p class="sm muted">Os 27 estados do que mais para o que menos pesa em ${power.name} (despesa líquida com pessoal sobre a receita corrente líquida).
    O teto da LRF para este Poder nos estados é de <b>${limit}%</b> da receita, somando todos os órgãos dele.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Estados por peso do ${power.name}">
      <table class="party-table">
        <caption class="sr-only">Despesa com pessoal do ${power.name} em cada estado</caption>
        <thead><tr><th scope="col">Estado</th><th scope="col">Pessoal</th><th scope="col">% da receita</th><th scope="col">Uso do limite</th></tr></thead>
        <tbody>${rows
          .map(({ ente, p }) => {
            if (!p) return `<tr><th scope="row">${esc(ente.nome)}</th><td colspan="3" class="muted">sem relatório</td></tr>`;
            const st = status(p.uso);
            return `<tr><th scope="row">${esc(ente.nome)}</th><td>${money(p.liquida)}</td><td>${pct(p.pctRcl)}</td>
              <td>${p.uso == null ? 'não informado' : `${usePct(p.uso)} <span class="chip ${st.tone}">${esc(st.label)}</span>`}</td></tr>`;
          })
          .join('')}</tbody>
      </table>
    </div>`;
}

export async function render(root) {
  if (!view.uf) view.uf = homeUf();
  root.innerHTML = `
    <div class="top">
      <div>
        <h1>Gastos por Poder</h1>
        <p>Quanto o Executivo, o Legislativo e o Judiciário gastam com pessoal na União, nos estados, nas capitais e nas duas maiores cidades de cada estado,
        e quanto do limite da Lei de Responsabilidade Fiscal isso já consome. Tudo aberto, sem cadastro.</p>
        <p><a href="#/painel">Voltar ao Painel público</a></p>
      </div>
    </div>
    <div class="tabs painel-tabs" id="poderes-tabs" aria-label="Formas de ver">
      <button class="${view.tab === 'estado' ? 'on' : ''}" data-tab="estado"><span class="mi u-fs-18" aria-hidden="true">map</span>Por estado e cidades</button>
      <button class="${view.tab === 'comparar' ? 'on' : ''}" data-tab="comparar"><span class="mi u-fs-18" aria-hidden="true">leaderboard</span>Comparar estados</button>
    </div>
    <section id="poderes-panel" class="stack u-gap-14"></section>`;
  const tabs = $('#poderes-tabs', root);
  const panel = $('#poderes-panel', root);
  tablist(tabs, () => panel);
  const selected = tabs.querySelector('[aria-selected="true"]');
  if (selected) panel.setAttribute('aria-labelledby', selected.id);
  tabs.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      panel.setAttribute('aria-labelledby', b.id);
      if (b.dataset.tab === view.tab) return;
      view.tab = b.dataset.tab;
      paint();
    })
  );

  panel.innerHTML = skeleton('Carregando os relatórios do Tesouro…', 3);
  let data;
  try {
    data = await loadPoderes();
  } catch {
    panel.innerHTML = '<div class="card empty" role="status"><p class="muted">Não foi possível carregar os dados de gastos por Poder.</p><button class="btn outlined sm" data-retry>Tentar de novo</button></div>';
    panel.querySelector('[data-retry]').onclick = () => render(root);
    return;
  }

  function paint() {
    const isState = view.tab === 'estado';
    panel.innerHTML = `
      <div class="painel-filters">
        ${
          isState
            ? `<div class="painel-field"><label class="label" for="poderes-uf">Estado e cidades</label>
               <select class="input" id="poderes-uf">${FEDERATION_UNITS.map((u) => `<option value="${u.uf}" ${u.uf === view.uf ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>`
            : `<div class="painel-field"><label class="label" for="poderes-poder">O que comparar</label>
               <select class="input" id="poderes-poder">${MEASURES.map((m) => `<option value="${m.id}" ${m.id === view.measure ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>`
        }
      </div>
      <div id="poderes-body" class="stack u-gap-14">${isState ? stateTab(data) : compareTab(data)}</div>
      <p class="xs muted">Dados que cada ente entrega ao Tesouro Nacional (Siconfi): Relatório de Gestão Fiscal (RGF, Anexo 01) para o pessoal de cada Poder e Declaração de Contas Anuais (DCA, Anexo I-E) para a despesa por função, consultados em ${new Date(data.geradoEm + 'T12:00').toLocaleDateString('pt-BR')}.
      É a <b>despesa líquida com pessoal</b> (ativos, aposentados e pensionistas, descontadas as parcelas que a lei exclui), e não o gasto total do Poder:
      custeio e investimentos não entram. Cada ente informa o próprio limite; quando ele aparece acima de 100%, é o que consta no relatório entregue.
      <a href="https://siconfi.tesouro.gov.br/siconfi/index.jsf" target="_blank" rel="noopener noreferrer">Siconfi<span class="sr-only"> (abre em nova aba)</span></a>.</p>`;
    $('#poderes-uf', panel)?.addEventListener('change', (ev) => {
      view.uf = ev.target.value;
      $('#poderes-body', panel).innerHTML = stateTab(data);
    });
    $('#poderes-poder', panel)?.addEventListener('change', (ev) => {
      view.measure = ev.target.value;
      $('#poderes-body', panel).innerHTML = compareTab(data);
    });
  }
  paint();
}
