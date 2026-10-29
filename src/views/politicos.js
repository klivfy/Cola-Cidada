import { store } from '../store.js';
import {
  deputyPropositions,
  deputyExpenses,
  deputyProfile,
  deputyFronts,
  senatorCommittees,
  senatorCeaps,
  authorEmendas,
  cityEmendas,
  cityFacts,
  loadCidades,
  senatorVotes,
  getTseElectoralProfile,
} from '../api.js';
import { ROLES, avatar, partyChip, esc, mandateProgress, modal, fmtDate, VOTE_CLASS, brl, toast, tablist, skeleton } from '../ui.js';
import { deputyPlenaryStats, senatorPlenaryStats } from '../plenary.js';
import { birthplace, isMagistrate, partyOrBirth, photoCredit } from '../simbolos.js';
import { plenaryPanelHtml } from './plenaryPanel.js';
import { openDossierModal } from '../dossier.js';
import { openShareModal } from '../share.js';
import { openAnalysisModal } from '../analysis.js';
import { currentLegislatureLabel } from '../legislature.js';
import { safeUrl } from '../urls.js';

export function politicianCard(p, { heading = 3 } = {}) {
  const isState =
    p.source === 'alesp' ||
    p.source === 'alerj' ||
    p.source === 'almg' ||
    p.roleKey === 'dep-estadual' ||
    (typeof p.source === 'string' && p.source.startsWith('al-'));
  const isCouncilor =
    p.source === 'cmsp' ||
    p.roleKey === 'vereador' ||
    (typeof p.source === 'string' && p.source.startsWith('cm-'));
  const isSenator = p.source === 'senado' || p.roleKey === 'senador';
  const isDeputy = p.source === 'camara' || p.roleKey === 'dep-federal';

  const sourceLabel =
    p.source === 'camara'
      ? 'Câmara Federal'
      : p.source === 'senado'
      ? 'Senado Federal'
      : isState
      ? (p.house ? p.house.split('(')[0].trim() : `AL (${p.uf || 'Est.'})`)
      : isCouncilor
      ? (p.house ? (p.house.includes('(') ? p.house.split('(')[0].trim() : p.house) : `Câmara (${p.city || p.uf || 'Mun.'})`)
      : 'Executivo / Outro';

  const sourceChipClass =
    p.source === 'camara'
      ? 'green'
      : p.source === 'senado'
      ? 'blue'
      : isState
      ? 'purple'
      : isCouncilor
      ? 'teal'
      : 'gold';

  const m = mandateProgress(p);

  return `
  <article class="card stack pol-card u-gap-14 u-position-relative">
    <!-- Header do Card com Avatar e Dados -->
    <div class="pol-head">
      <div class="avatar-wrap">
        ${avatar(p)}
        <span class="avatar-badge-icon" title="Mandato Monitorado">
          <span class="mi u-fs-11" aria-hidden="true">check</span>
        </span>
      </div>
      <div class="pol-head-text">
        <h${heading} class="h2 u-fs-15_5 u-fw-700">${esc(p.name)}</h${heading}>
        <span class="sm muted u-d-block u-mt-2">
          ${ROLES[p.roleKey]?.label || 'Parlamentar'}${isMagistrate(p) ? '' : ` • ${esc(p.uf || 'BR')}`}
        </span>
        <div class="row u-gap-6 u-mt-8">
          ${partyChip(p, sourceChipClass)}
          <span class="chip ${sourceChipClass} xs">${sourceLabel}</span>
        </div>
      </div>
    </div>

    <!-- Barra de Mandato com Anos e Percentual -->
    <div>
      <div class="row between xs muted u-fw-600">
        <span>Mandato: ${m.end ? `Término em ${m.end}` : 'Em curso'}</span>
        <b class="u-c-text">${m.pct}% cumprido</b>
      </div>
      <div class="bar u-m-6-0 u-height-7">
        <i data-w="${m.pct}"></i>
      </div>
      <div class="row between xs muted">
        <span>${m.label}</span>
      </div>
    </div>

    <!-- Ações do Card -->
    <div class="card-actions">
      <button class="btn primary sm" data-details="${p.id}">
        <span class="mi u-fs-16" aria-hidden="true">analytics</span>
        <span>Ver perfil</span>
      </button>
      <div class="icon-group">
      <button class="btn outlined sm icon" data-dossier="${p.id}" title="Gerar Dossiê Oficial em PDF" aria-label="Relatório PDF de ${esc(p.name)}">
        <span class="mi u-fs-16" aria-hidden="true">description</span>
      </button>
      <button class="btn outlined sm icon" data-share="${p.id}" title="Gerar Card Visual para WhatsApp / Redes" aria-label="Compartilhar card de ${esc(p.name)}">
        <span class="mi u-fs-16" aria-hidden="true">share</span>
      </button>
      <button class="btn danger sm icon" data-remove="${p.id}" title="Deixar de acompanhar" aria-label="Deixar de acompanhar ${esc(p.name)}">
        <span class="mi u-fs-16" aria-hidden="true">delete</span>
      </button>
      </div>
    </div>
  </article>`;
}

// De onde vem a foto (e, quando a licença pede, quem tirou).
function creditHtml(p) {
  const c = photoCredit(p);
  if (!c) return '';
  return `<span class="xs muted u-d-block">${safeUrl(c.url) ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.texto)}<span class="sr-only"> (abre em nova aba)</span></a>` : esc(c.texto)}</span>`;
}

const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Ficha do cargo para quem não é parlamentar: Presidente, governadores, prefeitos e ministros do STF.
function officeHtml(p, isStf) {
  const rows = isStf
    ? [
        ['Cargo', p.cargo || 'Ministro(a)'],
        ['Nome completo', p.fullName],
        ['Natural de', birthplace(p)?.texto || ''],
        ['No STF desde', longDate(p.posse)],
        ['Indicado(a) por', p.indicadoPor],
        ['Aposentadoria compulsória (75 anos)', p.aposentadoriaCompulsoria ? String(p.aposentadoriaCompulsoria) : ''],
      ]
    : [
        ['Órgão', p.house],
        ['Nome completo', p.fullName],
        ['Partido atual', p.party],
        ['Situação', p.situacao],
        ['No cargo desde', longDate(p.desde)],
        [p.roleKey === 'prefeito' ? 'Vice-prefeito(a)' : p.roleKey === 'governador' ? 'Vice-governador(a)' : 'Vice-presidente', p.vice?.name || 'Não há (o cargo de vice está vago)'],
        ...(p.eleitoPeloTse ? [['Eleito(a) na chapa original', `${p.eleitoPeloTse.name} (${p.eleitoPeloTse.party}), em ${p.eleitoPeloTse.year}`]] : []),
      ];
  return `
    <div class="card soft stack u-gap-10 u-p-14">
      <dl class="office-list">
        ${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>
      ${p.nota ? `<p class="sm muted">${esc(p.nota)}</p>` : ''}
      <p class="xs muted">${
        isStf
          ? 'Ministros do STF não são eleitos: são indicados pelo Presidente e aprovados pelo Senado.'
          : 'Ocupante atual conferido com registros públicos; a ficha eleitoral do TSE é de quem venceu a eleição.'
      }</p>
      ${
        isStf
          ? `<a href="https://portal.stf.jus.br/" target="_blank" rel="noopener noreferrer" class="btn outlined sm u-jc-center">Portal do STF<span class="sr-only"> (abre em nova aba)</span><span class="mi u-fs-15" aria-hidden="true">open_in_new</span></a>`
          : ''
      }
    </div>`;
}

const compactBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

// Contexto da cidade (IBGE): ajuda a ler o tamanho do orçamento e da câmara. Vale para capitais e cidades-polo.
function cityFactsHtml(c, ano, popAno, em) {
  const place = c.kind === 'capital' ? `Capital · ${c.rankPib}ª economia do estado` : `${c.rankPib}ª maior economia do estado`;
  const rows = [
    ['Posição no estado (PIB)', place],
    [`PIB (${ano})`, compactBrl.format(c.pib)],
    [`População (Censo ${popAno})`, c.populacao ? c.populacao.toLocaleString('pt-BR') : 'não informada'],
    ['PIB por habitante', c.pibPerCapita ? brl(c.pibPerCapita) : 'não informado'],
  ];
  return `
    <section class="card soft stack u-gap-8 u-p-14" aria-labelledby="city-facts-title">
      <h3 class="sm u-fw-700" id="city-facts-title">A cidade: ${esc(c.nome)}</h3>
      <dl class="office-list">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="xs muted">Fonte: IBGE (PIB dos Municípios e Censo Demográfico).</p>
      ${cityEmendasHtml(em)}
    </section>`;
}

const yearsOf = (o) => Object.keys(o).sort().reverse();

// Emendas que a cidade recebeu desde 2023 (todas as modalidades), com os autores que mais enviaram.
function cityEmendasHtml(em) {
  if (!em) return '';
  if (em.vazio) return `<p class="xs muted">Emendas parlamentares: nenhuma registrada para esta cidade desde ${em.desde} (Portal da Transparência).</p>`;
  const tot = Object.values(em.anos).reduce((a, y) => ({ e: a.e + y.empenhado, p: a.p + y.pago }), { e: 0, p: 0 });
  return `
    <div class="stack u-gap-6" id="city-emendas">
      <h4 class="sm u-fw-700">Emendas parlamentares desde ${em.desde}</h4>
      <dl class="office-list">
        <div><dt>Empenhado (reservado)</dt><dd>${compactBrl.format(tot.e)}</dd></div>
        <div><dt>Pago até agora</dt><dd>${compactBrl.format(tot.p)}</dd></div>
        <div><dt>Emendas</dt><dd>${em.emendas}</dd></div>
      </dl>
      <span class="xs muted u-fw-700">Quem mais enviou:</span>
      <ul class="stack u-gap-6">${em.autores.map((a) => `<li class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm"><span class="muted truncate u-maxw-240">${esc(a.nome)}</span><b>${compactBrl.format(a.valor)}</b></li>`).join('')}</ul>
      <p class="xs muted">Fonte: Portal da Transparência (CGU), resumo de ${fmtDate(em.geradoEm)}.</p>
    </div>`;
}

// Emendas individuais do parlamentar desde 2023, do resumo gerado do Portal da Transparência. A ligação é pelo nome parlamentar.
function emendasHtml(e) {
  if (!e) {
    return `<p class="muted">Nenhuma emenda individual encontrada com este nome parlamentar desde 2023. A ligação é feita pelo nome: se o nome no Portal da Transparência for outro, ela não aparece aqui.
      <a href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noopener noreferrer">Consultar no Portal<span class="sr-only"> (abre em nova aba)</span></a>.</p>`;
  }
  const years = yearsOf(e.anos);
  const list = (items, label) =>
    items.length
      ? `<section class="card soft stack u-gap-8 u-p-14"><h3 class="sm u-fw-700">${label}</h3>
        <ul class="stack u-gap-6">${items.map((i) => `<li class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm"><span class="muted truncate u-maxw-240">${esc(i.nome)}${i.uf ? ` (${esc(i.uf)})` : ''}</span><b>${brl(i.valor)}</b></li>`).join('')}</ul></section>`
      : '';
  return `
    <div class="row between">
      <span class="chip blue">Emendas individuais desde ${e.desde}</span>
      <span class="xs muted">Resumo de ${fmtDate(e.geradoEm)}</span>
    </div>
    ${years
      .map((y) => {
        const a = e.anos[y];
        return `<section class="card soft stack u-gap-8 u-p-14" aria-labelledby="em-${y}">
          <h3 class="sm u-fw-700" id="em-${y}">${esc(y)}${Number(y) === Number(e.geradoEm.slice(0, 4)) ? ' (até a data do resumo)' : ''}</h3>
          <dl class="office-list"><div><dt>Empenhado (reservado no orçamento)</dt><dd>${brl(a.empenhado)}</dd></div><div><dt>Pago até agora</dt><dd>${brl(a.pago)}</dd></div></dl>
        </section>`;
      })
      .join('')}
    <p class="sm">${e.emendas} emendas no período${e.especial ? `, ${brl(e.especial)} delas em transferências especiais (as "emendas Pix", que vão direto ao caixa do município)` : ''}.</p>
    ${list(e.destinos, 'Municípios que mais receberam')}
    ${list(e.favorecidos, 'Quem mais recebeu o dinheiro')}
    <p class="xs muted">Fonte: <a href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noopener noreferrer">Portal da Transparência (CGU)<span class="sr-only"> (abre em nova aba)</span></a>.
    Valores desde ${e.desde}; o pago inclui restos a pagar de anos anteriores. O parlamentar é ligado pelo nome parlamentar, e o resumo é gerado de tempos em tempos.</p>`;
}

// Cota para o exercício da atividade parlamentar (CEAPS) do senador, a partir do resumo gerado do dado aberto do Senado.
function ceapsHtml(c) {
  if (!c) return '<p class="muted">Não há despesas da cota registradas para este senador no período do resumo.</p>';
  const years = Object.keys(c.anos).sort().reverse();
  return `
    <div class="row between">
      <span class="chip blue">Cota parlamentar (CEAPS)</span>
      <span class="xs muted">Resumo de ${fmtDate(c.geradoEm)}</span>
    </div>
    ${years
      .map((y) => {
        const a = c.anos[y];
        return `<section class="card soft stack u-gap-8 u-p-14" aria-labelledby="ceaps-${y}">
          <div class="row between"><h3 class="sm u-fw-700" id="ceaps-${y}">${esc(y)}${Number(y) === Number(c.geradoEm.slice(0, 4)) ? ' (até a data do resumo)' : ''}</h3><b class="u-fs-18 u-c-primary">${brl(a.total)}</b></div>
          <span class="sm muted u-fw-700">Principais tipos de despesa:</span>
          <ul class="stack u-gap-6">${a.tipos
            .map((t) => `<li class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm"><span class="muted truncate u-maxw-240">${esc(t.tipo)}</span><b>${brl(t.valor)}</b></li>`)
            .join('')}</ul>
        </section>`;
      })
      .join('')}
    ${
      c.grandes.length
        ? `<section class="card soft stack u-gap-8 u-p-14" aria-labelledby="ceaps-big">
          <h3 class="sm u-fw-700" id="ceaps-big">Despesas a partir de ${brl(c.limite)}, as mais recentes</h3>
          <ul class="stack u-gap-6">${c.grandes
            .map(
              (e) => `<li class="stack u-gap-2 sm u-bg-s2 u-p-8-12 u-br-r-sm"><div class="row between"><b>${brl(e.valor)}</b><span class="xs muted">${fmtDate(e.data)}</span></div>
              <span class="xs muted">${esc(e.tipo)}${e.fornecedor ? ` · ${esc(e.fornecedor)}` : ''}</span></li>`
            )
            .join('')}</ul>
        </section>`
        : ''
    }
    <p class="xs muted">Fonte: dados abertos do Senado (CEAPS). O resumo é gerado de tempos em tempos e pode não ter as despesas dos últimos dias. Notas e recibos: <a href="https://www12.senado.leg.br/transparencia" target="_blank" rel="noopener noreferrer">Transparência do Senado<span class="sr-only"> (abre em nova aba)</span></a>.</p>`;
}

const EXEC_ROLES = new Set(['presidente', 'governador', 'prefeito']);

// Acompanhar é uma escolha feita aqui, depois de ver o perfil; fica só neste aparelho.
function followButtonHtml(followed) {
  return followed
    ? '<span class="mi u-fs-16" aria-hidden="true">bookmark_added</span>Acompanhando'
    : '<span class="mi u-fs-16" aria-hidden="true">bookmark_add</span>Acompanhar';
}

function bindFollow(el, p) {
  const btn = el.querySelector('#follow-btn');
  if (!btn) return;
  const paint = () => {
    const followed = store.get().politicians.some((x) => x.id === p.id);
    btn.setAttribute('aria-pressed', String(followed));
    btn.classList.toggle('primary', !followed);
    btn.classList.toggle('outlined', followed);
    btn.innerHTML = followButtonHtml(followed);
  };
  btn.onclick = () => {
    const followed = store.get().politicians.some((x) => x.id === p.id);
    if (followed) {
      store.removePolitician(p.id);
      toast(`Você deixou de acompanhar ${p.name}.`, 'delete', {
        action: { label: 'Desfazer', onClick: () => { store.addPolitician(p); paint(); } },
      });
    } else {
      store.addPolitician(p);
      toast(`Você passou a acompanhar ${p.name}. Veja em Início, Comparador e Alertas.`);
    }
    paint();
  };
  paint();
}

export async function openPoliticianDetails(p) {
  const isExec = EXEC_ROLES.has(p.roleKey);
  const isStf = p.roleKey === 'ministro-stf';
  const isDeputy = p.source === 'camara' || p.roleKey === 'dep-federal';
  const isSenator = p.source === 'senado' || p.roleKey === 'senador';
  const isCouncilor =
    p.source === 'cmsp' ||
    p.roleKey === 'vereador' ||
    (typeof p.source === 'string' && p.source.startsWith('cm-'));
  const isState =
    p.source === 'alesp' ||
    p.source === 'alerj' ||
    p.source === 'almg' ||
    p.roleKey === 'dep-estadual' ||
    (typeof p.source === 'string' && p.source.startsWith('al-'));
  const tse = getTseElectoralProfile(p);
  const m = mandateProgress(p);

  const { el, close } = modal(`
    <!-- Cabeçalho do Modal no Estilo Stitch -->
    <div class="stack u-gap-14">
      <div class="row between nowrap profile-heading">
        <div class="row nowrap u-gap-14 profile-identity">
          <div class="avatar-wrap">
            ${avatar(p)}
            <span class="avatar-badge-icon">
              <span class="mi u-fs-11" aria-hidden="true">verified</span>
            </span>
          </div>
          <div>
            <div class="row u-gap-6">
              <h3 class="h2 u-fs-18 u-fw-800">${esc(p.name)}</h3>
              ${partyChip(p, 'green')}
            </div>
            <span class="sm muted">${ROLES[p.roleKey]?.label || ''}${isMagistrate(p) ? '' : ` • ${esc(p.city ? `${p.city}/${p.uf}` : p.uf || 'BR')}`}</span>
            ${creditHtml(p)}
          </div>
        </div>
        <button class="btn icon ghost" data-close aria-label="Fechar"><span class="mi" aria-hidden="true">close</span></button>
      </div>

      <div class="row u-gap-10 follow-row">
        <button class="btn sm" id="follow-btn" aria-pressed="false" aria-describedby="follow-note"></button>
        <span class="xs muted" id="follow-note">Opcional. A lista de quem você acompanha fica salva só neste aparelho.</span>
      </div>

      <!-- Barra de Mandato & Badges Superiores -->
      <div class="card soft stack u-gap-8 u-p-12">
        ${
          m.open
            ? `<p class="sm"><b>${esc(m.label)}</b></p>`
            : `<div class="row between sm">
          <span>Mandato até <b>${m.end || 'em exercício'}</b></span>
          <b class="u-c-primary">${m.pct}% concluído</b>
        </div>
        <div class="bar u-height-7"><i data-w="${m.pct}"></i></div>`
        }
        <div class="row u-gap-8 u-mt-4">
        </div>
      </div>
    </div>

    ${p.roleKey === 'prefeito' || isCouncilor ? '<div id="city-facts" aria-live="polite"></div>' : ''}

    <!-- Navegação de Abas MD3 -->
    <div class="tabs u-ovx-auto u-maxw-100pct u-white-space-nowrap u-p-4" id="pol-tabs" aria-label="Seções da ficha">
      ${
        isDeputy
          ? `
        <button class="on" data-tab="gastos">Auditoria CEAP (Gastos)</button>
        <button data-tab="projetos">Projetos de Lei (PLs)</button>
        <button data-tab="perfil">Gabinete Oficial</button>
        <button data-tab="emendas">Emendas</button>
        <button data-tab="plenario">Presença & Fidelidade</button>
      `
          : isSenator
          ? `
        <button class="on" data-tab="senado">Votações no Senado</button>
        <button data-tab="cota">Cota (CEAPS)</button>
        <button data-tab="emendas">Emendas</button>
        <button data-tab="comissoes">Comissões</button>
        <button data-tab="plenario">Presença & Fidelidade</button>
      `
          : `
        <button class="on" data-tab="local">${isStf ? 'No Supremo' : isExec ? 'No cargo' : isCouncilor ? 'Mandato Municipal' : 'Mandato Estadual'}</button>
      `
      }
      ${isStf ? '' : '<button data-tab="tse">Ficha Eleitoral & TSE</button>'}
    </div>

    <!-- ABA 1: Gastos CEAP (Deputados) -->
    ${
      isDeputy
        ? `
      <div id="tab-gastos" class="stack pol-pane u-mt-4">
        ${skeleton('Auditando cota parlamentar (CEAP)…', 2)}
      </div>
      <div id="tab-projetos" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Consultando projetos de lei…', 2)}
      </div>
      <div id="tab-perfil" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Consultando dados do gabinete oficial…', 1)}
      </div>
      <div id="tab-emendas" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Carregando as emendas parlamentares…', 1)}
      </div>
      <div id="tab-plenario" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Calculando presença e fidelidade a partir das sessões e votações oficiais…', 1)}
      </div>
    `
        : isSenator
        ? `
      <div id="tab-senado" class="stack pol-pane u-mt-4">
        ${skeleton('Carregando votações nominais no Senado…', 2)}
      </div>
      <div id="tab-cota" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Carregando o resumo da cota parlamentar…', 1)}
      </div>
      <div id="tab-emendas" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Carregando as emendas parlamentares…', 1)}
      </div>
      <div id="tab-comissoes" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Consultando as comissões do Senado…', 1)}
      </div>
      <div id="tab-plenario" class="stack pol-pane hidden u-mt-4">
        ${skeleton('Calculando presença e fidelidade a partir das votações oficiais do Senado…', 1)}
      </div>
    `
        : `
      <div id="tab-local" class="stack pol-pane u-mt-4">
        ${isStf || isExec ? officeHtml(p, isStf) : ''}
        <div class="stack u-gap-12 ${isStf || isExec ? 'hidden' : ''}">
        <div class="card soft stack u-gap-10 u-p-14">
          <div class="row between">
            <span class="chip ${isCouncilor ? 'teal' : 'purple'}">${esc(p.house || 'Casa Legislativa')}</span>
            <span class="sm muted">Situação: ${esc(p.situacao || 'Em Exercício')}</span>
          </div>
          <div>
            <span class="xs muted u-tt-uppercase u-fw-700">Nome Parlamentar</span>
            <p class="u-fw-700 u-fs-15">${esc(p.name)}</p>
          </div>
          ${
            p.baseEleitoral
              ? `<div>
                <span class="xs muted u-tt-uppercase u-fw-700">Base Eleitoral & Cidades / Bairros</span>
                <p class="u-fs-13 u-lh-1_4">${esc(p.baseEleitoral)}</p>
              </div>`
              : ''
          }
          ${
            p.areaAtuacao
              ? `<div>
                <span class="xs muted u-tt-uppercase u-fw-700">Áreas de Atuação Principal</span>
                <p class="u-fs-13 u-lh-1_4">${esc(p.areaAtuacao)}</p>
              </div>`
              : ''
          }
        </div>

        <div class="card soft stack u-gap-10 u-p-14">
          <span class="sm muted u-fw-600">Gabinete Oficial e Contatos:</span>
          <div class="grid u-cols-1fr-1fr u-gap-8">
            <div class="stat u-p-10">
              <span>Localização</span>
              <b class="u-fs-13">${esc(p.room || 'Gabinete')}</b>
              <span class="xs muted">${esc(p.house || '')}</span>
            </div>
            <div class="stat u-p-10">
              <span>Telefone</span>
              <b class="u-fs-13">${esc(p.phone || 'Contato')}</b>
              <span class="xs muted">Canal aberto ao cidadão</span>
            </div>
          </div>
          ${
            p.email
              ? `
            <div class="row between sm u-bg-s2 u-p-8-12 u-br-r-sm">
              <span class="muted">E-mail Parlamentar:</span>
              <a href="mailto:${esc(p.email)}" class="u-fw-600">${esc(p.email)}</a>
            </div>`
              : ''
          }
          ${
            safeUrl(p.pageUrl)
              ? `
            <div class="row u-mt-4">
              <a href="${esc(safeUrl(p.pageUrl))}" target="_blank" rel="noopener noreferrer" class="btn primary sm u-width-100pct u-jc-center">
                <span>Página Oficial na Casa Legislativa</span><span class="mi u-fs-15" aria-hidden="true">open_in_new</span>
              </a>
            </div>`
              : ''
          }
        </div>
        </div>
      </div>
    `
    }

    <!-- ABA TSE & ELEITORAL -->
    <div id="tab-tse" class="stack pol-pane hidden u-mt-4">
      <div class="card soft stack u-gap-12 u-p-16">
        <div class="row between">
          <span class="chip green">Registro Eleitoral Oficial no TSE (DivulgaCandContas)</span>
          <span class="xs muted">${esc(tse.status || '')}</span>
        </div>
        ${
          tse.available
            ? `
        <div class="grid u-cols-1fr-1fr u-gap-8">
          <div class="stat u-p-10">
            <span>Número na Urna</span>
            <b class="u-fs-20 u-c-primary">${esc(tse.ballotNumber)}</b>
            <span class="xs muted">Eleição de ${tse.electionYear} • ${esc(p.party || '')}</span>
          </div>
          <div class="stat u-p-10">
            <span>Patrimônio Declarado</span>
            <b class="u-fs-18">${tse.declaredAssets != null ? brl(tse.declaredAssets) : 'Não declarado'}</b>
            <span class="xs muted">Bens declarados no registro de candidatura</span>
          </div>
        </div>
        <div class="row between sm u-bg-s2 u-p-8-12 u-br-r-sm">
          <span class="muted">Coligação / Federação:</span>
          <b>${esc(tse.electoralCoalition || (tse.isolatedParty ? 'Partido isolado' : '—'))}</b>
        </div>`
            : `
        <p class="sm muted">Os dados eleitorais deste mandato não estão carregados localmente. Consulte a ficha oficial no TSE.</p>`
        }
        <p class="xs muted">Prestação de contas de campanha (arrecadação e doadores): consulte a ficha oficial no TSE.</p>
        ${safeUrl(tse.tseUrl) ? `<div class="row u-mt-4">
          <a href="${esc(safeUrl(tse.tseUrl))}" target="_blank" rel="noopener noreferrer" class="btn primary sm u-width-100pct u-jc-center">
            <span>Consultar Ficha Eleitoral no TSE (DivulgaCandContas)</span><span class="mi u-fs-15" aria-hidden="true">open_in_new</span>
          </a>
        </div>` : ''}
      </div>
    </div>
  `);

  // Alternância de abas do modal
  const tabs = el.querySelectorAll('#pol-tabs button');
  tabs.forEach((btn) => {
    btn.onclick = () => {
      tabs.forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      const targetTab = btn.dataset.tab;
      el.querySelectorAll('.pol-pane').forEach((p) => p.classList.add('hidden'));
      const activePane = el.querySelector(`#tab-${targetTab}`);
      if (activePane) activePane.classList.remove('hidden');
    };
  });
  tablist(el.querySelector('#pol-tabs'), (b) => el.querySelector(`#tab-${b.dataset.tab}`));
  bindFollow(el, p);

  const factsBox = el.querySelector('#city-facts');
  if (factsBox) {
    Promise.all([cityFacts(p.state || p.uf, p.city), loadCidades()])
      .then(async ([c, meta]) => {
        if (!c) return;
        const em = await cityEmendas(c.ibge).catch(() => null);
        factsBox.innerHTML = cityFactsHtml(c, meta.pibAno, meta.populacaoAno, em);
      })
      .catch(() => {});
  }

  if (isDeputy || isSenator) {
    const paneEmendas = el.querySelector('#tab-emendas');
    authorEmendas(p.name)
      .then((e) => (paneEmendas.innerHTML = emendasHtml(e)))
      .catch(() => (paneEmendas.innerHTML = '<p class="muted">Não foi possível carregar as emendas agora.</p>'));
  }

  if (isDeputy) {
    const paneGastos = el.querySelector('#tab-gastos');
    const paneProjetos = el.querySelector('#tab-projetos');
    const panePerfil = el.querySelector('#tab-perfil');
    const panePlenario = el.querySelector('#tab-plenario');

    // Presença e fidelidade (carrega em paralelo, sem bloquear as demais abas)
    deputyPlenaryStats(p.camaraId)
      .then((stats) => (panePlenario.innerHTML = plenaryPanelHtml(stats)))
      .catch((err) => (panePlenario.innerHTML = `<p class="muted">Não foi possível calcular agora: ${esc(err.message)}</p>`));

    // 1. Carrega Gastos CEAP
    try {
      const expenses = await deputyExpenses(p.camaraId, 80);
      if (!expenses.length) {
        paneGastos.innerHTML = '<p class="muted">Nenhum reembolso da cota parlamentar registrado nesta legislatura.</p>';
      } else {
        const total = expenses.reduce((acc, x) => acc + (x.value || 0), 0);
        const categories = {};
        for (const x of expenses) {
          categories[x.type] = (categories[x.type] || 0) + (x.value || 0);
        }
        const topCategories = Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);

        paneGastos.innerHTML = `
          <div class="card soft row between u-p-14 u-bg-primary-soft">
            <div>
              <span class="xs muted u-tt-uppercase u-fw-700">Soma dos Reembolsos Consultados</span>
              <h2 class="u-fs-22 u-c-primary u-fw-800 u-mt-2">${brl(total)}</h2>
              <span class="xs muted">Base: Últimos ${expenses.length} reembolsos registrados na Câmara</span>
            </div>
            <span class="chip green">${currentLegislatureLabel()}</span>
          </div>

          <div>
            <span class="sm muted u-fw-700">Principais Áreas de Despesa:</span>
            <div class="stack u-gap-6 u-mt-6">
              ${topCategories
                .map(
                  ([cat, val]) => `
                <div class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm">
                  <span class="muted truncate u-maxw-240">${esc(cat)}</span>
                  <b>${brl(val)}</b>
                </div>`
                )
                .join('')}
            </div>
          </div>

          <div class="row between u-mt-6">
            <span class="sm muted u-fw-700">Notas Fiscais e Recibos Recentes:</span>
            <span class="xs muted">Fonte: Câmara dos Deputados</span>
          </div>

          <div class="stack u-gap-8 u-maxh-40vh u-ovy-auto u-pr-4">
            ${expenses
              .slice(0, 20)
              .map((ex) => {
                const isHigh = (ex.value || 0) >= 3000;
                return `
                <div class="card soft stack u-gap-4 u-p-10 ${isHigh ? 'u-bl-3-solid-tertiary' : 'u-bl-none'}">
                  <div class="row between">
                    <span class="sm u-fw-600">${esc(ex.supplier || 'Fornecedor')}</span>
                    <b class="${isHigh ? 'u-c-tertiary' : 'u-c-text'}">${brl(ex.value || 0)}</b>
                  </div>
                  <div class="row between xs muted">
                    <span class="truncate u-maxw-260">${esc(ex.type)}</span>
                    <span>${fmtDate(ex.date)}</span>
                  </div>
                  ${
                    safeUrl(ex.receiptUrl)
                      ? `<div class="row u-mt-4">
                      <a href="${esc(
                        safeUrl(ex.receiptUrl)
                      )}" target="_blank" rel="noopener noreferrer" class="xs u-fw-600 u-d-inline-flex u-ai-center u-gap-4">
                        <span class="mi u-fs-14" aria-hidden="true">receipt_long</span><span>Ver Nota Fiscal / Comprovante</span>
                      </a>
                    </div>`
                      : ''
                  }
                </div>`;
              })
              .join('')}
          </div>
        `;
      }
    } catch (err) {
      paneGastos.innerHTML = `<p class="muted">Erro ao carregar despesas CEAP: ${esc(err.message)}</p>`;
    }

    // 2. Carrega Projetos de Lei
    try {
      const projects = await deputyPropositions(p.camaraId, 10);
      if (!projects.length) {
        paneProjetos.innerHTML = '<p class="muted">Nenhuma proposição autoral recente encontrada.</p>';
      } else {
        paneProjetos.innerHTML = `
          <div class="stack u-gap-10 u-maxh-55vh u-ovy-auto u-pr-4">
            ${projects
              .map(
                (item, idx) => `
              <div class="card soft stack u-gap-6 u-p-12">
                <div class="row between">
                  <span class="chip blue">${esc(item.type)} ${esc(item.number)}/${esc(item.year)}</span>
                  <span class="xs muted">${fmtDate(item.date)}</span>
                </div>
                <p class="u-fs-13 u-lh-1_4">${esc(item.summary)}</p>
                <div class="row between u-mt-4">
                  ${safeUrl(item.url) ? `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="sm u-fw-600 u-d-inline-flex u-ai-center u-gap-4">
                    <span>Ficha oficial de tramitação</span><span class="mi u-fs-14" aria-hidden="true">open_in_new</span>
                  </a>` : ''}
                  <button class="btn ghost sm btn-analyze-proj u-p-4-8 u-fs-11_5" data-index="${idx}">
                    <span class="mi u-fs-14 u-c-primary" aria-hidden="true">psychology</span>
                    <span>Scanner de Jabutis</span>
                  </button>
                </div>
              </div>`
              )
              .join('')}
          </div>
        `;

        paneProjetos.querySelectorAll('.btn-analyze-proj').forEach((b) => {
          b.onclick = () => {
            const idx = parseInt(b.dataset.index, 10);
            if (projects[idx]) openAnalysisModal(projects[idx]);
          };
        });
      }
    } catch (err) {
      paneProjetos.innerHTML = `<p class="muted">Erro ao carregar projetos: ${esc(err.message)}</p>`;
    }

    // 3. Carrega Perfil e Gabinete Oficial
    try {
      const prof = await deputyProfile(p.camaraId);
      panePerfil.innerHTML = `
        <div class="card soft stack u-gap-10 u-p-14">
          <div class="row between">
            <span class="chip green">Registro Institucional Oficial</span>
            <span class="xs muted">${esc(prof.status)}</span>
          </div>
          <div>
            <span class="xs muted u-tt-uppercase u-fw-700">Nome Civil Completo</span>
            <p class="u-fw-700 u-fs-14">${esc(prof.civilName)}</p>
          </div>
          <div class="row between sm">
            <div><span class="muted">Condição:</span> <b>${esc(prof.electoralCondition)}</b></div>
            <div><span class="muted">Escolaridade:</span> <b>${esc(prof.schooling)}</b></div>
          </div>
        </div>

        ${
          prof.cabinet
            ? `
        <div class="card soft stack u-gap-10 u-p-14">
          <span class="sm muted u-fw-700">Gabinete em Brasília:</span>
          <div class="grid u-cols-1fr-1fr u-gap-8">
            <div class="stat u-p-10">
              <span>Localização</span>
              <b class="u-fs-13">Anexo ${esc(prof.cabinet.building)}, Sala ${esc(prof.cabinet.room)}</b>
              <span class="xs muted">${esc(prof.cabinet.floor)}º Andar</span>
            </div>
            <div class="stat u-p-10">
              <span>Telefone</span>
              <b class="u-fs-13">(61) ${esc(prof.cabinet.phone || '3215-5000')}</b>
            </div>
          </div>
          ${
            prof.cabinet.email
              ? `
          <div class="row between sm u-bg-s2 u-p-8-12 u-br-r-sm">
            <span class="muted">E-mail Institucional:</span>
            <a href="mailto:${esc(prof.cabinet.email)}" class="u-fw-600">${esc(prof.cabinet.email)}</a>
          </div>`
              : ''
          }
        </div>`
            : ''
        }
      `;
    } catch (err) {
      panePerfil.innerHTML = `<p class="muted">Erro ao carregar dados do gabinete: ${esc(err.message)}</p>`;
    }
    deputyFronts(p.camaraId)
      .then((fronts) => {
        if (!fronts.length) return;
        panePerfil.insertAdjacentHTML(
          'beforeend',
          `<section class="card soft stack u-gap-8 u-p-14" aria-labelledby="fronts-title">
            <h3 class="sm u-fw-700" id="fronts-title">Frentes parlamentares (${fronts.length})</h3>
            <p class="xs muted">Grupos suprapartidários de apoio a um tema. Participar de uma frente não é voto, mas mostra os temas a que o mandato se associa.</p>
            <ul class="stack u-gap-4 sm">${fronts.map((f) => `<li>${esc(f.title)}</li>`).join('')}</ul>
          </section>`
        );
      })
      .catch(() => {});
  } else if (isSenator) {
    const paneSenator = el.querySelector('#tab-senado');
    const panePlenario = el.querySelector('#tab-plenario');
    const paneComissoes = el.querySelector('#tab-comissoes');
    const paneCota = el.querySelector('#tab-cota');
    senatorCeaps(p.senadoId)
      .then((c) => (paneCota.innerHTML = ceapsHtml(c)))
      .catch(() => (paneCota.innerHTML = '<p class="muted">Não foi possível carregar o resumo da cota agora.</p>'));
    senatorCommittees(p.senadoId)
      .then((list) => {
        paneComissoes.innerHTML = list.length
          ? `<div class="row between"><span class="chip blue">Comissões em que atua hoje (${list.length})</span><span class="xs muted">Fonte: API Senado Federal</span></div>
            <ul class="stack u-gap-8">${list
              .map(
                (c) => `<li class="card soft u-p-12 stack u-gap-4">
                  <b class="sm">${esc(c.name)}${c.acronym ? ` (${esc(c.acronym)})` : ''}</b>
                  <span class="xs muted">${esc(c.role)}${c.since ? ` · desde ${fmtDate(c.since)}` : ''}</span>
                </li>`
              )
              .join('')}</ul>`
          : '<p class="muted">Nenhuma comissão ativa registrada para este senador.</p>';
      })
      .catch(() => (paneComissoes.innerHTML = '<p class="muted">Não foi possível consultar as comissões agora.</p>'));
    senatorPlenaryStats(p.senadoId)
      .then((stats) => (panePlenario.innerHTML = plenaryPanelHtml(stats)))
      .catch((err) => (panePlenario.innerHTML = `<p class="muted">Não foi possível calcular agora: ${esc(err.message)}</p>`));
    try {
      const votes = await senatorVotes(p.senadoId, 12);
      if (!votes.length) {
        paneSenator.innerHTML = '<p class="muted">Nenhum registro recente de votação encontrado para este senador.</p>';
      } else {
        paneSenator.innerHTML = `
          <div class="row between">
            <span class="chip blue">Histórico de Votações Nominais</span>
            <span class="xs muted">Fonte: API Senado Federal</span>
          </div>
          <div class="stack u-gap-10 u-maxh-55vh u-ovy-auto u-pr-4">
            ${votes
              .map(
                (v) => `
              <div class="card soft stack u-gap-6 u-p-12">
                <div class="row between">
                  <span class="chip blue">${esc(v.matter)}</span>
                  <span class="vote ${VOTE_CLASS[v.vote] || ''}">${esc(v.vote)}</span>
                </div>
                <p class="u-fs-13 u-fw-500 u-lh-1_4">${esc(v.summary || 'Deliberação no Plenário')}</p>
                <div class="row between xs muted">
                  <span>Resultado: <b>${esc(v.result || 'Concluído')}</b></span>
                  <span>${fmtDate(v.date)}</span>
                </div>
              </div>`
              )
              .join('')}
          </div>
        `;
      }
    } catch (err) {
      paneSenator.innerHTML = `<p class="muted">Erro ao carregar dados do Senado: ${esc(err.message)}</p>`;
    }
  }
}

export function bindPoliticianActions(root) {
  root.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = () => {
      const list = store.get().politicians;
      const index = list.findIndex((x) => x.id === b.dataset.remove);
      if (index < 0) return;
      const removed = list[index];
      store.removePolitician(removed.id);
      toast(`Você deixou de acompanhar ${removed.name}.`, 'delete', {
        action: {
          label: 'Desfazer',
          onClick: () => {
            const now = store.get().politicians;
            if (now.some((x) => x.id === removed.id)) return;
            store.set({ politicians: [...now.slice(0, index), removed, ...now.slice(index)] });
          },
        },
      });
    };
  });

  root.querySelectorAll('[data-details]').forEach((b) => {
    b.onclick = () => {
      const p = store.get().politicians.find((x) => x.id === b.dataset.details);
      if (p) openPoliticianDetails(p);
    };
  });

  root.querySelectorAll('[data-dossier]').forEach((b) => {
    b.onclick = () => {
      const p = store.get().politicians.find((x) => x.id === b.dataset.dossier);
      if (p) openDossierModal(p);
    };
  });

  root.querySelectorAll('[data-share]').forEach((b) => {
    b.onclick = () => {
      const p = store.get().politicians.find((x) => x.id === b.dataset.share);
      if (p) {
        const m = mandateProgress(p);
        openShareModal({
          politician: p,
          title: 'Fiscalização de Mandato',
          highlight: `Mandato em exercício • ${partyOrBirth(p) || p.uf || 'BR'}`,
          badge: 'COLA CIDADÃ',
          badgeColor: '#176b3a',
          detailText: `Término previsto: ${m.end}`,
        });
      }
    };
  });
}

export function render(root) {
  const { politicians } = store.get();
  root.innerHTML = `
    <div class="top">
      <div>
        <span class="directory-eyebrow"><span class="mi" aria-hidden="true">bookmark_added</span>Seu acompanhamento</span>
        <h1>Quem acompanho</h1>
        <p>Atalhos para as pessoas que você escolheu acompanhar depois de ver o perfil delas. A lista fica só neste aparelho.</p>
      </div>
      <div class="row">
        <a class="btn primary" href="#/painel"><span class="mi" aria-hidden="true">account_balance</span>Painel Público</a>
      </div>
    </div>
    ${
      politicians.length
        ? `<p class="directory-count">${politicians.length} ${politicians.length === 1 ? 'pessoa acompanhada' : 'pessoas acompanhadas'}</p><div class="grid g3">${politicians.map((p) => politicianCard(p, { heading: 2 })).join('')}</div>`
        : `
      <div class="card empty">
        <span class="mi" aria-hidden="true">bookmark_add</span>
        <h2>Você ainda não acompanha ninguém</h2>
        <p>Todos os cargos estão abertos no <a href="#/painel">Painel Público</a>. Abra um perfil e toque em Acompanhar, se quiser.</p>
        <a class="btn primary" href="#/painel">Explorar o Painel Público</a>
      </div>`
    }
  `;
  bindPoliticianActions(root);
}
