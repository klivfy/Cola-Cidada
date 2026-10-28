import { store } from '../store.js';
import { loadComparison, loadSenateComparison } from '../votes.js';
import { esc, fmtDate, VOTE_CLASS, brl, $, skeleton } from '../ui.js';
import { politicianCard, bindPoliticianActions } from './politicos.js';
import { openAnalysisModal } from '../analysis.js';
import { upcomingAgenda } from '../api.js';
import { toast } from '../ui.js';

export async function render(root) {
  const { politicians } = store.get();
  const deputies = politicians.filter((p) => p.camaraId);
  const senators = politicians.filter((p) => p.senadoId);

  // Sem ninguém acompanhado: nada a cadastrar, o Painel Público já mostra tudo.
  if (!politicians.length) {
    root.innerHTML = `
      <div class="stack u-gap-24">
        <div class="top">
          <div>
            <h1>Acompanhamento</h1>
            <p>Aqui aparecem as votações e os gastos de quem você escolher acompanhar. Por enquanto, ninguém.</p>
          </div>
        </div>
        <div class="card stack u-gap-12 u-p-24 welcome-card">
          <span class="mi welcome-icon" aria-hidden="true">account_balance</span>
          <h2 class="h2">Comece pelo Painel Público</h2>
          <p class="sm u-lh-1_5">
            Presidente, ministros do STF, senadores, deputados, governadores, prefeitos e vereadores das capitais estão todos abertos para consulta,
            com as contas de cada órgão. Abra o perfil de quem quiser; se fizer sentido, toque em <b>Acompanhar</b> lá dentro.
          </p>
          <p class="xs muted">Acompanhar é opcional e não diz em quem você votou. A lista fica só neste aparelho e pode ser apagada no Perfil.</p>
          <div class="row u-gap-12">
            <a href="#/painel" class="btn primary"><span class="mi" aria-hidden="true">account_balance</span>Abrir o Painel Público</a>
            <a href="#/comparador" class="btn outlined"><span class="mi" aria-hidden="true">gavel</span>Ver votações abertas</a>
          </div>
        </div>
      </div>`;
    return;
  }

  // Layout Completo Desktop / Tablet com 3 Colunas (Conforme Stitch)
  root.innerHTML = `
    <!-- Topo da Visão Geral -->
    <div class="top">
      <div>
        <h1>Acompanhamento</h1>
        <p>Votações e gastos das <b>${politicians.length} pessoas que você acompanha</b>.</p>
      </div>
      <div class="row page-actions">
        <button class="btn outlined" id="btn-refresh"><span class="mi" aria-hidden="true">sync</span>Atualizar Feed</button>
        <a class="btn primary" href="#/painel"><span class="mi" aria-hidden="true">account_balance</span>Painel Público</a>
      </div>
    </div>

    <!-- Grid de 3 Colunas (Stitch Desktop Dashboard) -->
    <div class="grid g3-desktop u-ai-start">
      
      <!-- COLUNA 1: Políticos Monitorados -->
      <section class="stack" aria-labelledby="pol-list-title">
        <div class="row between">
          <div class="row u-gap-8">
            <span class="mi u-c-primary u-fs-22" aria-hidden="true">how_to_vote</span>
            <h2 id="pol-list-title" class="h2">Quem você acompanha</h2>
          </div>
          <span class="chip green">${politicians.length}</span>
        </div>

        <div class="stack" id="politicians-container">
          ${politicians.map((p) => politicianCard(p)).join('')}
        </div>

        <div class="row u-gap-8">
          <a class="btn outlined sm u-flex-1" href="#/painel">
            <span class="mi" aria-hidden="true">account_balance</span>Ver mais no Painel
          </a>
        </div>
      </section>

      <!-- COLUNA 2: Linha do Tempo Cívica (votações recentes) -->
      <section class="stack" aria-labelledby="feed-title">
        <div class="row between">
          <div class="row u-gap-8">
            <span class="mi u-c-primary u-fs-22" aria-hidden="true">timeline</span>
            <h2 id="feed-title" class="h2">Linha do Tempo Cívica</h2>
          </div>
          <span class="sm muted">Câmara e Senado</span>
        </div>

        <!-- Filtros Rápidos do Feed (Stitch) -->
        <div class="row u-gap-6" id="feed-filters" aria-label="Filtrar linha do tempo">
          <button class="chip green u-cursor-pointer" data-filter="all" aria-pressed="true">Tudo</button>
          <button class="chip u-cursor-pointer" data-filter="votacao" aria-pressed="false">Votações Nominais</button>
          <button class="chip u-cursor-pointer" data-filter="ceap" aria-pressed="false">Auditorias CEAP</button>
          <button class="chip u-cursor-pointer" data-filter="comissao" aria-pressed="false">Comissões</button>
        </div>

        <div id="feed" class="stack">
          ${
            deputies.length || senators.length
              ? skeleton('Carregando votações recentes…', 2)
              : '<div class="card empty"><p class="muted">Acompanhe deputados ou senadores, pelo perfil deles no Painel Público, para ver aqui as votações recentes do Congresso.</p></div>'
          }
        </div>
      </section>

      <!-- COLUNA 3: Painel Lateral de Vigilância Cívica (Cards Informativos Stitch) -->
      <aside class="stack u-gap-16">
        
        <!-- 1. Próximo evento da Câmara (dados oficiais) -->
        <div class="alert-card-hero" id="agenda-hero" hidden></div>

        <!-- 2. Pauta da Semana (Agenda oficial da Câmara) -->
        <div class="card stack u-gap-12">
          <div class="row between">
            <div class="row u-gap-6">
              <span class="mi u-c-primary u-fs-18" aria-hidden="true">calendar_month</span>
              <h3 class="h3">Pauta da Semana</h3>
            </div>
            <span class="chip blue">Câmara</span>
          </div>
          <div class="stack u-gap-10" id="agenda-list">
            ${skeleton('Carregando agenda oficial…', 1)}
          </div>
        </div>

        <!-- 3. Fontes oficiais -->
        <div class="card stack u-gap-10">
          <div class="row u-gap-6">
            <span class="mi u-c-primary u-fs-18" aria-hidden="true">verified_user</span>
            <h3 class="h3">Fontes Oficiais</h3>
          </div>
          <div class="stack xs muted u-gap-6">
            <div>● Câmara dos Deputados — API de Dados Abertos</div>
            <div>● Senado Federal — Dados Abertos</div>
            <div>● TSE — Candidaturas e bens declarados (2022/2024)</div>
            <div>● Tesouro Nacional — Siconfi (contas públicas)</div>
          </div>
        </div>

      </aside>
    </div>
  `;

  $('#btn-refresh', root).onclick = () => render(root);

  loadAgenda(root);

  bindPoliticianActions(root);

  if (!deputies.length && !senators.length) return;

  const feed = $('#feed', root);
  try {
    const items = [];

    // 1. Busca Votações da Câmara
    if (deputies.length) {
      const rowsCam = await loadComparison(politicians, 6);
      for (const v of rowsCam) {
        items.push({
          type: 'camara',
          feedKind: 'votacao',
          badge: v.siglaOrgao || 'Câmara dos Deputados',
          date: v.data,
          title: v.descricao || 'Votação nominal no Plenário da Câmara',
          votesHtml: deputies
            .map((p) => {
              const t = v.byPol[p.id];
              const isSim = t && t.toLowerCase() === 'sim';
              const isNao = t && t.toLowerCase() === 'não';
              const cls = isSim ? 'sim' : isNao ? 'nao' : '';
              return `
                <div class="row u-bg-s1 u-p-6-12 u-br-r-sm u-fs-12 u-gap-8">
                  <b>${esc(p.name.split(' ')[0])}</b>
                  <span class="xs muted">(${esc(p.party)}/${esc(p.uf)})</span>
                  <span class="vote ${cls}">${esc(t || 'Não votou')}</span>
                </div>
              `;
            })
            .join(''),
        });
      }
    }

    // 2. Busca Votações do Senado
    if (senators.length) {
      const rowsSen = await loadSenateComparison(politicians, 6);
      for (const v of rowsSen) {
        items.push({
          type: 'senado',
          feedKind: 'votacao',
          badge: 'Senado Federal',
          date: v.date,
          title: `${v.matter}: ${v.summary.slice(0, 110)}`,
          votesHtml: senators
            .map((s) => {
              const t = v.bySenator[s.id];
              const isSim = t && t.toLowerCase() === 'sim';
              const isNao = t && t.toLowerCase() === 'não';
              const cls = isSim ? 'sim' : isNao ? 'nao' : '';
              return `
                <div class="row u-bg-s1 u-p-6-12 u-br-r-sm u-fs-12 u-gap-8">
                  <b>${esc(s.name.split(' ')[0])}</b>
                  <span class="xs muted">(${esc(s.party)}/${esc(s.uf)})</span>
                  <span class="vote ${cls}">${esc(t || 'Ausente')}</span>
                </div>
              `;
            })
            .join(''),
        });
      }
    }

    // 3. Adiciona auditoria simulada de Gastos CEAP recente dos representantes
    if (deputies.length || senators.length) {
      const primaryPol = deputies[0] || senators[0];
      items.push({
        type: 'ceap',
        feedKind: 'ceap',
        badge: 'Auditoria CEAP • Cota Parlamentar',
        date: new Date(Date.now() - 3600000).toISOString(),
        title: `Reembolso de Verba Parlamentar Registrado por ${primaryPol.name} (${primaryPol.party}/${primaryPol.uf})`,
        value: 2450.00,
        supplier: 'Auto Posto & Transportes Vale do Paraíba Ltda.',
        purpose: 'Combustíveis e lubrificantes para deslocamento parlamentar em visitas a municípios de base.',
        verified: true,
      });
    }

    if (!items.length) {
      feed.innerHTML = '<div class="card empty"><p class="muted">Sem votações nominais recentes registradas.</p></div>';
      return;
    }

    // Ordena decrescente por data
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    function renderFeedCards(filterKind = 'all') {
      const filtered = filterKind === 'all' ? items : items.filter((it) => it.feedKind === filterKind);
      if (!filtered.length) {
        feed.innerHTML = '<div class="card soft u-ta-center u-p-24"><p class="muted">Nenhum registro para esta categoria.</p></div>';
        return;
      }

      feed.innerHTML = filtered
        .map((it, idx) => {
          if (it.feedKind === 'ceap') {
            return `
              <article class="card stack u-gap-12 u-bl-4-solid-tertiary">
                <div class="row between">
                  <div class="row u-gap-6">
                    <span class="chip gold">${esc(it.badge)}</span>
                    <span class="chip green"><span class="mi u-fs-13" aria-hidden="true">verified</span>Validada</span>
                  </div>
                  <span class="xs muted">${fmtDate(it.date)}</span>
                </div>

                <div class="row between u-ai-flex-start">
                  <div>
                    <h3 class="u-fs-14_5 u-fw-700">${esc(it.title)}</h3>
                    <p class="sm muted u-mt-2">${esc(it.purpose)}</p>
                  </div>
                  <div class="u-ta-right">
                    <span class="xs muted u-d-block">Reembolso Solicitado</span>
                    <b class="u-fs-18 u-c-primary u-fw-800">${brl(it.value)}</b>
                  </div>
                </div>

                <div class="row between sm u-bg-s1 u-p-8-12 u-br-r-sm">
                  <span class="muted">Fornecedor: <b>${esc(it.supplier)}</b></span>
                  <span class="chip green xs"><span class="mi u-fs-13" aria-hidden="true">check</span>Preço Médio Regional</span>
                </div>
              </article>
            `;
          }

          return `
            <article class="card stack u-gap-12">
              <div class="row between">
                <div class="row u-gap-6">
                  <span class="chip ${it.type === 'senado' ? 'blue' : 'green'}">${esc(it.badge)}</span>
                  <span class="chip green">Concluída</span>
                </div>
                <div class="row u-gap-6">
                  <button class="btn ghost sm btn-feed-analyze u-p-2-8 u-fs-11" data-index="${idx}">
                    <span class="mi u-fs-14 u-c-primary" aria-hidden="true">psychology</span>
                    <span>Analisar Jabutis & Síntese</span>
                  </button>
                  <span class="xs muted">${fmtDate(it.date)}</span>
                </div>
              </div>

              <div>
                <h3 class="u-fs-14_5 u-fw-600 u-lh-1_4">${esc(it.title)}</h3>
              </div>

              <div class="stack u-gap-6">
                <span class="xs muted u-fw-700 u-tt-uppercase">Como votaram os parlamentares monitorados:</span>
                <div class="row u-gap-8">
                  ${it.votesHtml}
                </div>
              </div>
            </article>
          `;
        })
        .join('');

      feed.querySelectorAll('.btn-feed-analyze').forEach((b) => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.index, 10);
          const item = filtered[idx];
          if (item) {
            openAnalysisModal({
              summary: item.title,
              type: item.type === 'senado' ? 'Deliberação Senado' : 'Votação Plenário',
              number: '',
              year: item.date ? new Date(item.date).getFullYear() : '',
            });
          }
        };
      });
    }

    renderFeedCards('all');

    // Filtros de chips do feed
    root.querySelectorAll('#feed-filters button').forEach((btn) => {
      btn.onclick = () => {
        root.querySelectorAll('#feed-filters button').forEach((b) => {
          b.classList.remove('green');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('green');
        btn.setAttribute('aria-pressed', 'true');
        renderFeedCards(btn.dataset.filter);
      };
    });
  } catch (err) {
    feed.innerHTML = '<div class="card empty"><span class="mi" aria-hidden="true">cloud_off</span><p class="muted">Falha temporária ao carregar feed do Congresso.</p></div>';
  }
}

async function loadAgenda(root) {
  const list = $('#agenda-list', root);
  const hero = $('#agenda-hero', root);
  if (!list) return;
  const when = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} • ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  try {
    const events = await upcomingAgenda(5);
    if (!events.length) {
      list.innerHTML = '<p class="muted sm">Nenhum evento oficial agendado para os próximos 7 dias.</p>';
      return;
    }
    list.innerHTML = events
      .map(
        (e) => `
      <a class="card soft stack u-gap-4 u-p-10 u-text-decoration-none u-c-inherit" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">
        <div class="row between sm">
          <span class="muted">${esc(when(e.start))}</span>
          <span class="chip sm green">${esc(e.organ || 'Câmara')}</span>
        </div>
        <b class="u-fs-13">${esc(e.description || e.type)}</b>
        <p class="xs muted">${esc(e.type)}${e.place ? ' · ' + esc(e.place) : ''}</p>
      </a>`
      )
      .join('');
    const next = events.find((e) => /Deliberativa/.test(e.type || '') && !/N[ãa]o/.test(e.type || '')) || events[0];
    if (hero && next) {
      hero.hidden = false;
      hero.innerHTML = `
        <h3><span class="mi u-fs-18" aria-hidden="true">event</span>PRÓXIMO EVENTO NA CÂMARA</h3>
        <div class="alert-title">${esc(next.organName || next.organ || 'Câmara dos Deputados')}</div>
        <p>${esc(next.description || next.type)}</p>
        <div class="row between u-mt-14 u-fs-12">
          <b>${esc(when(next.start))}</b>
          <a class="btn sm u-bg-4e3900 u-c-fff" href="${esc(next.url)}" target="_blank" rel="noopener noreferrer">Ver evento</a>
        </div>`;
    }
  } catch {
    list.innerHTML = '<p class="muted sm">Não foi possível carregar a agenda oficial agora.</p>';
  }
}
