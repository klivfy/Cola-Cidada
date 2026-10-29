// Painel público: todos os cargos abertos para consulta, sem cadastro. Acompanhar alguém é opcional
// e só acontece dentro do perfil, depois de a pessoa ver os dados.
import { store } from '../store.js';
import { FEDERATION_UNITS, loadStf, loadExecutive, loadCidades, loadCnpjs } from '../api.js';
import { SECTIONS, loadSection, placeOf, matches } from '../directory.js';
import { budgetSummary, personnelSpending, federalBodies, stateBodies, recentContracts, clearAccountsCache, SICONFI_URL } from '../contas.js';
import { esc, avatar, partyChip, ROLES, skeleton, tablist, brl, $ } from '../ui.js';
import { openPoliticianDetails } from './politicos.js';
import { creditsHtml } from '../creditos.js';
import { safeUrl } from '../urls.js';

const PAGE = 24;

// O que a pessoa escolheu continua valendo ao sair e voltar para o Painel.
const view = {
  section: 'presidencia',
  uf: '',
  city: '',
  q: '',
  shown: PAGE,
};

let entesPromise = null;
const loadEntes = () => (entesPromise ||= fetch('/src/data/entes.json')
  .then((r) => {
    if (!r.ok) throw new Error(`Falha ao carregar entes: HTTP ${r.status}`);
    return r.json();
  })
  .catch((err) => {
    entesPromise = null;
    throw err;
  }));

const homeUf = () => {
  const d = store.get().domicile || {};
  return String(d.state || d.uf || 'SP').toUpperCase();
};

function ufOptions(section, selected) {
  const units = section.key === 'vereadores' || section.key === 'prefeitos' ? FEDERATION_UNITS.filter((u) => u.hasCouncil) : FEDERATION_UNITS;
  const all = section.requiresUf || section.key === 'orgaos' ? '' : `<option value="">Todos os estados</option>`;
  return (
    all +
    units
      .map((u) => `<option value="${u.uf}" ${u.uf === selected ? 'selected' : ''}>${esc(u.name)} (${u.uf})</option>`)
      .join('')
  );
}

const isFollowed = (id) => store.get().politicians.some((p) => p.id === id);

function card(p) {
  const role = ROLES[p.roleKey]?.label || p.role || 'Agente público';
  const followed = isFollowed(p.id);
  return `
  <li class="card painel-card" data-id="${esc(p.id)}">
    <div class="painel-card-head">
      ${avatar(p)}
      <div class="painel-card-text">
        <h2 class="painel-name">${esc(p.name)}</h2>
        <p class="sm muted">${esc(role)} · ${esc(placeOf(p))}</p>
        <div class="row u-gap-6 u-mt-4">
          ${partyChip(p)}
          ${p.condicao ? `<span class="chip gold xs">${esc(p.condicao)}</span>` : ''}
          <span class="chip green xs follow-badge" ${followed ? '' : 'hidden'}>
            <span class="mi u-fs-14" aria-hidden="true">bookmark_added</span>Acompanhando
          </span>
        </div>
      </div>
    </div>
    <button class="btn outlined sm painel-open" data-open="${esc(p.id)}">
      Ver perfil<span class="sr-only"> de ${esc(p.name)}</span>
    </button>
  </li>`;
}

const compact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const money = (v) => (v == null ? 'não informado' : compact.format(v));
const pct = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function bodyCard(b, i) {
  return `
  <li class="card painel-card">
    <div class="painel-card-head">
      <span class="painel-icon"><span class="mi" aria-hidden="true">${b.icon}</span></span>
      <div class="painel-card-text">
        <h2 class="painel-name">${esc(b.name)}</h2>
        <p class="sm muted">${b.budget ? 'Receitas e despesas do orçamento' : 'Gasto com pessoal do órgão'}${b.heavy ? ' · consulta maior (≈ 4 MB)' : ''}${b.note ? ` · ${esc(b.note)}` : ''}</p>
      </div>
    </div>
    <div class="row u-gap-8">
      <button class="btn outlined sm" data-accounts="${i}" aria-expanded="false" aria-controls="acc-${i}">
        Ver contas<span class="sr-only"> de ${esc(b.name)}</span>
      </button>
      ${
        b.cnpj
          ? `<button class="btn outlined sm" data-contracts="${i}" aria-expanded="false" aria-controls="ct-${i}">Contratos recentes<span class="sr-only"> de ${esc(b.name)}</span></button>`
          : ''
      }
      ${
        safeUrl(b.portal)
          ? `<a class="btn ghost sm" href="${esc(safeUrl(b.portal))}" target="_blank" rel="noopener noreferrer">${esc(b.portalLabel)}<span class="sr-only"> (abre em nova aba)</span><span class="mi u-fs-15" aria-hidden="true">open_in_new</span></a>`
          : ''
      }
    </div>
    <div id="acc-${i}" class="painel-accounts" hidden></div>
    ${b.cnpj ? `<div id="ct-${i}" class="painel-accounts" hidden></div>` : ''}
  </li>`;
}

const fmtDay = (d) => (d ? d.split('-').reverse().join('/') : '');

function contractItem(c) {
  return `<li class="stack u-gap-2 sm u-bg-s2 u-p-8-12 u-br-r-sm">
    <div class="row between"><b>${c.value == null ? 'valor não informado' : brl(c.value)}</b><span class="xs muted">${fmtDay(c.date)}</span></div>
    <span>${esc(c.object.slice(0, 220))}${c.object.length > 220 ? '…' : ''}</span>
    <span class="xs muted">${esc(c.supplier)}${c.kind ? ` · ${esc(c.kind)}` : ''}${c.emenda ? ' · <b>emenda parlamentar</b>' : ''}</span>
    ${safeUrl(c.url) ? `<a class="xs" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">Ver no PNCP<span class="sr-only"> (abre em nova aba)</span></a>` : ''}
  </li>`;
}

function contractsHtml(b, data) {
  if (!data.total) return `<p class="sm muted">Nenhum contrato publicado no PNCP nos últimos ${data.days} dias por esta prefeitura.</p>`;
  return `
    <dl class="painel-figures">
      <div><dt>Contratos publicados (${data.days} dias)</dt><dd><b>${data.total.toLocaleString('pt-BR')}</b>${data.partial ? '<span class="xs muted">somados os 500 mais recentes</span>' : ''}</dd></div>
      <div><dt>Soma dos valores informados</dt><dd><b>${money(data.sum)}</b><span class="xs muted">empenhos e contratos, sem descontar repetições</span></dd></div>
    </dl>
    <h3 class="sm u-fw-700">Maiores contratos</h3>
    <ul class="stack u-gap-8">${data.biggest.map(contractItem).join('')}</ul>
    <h3 class="sm u-fw-700">Mais recentes</h3>
    <ul class="stack u-gap-8">${data.items.map(contractItem).join('')}</ul>
    <p class="xs muted">Fonte: <a href="https://pncp.gov.br/app/contratos" target="_blank" rel="noopener noreferrer">Portal Nacional de Contratações Públicas (PNCP)<span class="sr-only"> (abre em nova aba)</span></a>, consultado agora.
    Só o que a prefeitura publicou lá; a Câmara Municipal e outras entidades da cidade têm CNPJ próprio.</p>`;
}

function accountsHtml(b, data) {
  if (!data) return '<p class="sm muted">Este órgão ainda não entregou o relatório ao Tesouro nos últimos períodos.</p>';
  const rows = b.budget
    ? [
        ['Receita arrecadada até o período', money(data.revenue), data.revenueForecast ? `de ${money(data.revenueForecast)} previstos` : ''],
        ['Despesa empenhada (contratada)', money(data.committed), data.budget ? `de ${money(data.budget)} autorizados` : ''],
        ['Despesa liquidada (serviço entregue)', money(data.liquidated), ''],
        ['Despesa paga', money(data.paid), ''],
      ]
    : [
        ['Gasto com pessoal', money(data.gross), 'ativos, aposentados e pensionistas'],
        ...(data.rclPct != null ? [['Peso na receita corrente líquida', pct(data.rclPct), 'a Lei de Responsabilidade Fiscal limita esse percentual']] : []),
      ];
  return `
    <dl class="painel-figures">
      ${rows.map(([k, v, note]) => `<div><dt>${k}</dt><dd><b>${v}</b>${note ? `<span class="xs muted">${note}</span>` : ''}</dd></div>`).join('')}
    </dl>
    <p class="xs muted">${esc(data.institution)} · ${esc(data.periodLabel)}. Fonte: <a href="${SICONFI_URL}" target="_blank" rel="noopener noreferrer">Siconfi, Tesouro Nacional<span class="sr-only"> (abre em nova aba)</span></a>.</p>`;
}

export async function render(root) {
  root.innerHTML = `
    <div class="top directory-intro">
      <div>
        <span class="directory-eyebrow"><span class="mi" aria-hidden="true">verified</span>Dados públicos oficiais</span>
        <h1>Painel público</h1>
        <p>Explore cargos e contas públicas, do Presidente aos vereadores das capitais e das maiores cidades de cada estado.</p>
        <p>Abra um perfil e escolha quem acompanhar. Sua lista fica só neste aparelho.</p>
      </div>
    </div>

    <div class="tabs painel-tabs" id="painel-tabs" aria-label="Cargos e órgãos">
      ${SECTIONS.map(
        (s) => `<button class="${s.key === view.section ? 'on' : ''}" data-section="${s.key}">
          <span class="mi u-fs-18" aria-hidden="true">${s.icon}</span>${esc(s.label)}</button>`
      ).join('')}
    </div>

    <section id="painel-panel" class="stack u-gap-14"></section>

    <section class="card creditos stack u-gap-8" id="creditos">
      <button class="btn outlined sm creditos-btn" id="creditos-btn" aria-expanded="false" aria-controls="creditos-body">Créditos das imagens</button>
      <div class="stack u-gap-8" id="creditos-body" hidden></div>
    </section>
  `;
  $('#creditos-btn', root).addEventListener('click', async (e) => {
    const box = $('#creditos-body', root);
    const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
    e.currentTarget.setAttribute('aria-expanded', String(!open));
    box.hidden = open;
    if (open || box.dataset.loaded) return;
    box.dataset.loaded = '1';
    box.innerHTML = creditsHtml(await loadStf().catch(() => null));
  });

  // As abas são montadas uma vez: trocar de aba só refaz o painel, e o foco fica na aba (setas continuam funcionando).
  const tabs = $('#painel-tabs', root);
  const panel = $('#painel-panel', root);
  tablist(tabs, () => panel);
  tabs.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      panel.setAttribute('aria-labelledby', b.id);
      if (b.dataset.section === view.section) return;
      view.section = b.dataset.section;
      view.q = '';
      view.city = '';
      view.shown = PAGE;
      const next = SECTIONS.find((s) => s.key === view.section);
      if (!next.filter && next.key !== 'orgaos') view.uf = '';
      renderPanel(panel);
    });
  });
  const selected = tabs.querySelector('[aria-selected="true"]');
  if (selected) panel.setAttribute('aria-labelledby', selected.id);
  await renderPanel(panel);
}

let panelToken = 0;

async function renderPanel(panel) {
  const token = ++panelToken;
  const section = SECTIONS.find((s) => s.key === view.section) || SECTIONS[0];
  if ((section.requiresUf || section.key === 'orgaos') && !view.uf) view.uf = homeUf();

  panel.innerHTML = `
      <p class="sm muted" id="painel-hint">${esc(section.hint)}</p>
      <div class="painel-filters">
        ${
          section.key === 'orgaos'
            ? ''
            : `<div class="painel-field painel-search">
          <label class="label" for="painel-q">Buscar por nome, partido ou cidade</label>
          <input class="input" type="search" id="painel-q" value="${esc(view.q)}" placeholder="Ex.: Maria, PT ou Recife" autocomplete="off" enterkeyhint="search">
        </div>`
        }
        ${
          section.filter === 'uf' || section.key === 'orgaos'
            ? `<div class="painel-field">
          <label class="label" for="painel-uf">${section.key === 'orgaos' ? 'Estado e cidades' : 'Estado'}</label>
          <select class="input" id="painel-uf">${ufOptions(section, view.uf)}</select>
        </div>`
            : ''
        }
        ${
          section.key === 'vereadores'
            ? `<div class="painel-field" id="painel-city-field" hidden>
          <label class="label" for="painel-city">Cidade</label>
          <select class="input" id="painel-city"></select>
        </div>`
            : ''
        }
      </div>
      <p class="sm u-fw-600" id="painel-count" role="status" aria-live="polite"></p>
      <div id="painel-results">${skeleton('Carregando dados oficiais…', 3)}</div>
  `;

  const results = $('#painel-results', panel);
  const count = $('#painel-count', panel);
  const ufSel = $('#painel-uf', panel);
  const search = $('#painel-q', panel);
  const citySel = $('#painel-city', panel);

  if (section.key === 'orgaos') return renderBodies(results, count, ufSel);

  let list = [];
  const paint = () => {
    const filtered = list.filter((p) => (!view.uf || p.uf === view.uf) && (!view.city || p.city === view.city) && matches(p, view.q));
    const visible = filtered.slice(0, view.shown);
    count.textContent = filtered.length
      ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}${filtered.length > visible.length ? `, mostrando ${visible.length}` : ''}`
      : 'Nenhum resultado para esse filtro.';
    results.innerHTML = `
      ${visible.length ? `<ul class="painel-grid" aria-label="${esc(section.label)}">${visible.map(card).join('')}</ul>` : '<div class="card empty directory-empty"><span class="mi" aria-hidden="true">info</span><p>Nenhuma pessoa encontrada. Tente outro nome, partido ou local.</p></div>'}
      ${filtered.length > visible.length ? `<button class="btn outlined painel-more" id="painel-more">Mostrar mais ${Math.min(PAGE, filtered.length - visible.length)}</button>` : ''}
      ${section.key === 'stf' ? `<p class="sm muted">${esc(stfNote)}</p>` : ''}
      ${['governadores', 'prefeitos'].includes(section.key) ? `<p class="xs muted">Ocupantes atuais conferidos em ${esc(checkedAt)}. Renúncias e afastamentos mudam esses cargos: confira também o site oficial.${section.key === 'prefeitos' ? ` Nas cidades que não são capitais, os ocupantes foram conferidos em notícias de ${esc(polosCheckedAt)} (veja a nota de cada perfil) e podem ter mudado depois.` : ''}</p>` : ''}`;
    results.querySelectorAll('[data-open]').forEach((b) => {
      b.onclick = () => {
        const p = list.find((x) => x.id === b.dataset.open);
        if (p) openPoliticianDetails(p);
      };
    });
    const more = $('#painel-more', results);
    if (more)
      more.onclick = () => {
        const first = view.shown;
        view.shown += PAGE;
        paint();
        // o foco vai para o primeiro item novo, e não volta ao topo da lista
        results.querySelectorAll('.painel-open')[first]?.focus();
      };
  };

  // Os controles já valem enquanto a lista carrega: trocar o estado nesse intervalo não pode ser ignorado.
  let loaded = false;
  let timer;
  if (search)
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        view.q = search.value;
        view.shown = PAGE;
        if (loaded) paint();
      }, 200);
    });
  if (ufSel)
    ufSel.onchange = async () => {
      view.uf = ufSel.value;
      view.city = '';
      view.shown = PAGE;
      if (section.requiresUf) {
        await renderPanel(panel);
        $('#painel-uf', panel)?.focus();
      } else if (loaded) paint();
    };

  let stfNote = '';
  let checkedAt = '';
  let polosCheckedAt = '';
  try {
    list = await loadSection(section.key, view.uf);
    if (section.key === 'stf') {
      stfNote = (await loadStf()).vaga || '';
    }
    if (['governadores', 'prefeitos'].includes(section.key)) {
      const { consultadoEm } = await loadExecutive();
      checkedAt = consultadoEm ? new Date(`${consultadoEm}T12:00:00`).toLocaleDateString('pt-BR') : 'data não informada';
      if (section.key === 'prefeitos') {
        const { ocupantesConsultadosEm: d } = await loadCidades();
        polosCheckedAt = d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : 'data não informada';
      }
    }
  } catch {
    count.textContent = '';
    results.innerHTML = `<div class="card empty"><span class="mi" aria-hidden="true">cloud_off</span>
      <p class="muted">Não foi possível carregar agora. Verifique a conexão e tente de novo.</p>
      <button class="btn outlined" id="painel-retry">Tentar de novo</button></div>`;
    $('#painel-retry', results).onclick = () => renderPanel(panel);
    return;
  }
  if (!panel.isConnected || token !== panelToken) return;
  if (citySel) {
    const cities = [...new Set(list.filter((p) => !view.uf || p.uf === view.uf).map((p) => p.city))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
    if (!cities.includes(view.city)) view.city = '';
    citySel.innerHTML = `<option value="">Todas as cidades (${cities.length})</option>${cities
      .map((c) => `<option value="${esc(c)}" ${c === view.city ? 'selected' : ''}>${esc(c)}</option>`)
      .join('')}`;
    $('#painel-city-field', panel).hidden = cities.length < 2;
    citySel.onchange = () => {
      view.city = citySel.value;
      view.shown = PAGE;
      paint();
    };
  }
  loaded = true;
  paint();
}

async function renderBodies(results, count, ufSel) {
  let entes, cidades, cnpjs;
  try {
    [entes, { cidades }, cnpjs] = await Promise.all([loadEntes(), loadCidades(), loadCnpjs()]);
  } catch {
    count.textContent = '';
    results.innerHTML = '<div class="card empty" role="status"><p class="muted">Não foi possível carregar a lista de órgãos ou cidades agora.</p><button class="btn outlined sm" data-retry>Tentar de novo</button></div>';
    results.querySelector('[data-retry]').onclick = () => renderBodies(results, count, ufSel);
    return;
  }
  const bodies = [...federalBodies(), ...stateBodies(view.uf, entes, cidades, cnpjs)];
  const uf = FEDERATION_UNITS.find((u) => u.uf === view.uf);
  const hasCities = cidades.some((c) => c.uf === view.uf && c.kind === 'polo');
  count.textContent = `${bodies.length} órgãos: federais, de ${uf?.name || view.uf}${hasCities ? ', da capital e das duas maiores cidades do estado' : ''}`;
  results.innerHTML = `
    <a class="btn outlined sm" href="#/poderes"><span class="mi u-fs-18" aria-hidden="true">balance</span>Ver gastos por Poder: Executivo, Legislativo e Judiciário</a>
    <ul class="painel-grid painel-bodies" aria-label="Órgãos e contas">${bodies.map(bodyCard).join('')}</ul>
    <p class="xs muted">As contas vêm dos relatórios que a União, os estados e os municípios entregam ao Tesouro Nacional por exigência da
    Lei de Responsabilidade Fiscal (RREO e RGF). Valores acumulados no período indicado em cada órgão.</p>`;

  results.querySelectorAll('[data-contracts]').forEach((btn) => {
    btn.onclick = async () => {
      const b = bodies[Number(btn.dataset.contracts)];
      const box = $(`#ct-${btn.dataset.contracts}`, results);
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      box.hidden = open;
      if (open || box.dataset.loaded) return;
      const load = async () => {
        box.innerHTML = skeleton('Consultando o PNCP…', 1);
        try {
          box.innerHTML = contractsHtml(b, await recentContracts(b.cnpj)) + '<button class="btn outlined sm" data-refresh>Atualizar contratos</button>';
          box.dataset.loaded = '1';
          box.querySelector('[data-refresh]').onclick = () => {
            clearAccountsCache();
            load();
          };
        } catch {
          box.innerHTML = `<p class="sm muted" role="status">Falha ao consultar o PNCP.</p><button class="btn outlined sm" data-retry>Tentar de novo</button>`;
          box.querySelector('[data-retry]').onclick = load;
        }
      };
      await load();
    };
  });

  results.querySelectorAll('[data-accounts]').forEach((btn) => {
    btn.onclick = async () => {
      const b = bodies[Number(btn.dataset.accounts)];
      const box = $(`#acc-${btn.dataset.accounts}`, results);
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      box.hidden = open;
      if (open || box.dataset.loaded) return;
      const load = async (retrying) => {
        box.innerHTML = skeleton('Consultando o Tesouro Nacional…', 1);
        try {
          const data = b.budget ? await budgetSummary(b.ente) : await personnelSpending(b.ente, b.poder, b.match);
          box.innerHTML = accountsHtml(b, data) + '<button class="btn outlined sm" data-refresh>Atualizar contas</button>';
          box.dataset.loaded = '1';
          box.querySelector('[data-refresh]').onclick = () => {
            clearAccountsCache();
            load(true);
          };
        } catch {
          box.innerHTML = `<p class="sm muted" role="status">Falha ao consultar o Tesouro Nacional.</p>
            <button class="btn outlined sm" data-retry>Tentar de novo<span class="sr-only"> (${esc(b.name)})</span></button>`;
          box.querySelector('[data-retry]').onclick = async () => {
            await load(true);
            // o botão some ao recarregar: o foco vai para o resultado ou para o novo botão
            if (box.dataset.loaded) {
              box.tabIndex = -1;
              box.focus();
            }
          };
          if (retrying) box.querySelector('[data-retry]').focus();
        }
      };
      load(false);
    };
  });

  ufSel.onchange = () => {
    view.uf = ufSel.value;
    renderBodies(results, count, ufSel);
  };
}

// O Painel não é remontado quando o usuário passa a acompanhar alguém (isso fecharia o lugar onde ele está):
// só os selos "Acompanhando" mudam.
export function onStore(root) {
  root.querySelectorAll('.painel-card[data-id]').forEach((li) => {
    const badge = li.querySelector('.follow-badge');
    if (badge) badge.hidden = !isFollowed(li.dataset.id);
  });
}
