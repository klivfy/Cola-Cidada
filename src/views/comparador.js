import { store } from '../store.js';
import { recentProvisionalMeasures } from '../api.js';
import { loadComparison, loadSenatePublic, partyBreakdown } from '../votes.js';
import { avatar, esc, fmtDate, VOTE_CLASS, brl, toast, tablist, $, skeleton } from '../ui.js';
import { openGlossaryModal } from '../glossary.js';
import { openShareModal } from '../share.js';
import { openAnalysisModal } from '../analysis.js';
import { safeUrl } from '../urls.js';

const VOTE_TONE = (t) => (t === 'Sim' ? 'sim' : t === 'Não' ? 'nao' : 'abstencao');

function allVotesDetails(house, i, count) {
  const who = house === 'camara' ? 'deputado' : 'senador';
  return `
    <details class="vote-details" data-house="${house}" data-i="${i}">
      <summary>Ver como votou cada partido e cada ${who} (${count})</summary>
      <div class="vote-details-body"></div>
    </details>`;
}

function allVotesBody(votes, house, i) {
  const parties = partyBreakdown(votes);
  const sorted = [...votes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return `
    <div class="table-wrap" tabindex="0" role="region" aria-label="Votos por partido">
      <table class="party-table">
        <caption class="sr-only">Votos por partido</caption>
        <thead><tr><th scope="col">Partido</th><th scope="col">Sim</th><th scope="col">Não</th><th scope="col">Outros</th></tr></thead>
        <tbody>${parties
          .map((p) => `<tr><th scope="row">${esc(p.party)}</th><td>${p.Sim}</td><td>${p.Não}</td><td>${p.Outros}</td></tr>`)
          .join('')}</tbody>
      </table>
    </div>
    <label class="label" for="vote-q-${house}-${i}">Procurar ${house === 'camara' ? 'deputado' : 'senador'} nesta votação</label>
    <input class="input vote-q" id="vote-q-${house}-${i}" type="search" autocomplete="off">
    <ul class="vote-list" tabindex="0" aria-label="Voto de cada ${house === 'camara' ? 'deputado' : 'senador'}">${sorted
      .map(
        (v) => `<li data-name="${esc(`${v.name} ${v.party} ${v.uf}`.toLowerCase())}">
          <span>${esc(v.name)} <span class="xs muted">${esc(v.party)}/${esc(v.uf)}</span></span>
          <span class="vote ${VOTE_TONE(v.vote)}">${esc(v.vote)}</span></li>`
      )
      .join('')}</ul>`;
}

function camaraVotingCard(v, deputies, i) {
  const total = (v.tally.Sim || 0) + (v.tally.Não || 0) + (v.tally.Outros || 0) || 1;
  const pctSim = (((v.tally.Sim || 0) / total) * 100).toFixed(1);
  const pctNao = (((v.tally.Não || 0) / total) * 100).toFixed(1);
  const isAprov = v.aprovacao === 1;

  return `
  <article class="card stack u-gap-14" data-text="${esc((v.descricao || '').toLowerCase())}" data-category="${v.category || 'geral'}">
    <div class="row between">
      <div class="row u-gap-8">
        <span class="chip blue">${esc(v.siglaOrgao || 'Câmara dos Deputados')}</span>
        <span class="chip ${isAprov ? 'green' : 'red'}">${isAprov ? 'Aprovada' : 'Rejeitada'}</span>
        <span class="chip xs">Votação nominal</span>
      </div>
      <span class="xs muted">${fmtDate(v.data)}</span>
    </div>

    <div>
      <h2 class="u-fs-16 u-fw-700 u-lh-1_35">${esc(v.descricao || 'Votação nominal no Plenário')}</h2>
    </div>

    <!-- Barra de Quórum Oficial MD3 -->
    <div class="card soft stack u-gap-6 u-p-12">
      <div class="row between xs u-fw-700">
        <span class="u-c-primary">SIM: ${v.tally.Sim || 0} (${pctSim}%)</span>
        <span class="u-c-error">NÃO: ${v.tally.Não || 0} (${pctNao}%)</span>
        <span class="muted">Outros / Abstenção: ${v.tally.Outros || 0}</span>
      </div>
      <div class="quorum-bar">
        <i class="sim-part" data-w="${pctSim}"></i>
        <i class="nao-part" data-w="${pctNao}"></i>
        <i class="abs-part" data-w="${(100 - pctSim - pctNao).toFixed(1)}"></i>
      </div>
    </div>

    ${allVotesDetails('camara', i, v.votes.length)}

    ${
      deputies.length
        ? `
      <div class="stack u-gap-8">
        <span class="xs muted u-fw-700 u-tt-uppercase">Quem você acompanha:</span>
        <div class="grid u-cols-f3095c u-gap-8">
          ${deputies
            .map((p) => {
              const t = v.byPol[p.id];
              const isSim = t && t.toLowerCase() === 'sim';
              const isNao = t && t.toLowerCase() === 'não';
              const voteCls = isSim ? 'sim' : isNao ? 'nao' : 'abstencao';

              return `
              <div class="card soft row between sm u-p-10-12 u-br-r-md u-bg-s2">
                <div class="row nowrap u-gap-10">
                  ${avatar(p, 'sm')}
                  <div>
                    <b class="u-fs-13">${esc(p.name.split(' ').slice(0, 2).join(' '))}</b><br>
                    <span class="xs muted">${esc(p.party)}/${esc(p.uf)}</span>
                  </div>
                </div>
                <div class="u-ta-right">
                  <span class="vote ${voteCls}">${t ? esc(t) : 'Sem registro de voto'}</span>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>`
        : ''
    }
  </article>`;
}

function senadoVotingCard(v, senators, i) {
  const isAprov = (v.result || '').toLowerCase().includes('aprov');

  return `
  <article class="card stack u-gap-14" data-text="${esc((v.matter + ' ' + v.summary).toLowerCase())}" data-category="${v.category || 'geral'}">
    <div class="row between">
      <div class="row u-gap-8">
        <span class="chip blue">${esc(v.matter)}${v.round ? ` (${esc(v.round)})` : ''}</span>
        <span class="chip ${isAprov ? 'green' : 'gold'}">${esc(v.result || 'Deliberado')}</span>
        <span class="chip xs">Senado Federal</span>
      </div>
      <span class="xs muted">${fmtDate(v.date)}</span>
    </div>

    <div>
      <h2 class="u-fs-16 u-fw-700 u-lh-1_35">${esc(v.summary || 'Deliberação no Senado Federal')}</h2>
    </div>

    ${
      v.yes > 0 || v.no > 0
        ? `
      <div class="card soft stack u-gap-6 u-p-12">
        <div class="row between xs u-fw-700">
          <span class="u-c-primary">SIM: ${v.yes}</span>
          <span class="u-c-error">NÃO: ${v.no}</span>
          <span class="muted">Resultado: ${esc(v.result || 'Concluído')}</span>
        </div>
        <div class="quorum-bar">
          <i class="sim-part" data-w="${Math.round((v.yes / (v.yes + v.no || 1)) * 100)}"></i>
          <i class="nao-part" data-w="${Math.round((v.no / (v.yes + v.no || 1)) * 100)}"></i>
        </div>
      </div>`
        : ''
    }

    ${v.secret ? '<p class="sm muted">Votação secreta: a lista mostra quem votou, não como votou.</p>' : ''}
    ${allVotesDetails('senado', i, v.votes.length)}

    ${senators.length ? `<div class="stack u-gap-8">
      <span class="xs muted u-fw-700 u-tt-uppercase">Quem você acompanha:</span>
      <div class="grid u-cols-f3095c u-gap-8">
        ${senators
          .map((s) => {
            const vote = v.bySenator[s.id];
            const isSim = vote && vote.toLowerCase() === 'sim';
            const isNao = vote && vote.toLowerCase() === 'não';
            const voteCls = isSim ? 'sim' : isNao ? 'nao' : 'abstencao';

            return `
            <div class="card soft row between sm u-p-10-12 u-br-r-md u-bg-s2">
              <div class="row nowrap u-gap-10">
                ${avatar(s, 'sm')}
                <div>
                  <b class="u-fs-13">${esc(s.name.split(' ').slice(0, 2).join(' '))}</b><br>
                  <span class="xs muted">${esc(s.party)}/${esc(s.uf)} • Senador</span>
                </div>
              </div>
              <span class="vote ${voteCls}">${vote ? esc(vote) : 'Sem registro de voto'}</span>
            </div>`;
          })
          .join('')}
      </div>
    </div>` : ''}
  </article>`;
}

function mpvCard(m) {
  return `
  <article class="card stack u-gap-12" data-text="${esc((m.number + ' ' + m.summary).toLowerCase())}" data-category="executivo">
    <div class="row between">
      <div class="row u-gap-8">
        <span class="chip gold">Medida Provisória (Executivo)</span>
        <span class="chip blue">MPV ${esc(m.number)}/${esc(m.year)}</span>
      </div>
      <span class="xs muted">${m.date ? fmtDate(m.date) : ''}</span>
    </div>
    <h3 class="u-fw-700 u-fs-14_5 u-lh-1_4">${esc(m.summary)}</h3>
    
    <div class="card soft stack u-gap-6 u-p-12 u-bg-s2">
      <div class="row between xs">
        <span class="muted">Competência:</span>
        <b>Presidência da República (Art. 62 da CF/88)</b>
      </div>
      <div class="row between xs">
        <span class="muted">Prazo Constitucional:</span>
        <span>Vigência de 60 dias (prorrogável por mais 60 dias)</span>
      </div>
    </div>

    <div class="row">
      ${safeUrl(m.url) ? `<a href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer" class="btn primary sm u-fw-600">
        <span>Acompanhar Tramitação na Câmara</span><span class="mi u-fs-14" aria-hidden="true">open_in_new</span>
      </a>` : ''}
    </div>
  </article>`;
}

export async function render(root) {
  const { politicians } = store.get();
  const deputies = politicians.filter((p) => p.camaraId);
  const senators = politicians.filter((p) => p.senadoId);

  root.innerHTML = `
    <!-- Top Header do Comparador (Estilo Stitch) -->
    <div class="top">
      <div>
        <div class="row u-gap-8 u-mb-4">
          <span class="chip blue xs">VOTAÇÕES NOMINAIS</span>
          <span class="xs muted">Plenários da Câmara e do Senado</span>
        </div>
        <h1>Comparador Cívico de Votações</h1>
        <p>Votações nominais recentes da Câmara e do Senado, abertas: placar, voto por partido e voto de cada parlamentar. Quem você acompanha aparece em destaque.</p>
      </div>
      <div class="row page-actions">
        <button class="btn outlined" id="btn-glossary"><span class="mi" aria-hidden="true">menu_book</span>Glossário Cívico</button>
        <a class="btn primary" href="#/painel"><span class="mi" aria-hidden="true">account_balance</span>Painel Público</a>
      </div>
    </div>

    <!-- Galeria Horizontal: Bancada Monitorada (Conforme Stitch) -->
    ${
      politicians.length
        ? `
      <div class="card stack u-gap-12 u-mb-16 u-p-16">
        <div class="row between">
          <div class="row u-gap-8">
            <span class="mi u-c-primary u-fs-20" aria-hidden="true">group</span>
            <b class="u-fs-14">Bancada Monitorada (${politicians.length} Representantes)</b>
          </div>
        </div>

        <div class="row u-gap-12 u-ovx-auto u-pb-6 u-fwrap-nowrap" data-edge-fade tabindex="0" role="region" aria-label="Bancada monitorada (rolagem horizontal)">
          ${politicians
            .map((p) => {
              return `
              <div class="card soft row nowrap sm u-p-8-12 u-br-r-md u-minw-210 u-gap-10">
                ${avatar(p, 'sm')}
                <div class="u-flex-1 u-overflow-hidden">
                  <b class="truncate u-d-block u-fs-12_5">${esc(p.name)}</b>
                  <span class="xs muted">${esc(p.party)}/${esc(p.uf)}</span>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>`
        : ''
    }

    <!-- Barra de Filtros Legislativos (Stitch) -->
    <div class="card soft stack u-mb-18 u-p-16 u-gap-12">
      <div class="row between">
        <div class="tabs" id="house-tabs" aria-label="Casa legislativa">
          <button class="on" data-house="camara">Câmara dos Deputados</button>
          <button data-house="senado">Senado Federal</button>
          <button data-house="executivo">Atos do Executivo & Emendas</button>
          <button data-house="confronto">Confronto 1 vs 1</button>
        </div>
        <div class="u-flex-1 u-maxw-320">
          <input class="input u-p-8-12 u-fs-13" id="search-filter" aria-label="Buscar votações por palavra-chave ou tema" placeholder="Buscar por palavra-chave ou tema…">
        </div>
      </div>

      <!-- Chips Temáticos -->
      <div class="row u-gap-6" id="theme-chips" aria-label="Filtrar por tema">
        <button class="chip green u-cursor-pointer" data-filter="all" aria-pressed="true">Todas as Matérias</button>
        <button class="chip u-cursor-pointer" data-filter="economia">Economia & Tributos</button>
        <button class="chip u-cursor-pointer" data-filter="tecnologia">Tecnologia & Dados</button>
        <button class="chip u-cursor-pointer" data-filter="social-saude">Social & Saúde</button>
        <button class="chip u-cursor-pointer" data-filter="meio-ambiente">Meio Ambiente & Terras</button>
        <button class="chip u-cursor-pointer" data-filter="seguranca">Segurança</button>
      </div>
    </div>

    <!-- PANE CÂMARA -->
    <div id="camara-pane" class="stack">
      <div id="camara-list" class="stack">${skeleton('Carregando votações da Câmara dos Deputados…', 2)}</div>
    </div>

    <!-- PANE SENADO -->
    <div id="senado-pane" class="stack hidden">
      <div id="senado-list" class="stack">${skeleton('Carregando votações do Senado Federal…', 2)}</div>
    </div>

    <!-- PANE EXECUTIVO & EMENDAS PIX -->
    <div id="executivo-pane" class="stack hidden">
      <!-- Guia de Emendas Pix -->
      <div class="card stack u-gap-14 u-p-20 u-bl-4-solid-primary">
        <div class="row between">
          <div class="row u-gap-10">
            <span class="mi u-c-primary u-fs-26" aria-hidden="true">account_balance_wallet</span>
            <div>
              <h3 class="h2 u-fs-16">Guia Cívico: Emendas Orçamentárias & "Emendas Pix"</h3>
              <span class="xs muted">Emenda Constitucional 105/2019 • Transferências Especiais</span>
            </div>
          </div>
          <span class="chip green">Orçamento da União</span>
        </div>
        <p class="u-fs-13_5 u-lh-1_55">
          As <b>Emendas Parlamentares</b> permitem que deputados e senadores direcionem fatias do Orçamento Geral da União (OGU) diretamente para seus municípios de base. Nas <b>Emendas Pix</b>, os recursos caem direto na conta corrente municipal sem celebração prévia de convênio formal, exigindo controle social rigoroso dos tribunais de contas (TCU e TCEs) e dos cidadãos locais.
        </p>
        
        <div class="grid g3 u-gap-10">
          <div class="stat u-p-12">
            <span>Agilidade vs Controle</span>
            <b class="u-fs-14">Sem Convênio Prévio</b>
            <span class="xs muted">O recurso cai direto na conta corrente municipal</span>
          </div>
          <div class="stat u-p-12">
            <span>Fiscalização</span>
            <b class="u-fs-14">TCU, CGU & TCEs</b>
            <span class="xs muted">Obrigação de plano de trabalho e transparência ativa</span>
          </div>
          <div class="stat u-p-12">
            <span>Destinação Vedada</span>
            <b class="u-fs-14">Proibido Pessoal & Dívida</b>
            <span class="xs muted">Mínimo de 70% em investimento público estruturante</span>
          </div>
        </div>

        <div class="row between u-bg-s1 u-p-12-16 u-br-r-md u-mt-4">
          <div>
            <b class="u-fs-13">Como fiscalizar as emendas enviadas à sua cidade?</b>
            <p class="xs muted">Consulte os portais oficiais de transparência orçamentária do Governo Federal e do Congresso:</p>
          </div>
          <div class="row u-gap-8">
            <a href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noopener noreferrer" class="btn sm primary">
              <span>Portal da Transparência</span><span class="mi u-fs-13" aria-hidden="true">open_in_new</span>
            </a>
            <a href="https://www12.senado.leg.br/orcamento/sigabrasil" target="_blank" rel="noopener noreferrer" class="btn sm outlined">
              <span>Siga Brasil (Senado)</span><span class="mi u-fs-13" aria-hidden="true">open_in_new</span>
            </a>
          </div>
        </div>
      </div>

      <div class="row between u-mt-10">
        <h3 class="h2 u-fs-16">Medidas Provisórias em Tramitação (Atos do Poder Executivo)</h3>
        <span class="xs muted">Fonte: API de Dados Abertos da Câmara dos Deputados</span>
      </div>

      <div id="mpv-list" class="stack">
        ${skeleton('Carregando Medidas Provisórias…', 2)}
      </div>
    </div>

    <!-- PANE CONFRONTO 1 VS 1 -->
    <div id="confronto-pane" class="stack hidden">
      <div class="card stack u-gap-16 u-p-20">
        <div class="row between">
          <div>
            <h3 class="h2 u-fs-16">Matriz de Convergência & Confronto Direto 1 vs 1</h3>
            <p class="sm muted">Escolha dois deputados federais quaisquer para comparar os votos nas votações nominais recentes e ver o grau de alinhamento.</p>
          </div>
          <span class="chip blue">Inteligência Cívica</span>
        </div>

        <div id="confronto-form" class="stack u-gap-14">${skeleton('Carregando a lista de deputados das votações recentes…', 1)}</div>
      </div>
    </div>
  `;

  $('#btn-glossary', root).onclick = () => openGlossaryModal();

  // Tabs do Comparador
  const tabButtons = root.querySelectorAll('#house-tabs button');
  const camaraPane = $('#camara-pane', root);
  const senadoPane = $('#senado-pane', root);
  const executivoPane = $('#executivo-pane', root);
  const confrontoPane = $('#confronto-pane', root);

  let mpvLoaded = false;

  async function loadMpvList() {
    if (mpvLoaded) return;
    const mpvContainer = $('#mpv-list', root);
    try {
      const mpvs = await recentProvisionalMeasures(10);
      mpvContainer.innerHTML = mpvs.length
        ? mpvs.map(mpvCard).join('')
        : '<div class="card empty"><p class="muted">Nenhuma Medida Provisória recente encontrada.</p></div>';
      mpvLoaded = true;
    } catch {
      mpvContainer.innerHTML =
        '<div class="card empty"><span class="mi" aria-hidden="true">cloud_off</span><p class="muted">Falha temporária ao consultar Medidas Provisórias.</p></div>';
    }
  }

  async function computeConfrontation() {
    const resEl = $('#confronto-results', root);
    if (!resEl) return;
    const selA = $('#sel-pol-a', root)?.value;
    const selB = $('#sel-pol-b', root)?.value;
    if (!selA || !selB || selA === selB) {
      resEl.innerHTML = '<div class="card soft sm u-p-14"><span class="mi u-c-secondary u-fs-18" aria-hidden="true">info</span> Selecione dois parlamentares diferentes para comparar.</div>';
      return;
    }

    const rows = await camaraRows;
    const nameOf = (id) => rows.flatMap((r) => r.votes).find((x) => String(x.id) === id);
    const polA = nameOf(selA);
    const polB = nameOf(selB);
    if (!polA || !polB) return;

    try {
      let matches = 0;
      let diffs = 0;
      const commonVotes = [];

      for (const row of rows) {
        const vA = row.votes.find((x) => String(x.id) === selA)?.vote;
        const vB = row.votes.find((x) => String(x.id) === selB)?.vote;
        if (vA && vB) {
          const isSame = vA.toLowerCase() === vB.toLowerCase();
          if (isSame) matches++;
          else diffs++;
          commonVotes.push({
            matter: row.descricao || 'Votação no Plenário',
            date: row.data,
            voteA: vA,
            voteB: vB,
            isSame,
          });
        }
      }

      const total = matches + diffs;
      const pct = total > 0 ? Math.round((matches / total) * 100) : 0;

      resEl.innerHTML = `
        <div class="card soft stack u-gap-12 u-p-18 u-bg-primary-soft">
          <div class="row between">
            <div>
              <span class="xs muted u-tt-uppercase u-fw-700">Taxa de Convergência Cívica</span>
              <h2 class="u-fs-28 u-c-primary u-fw-800 u-mt-2">${pct}% de Alinhamento</h2>
              <span class="xs muted">Base: ${total} votações simultâneas (${matches} votos iguais, ${diffs} divergentes)</span>
            </div>
            <button class="btn primary sm" id="btn-share-confronto"><span class="mi" aria-hidden="true">share</span>Card Social</button>
          </div>
          <div class="bar u-height-10 u-m-4-0"><i data-w="${pct}"></i></div>
        </div>

        <div class="stack u-gap-8 u-mt-10">
          <h4 class="xs muted u-tt-uppercase u-fw-700">Histórico de Votos Lado a Lado:</h4>
          ${
            commonVotes.length
              ? commonVotes
                  .map(
                    (cv) => `
            <div class="card soft stack u-gap-6 u-p-12 ${cv.isSame ? 'u-bl-3-solid-primary' : 'u-bl-3-solid-error'}">
              <div class="row between xs">
                <span class="chip ${cv.isSame ? 'green' : 'red'}">${cv.isSame ? 'Votos Coincidentes' : 'Divergência'}</span>
                <span class="muted">${fmtDate(cv.date)}</span>
              </div>
              <p class="u-fs-13_5 u-fw-600">${esc(cv.matter)}</p>
              <div class="grid u-cols-1fr-1fr u-gap-8 u-mt-4">
                <div class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm">
                  <span class="truncate u-maxw-140"><b>${esc(polA.name.split(' ')[0])}:</b></span>
                  <span class="vote ${VOTE_CLASS[cv.voteA] || ''}">${esc(cv.voteA)}</span>
                </div>
                <div class="row between sm u-bg-s2 u-p-6-12 u-br-r-sm">
                  <span class="truncate u-maxw-140"><b>${esc(polB.name.split(' ')[0])}:</b></span>
                  <span class="vote ${VOTE_CLASS[cv.voteB] || ''}">${esc(cv.voteB)}</span>
                </div>
              </div>
            </div>`
                  )
                  .join('')
              : '<p class="muted">Nenhuma votação simultânea recente localizada para esses parlamentares.</p>'
          }
        </div>
      `;

      const btnShareConf = $('#btn-share-confronto', resEl);
      if (btnShareConf) {
        btnShareConf.onclick = () => {
          openShareModal({
            politician: { name: polA.name, party: polA.party, uf: polA.uf },
            title: 'Confronto Cívico 1 vs 1',
            highlight: `${polA.name} vs ${polB.name}: ${pct}% de alinhamento em votações`,
            badge: `${pct}% CONVERGÊNCIA`,
            badgeColor: pct >= 50 ? '#176b3a' : '#ba1a1a',
            detailText: `${matches} votos coincidentes • ${diffs} divergentes`,
          });
        };
      }
    } catch (err) {
      resEl.innerHTML = `<p class="muted">Erro no cálculo de confronto: ${esc(err.message)}</p>`;
    }
  }


  tabButtons.forEach((btn) => {
    btn.onclick = () => {
      tabButtons.forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      const house = btn.dataset.house;
      camaraPane.classList.toggle('hidden', house !== 'camara');
      senadoPane.classList.toggle('hidden', house !== 'senado');
      executivoPane.classList.toggle('hidden', house !== 'executivo');
      confrontoPane.classList.toggle('hidden', house !== 'confronto');
      if (house === 'executivo') loadMpvList();
      if (house === 'confronto') computeConfrontation();
    };
  });
  tablist($('#house-tabs', root), (b) => $(`#${b.dataset.house}-pane`, root));

  // Filtros combinados
  let activeTheme = 'all';
  const filterInput = $('#search-filter', root);

  function applyFilters() {
    const q = filterInput.value.toLowerCase().trim();
    root.querySelectorAll('#camara-list article, #senado-list article, #mpv-list article').forEach((card) => {
      const txt = card.dataset.text || '';
      const cat = card.dataset.category || 'geral';
      const matchText = !q || txt.includes(q);
      const matchTheme = activeTheme === 'all' || cat === activeTheme;
      card.style.display = matchText && matchTheme ? '' : 'none';
    });
  }

  filterInput.oninput = applyFilters;

  root.querySelectorAll('#theme-chips button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.classList.contains('green')));
    btn.onclick = () => {
      root.querySelectorAll('#theme-chips button').forEach((b) => {
        b.classList.remove('green');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('green');
      btn.setAttribute('aria-pressed', 'true');
      activeTheme = btn.dataset.filter;
      applyFilters();
    };
  });

  // Lista completa de votos: montada só quando a pessoa abre (centenas de nomes por votação)
  const rowsByHouse = { camara: [], senado: [] };
  root.addEventListener(
    'toggle',
    (e) => {
      const d = e.target;
      if (!d.matches?.('details.vote-details') || !d.open) return;
      const body = d.querySelector('.vote-details-body');
      if (body.childElementCount) return;
      const row = rowsByHouse[d.dataset.house][Number(d.dataset.i)];
      body.innerHTML = allVotesBody(row.votes, d.dataset.house, d.dataset.i);
      const q = body.querySelector('.vote-q');
      q.oninput = () => {
        const term = q.value.toLowerCase().trim();
        body.querySelectorAll('.vote-list li').forEach((li) => (li.hidden = !!term && !li.dataset.name.includes(term)));
      };
    },
    true
  );

  // Câmara: todas as votações, abertas a qualquer pessoa
  const camaraList = $('#camara-list', root);
  const camaraRows = loadComparison(politicians, 14);
  camaraRows
    .then((rows) => {
      rowsByHouse.camara = rows;
      camaraList.innerHTML = rows.length
        ? rows.map((v, i) => camaraVotingCard(v, deputies, i)).join('')
        : '<div class="card empty"><p class="muted">Sem votações nominais recentes na Câmara.</p></div>';
      applyFilters();
      fillConfrontoForm(rows);
    })
    .catch(() => {
      camaraList.innerHTML =
        '<div class="card empty"><span class="mi" aria-hidden="true">cloud_off</span><p class="muted">Falha temporária ao consultar a Câmara dos Deputados.</p></div>';
      $('#confronto-form', root).innerHTML = '<p class="muted">Sem as votações da Câmara não há o que comparar agora.</p>';
    });

  // Confronto: qualquer deputado que votou nas votações carregadas; quem a pessoa acompanha vem primeiro
  function fillConfrontoForm(rows) {
    const form = $('#confronto-form', root);
    const all = new Map();
    for (const r of rows) for (const v of r.votes) if (v.id && !all.has(v.id)) all.set(v.id, v);
    const list = [...all.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (list.length < 2) {
      form.innerHTML = '<p class="muted">Ainda não há votações suficientes para comparar.</p>';
      return;
    }
    const followed = deputies.map((d) => all.get(d.camaraId)).filter(Boolean);
    const opt = (v, sel) => `<option value="${v.id}" ${sel ? 'selected' : ''}>${esc(v.name)} (${esc(v.party)}/${esc(v.uf)})</option>`;
    const [a, b] = followed.length >= 2 ? followed : [list[0], list[1]];
    const options = (pick) =>
      (followed.length ? `<optgroup label="Quem você acompanha">${followed.map((v) => opt(v, v === pick)).join('')}</optgroup>` : '') +
      `<optgroup label="Todos os deputados (A–Z)">${list.map((v) => opt(v, !followed.includes(pick) && v === pick)).join('')}</optgroup>`;
    form.innerHTML = `
      <div class="grid g2 u-gap-14">
        <div>
          <label class="label" for="sel-pol-a">Deputado(a) A</label>
          <select class="input" id="sel-pol-a">${options(a)}</select>
        </div>
        <div>
          <label class="label" for="sel-pol-b">Deputado(a) B</label>
          <select class="input" id="sel-pol-b">${options(b)}</select>
        </div>
      </div>
      <div id="confronto-results" class="stack u-mt-8" aria-live="polite"></div>`;
    $('#sel-pol-a', root).onchange = computeConfrontation;
    $('#sel-pol-b', root).onchange = computeConfrontation;
    if (!confrontoPane.classList.contains('hidden')) computeConfrontation();
  }

  // Senado: todas as votações nominais do período, com o voto de cada senador presente
  const senadoList = $('#senado-list', root);
  try {
    const rows = await loadSenatePublic(politicians, 14);
    rowsByHouse.senado = rows;
    senadoList.innerHTML = rows.length
      ? rows.map((v, i) => senadoVotingCard(v, senators, i)).join('')
      : '<div class="card empty"><p class="muted">Sem votações nominais recentes no Senado.</p></div>';
    applyFilters();
  } catch {
    senadoList.innerHTML =
      '<div class="card empty"><span class="mi" aria-hidden="true">cloud_off</span><p class="muted">Falha temporária ao consultar o Senado Federal.</p></div>';
  }
  await camaraRows.catch(() => {});
}
