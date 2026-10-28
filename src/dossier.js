import { modal, esc, brl, fmtDate, avatar, ROLES, mandateProgress, toast } from './ui.js';
import {
  deputyProfile,
  deputyExpenses,
  deputyPropositions,
  senatorVotes,
  getTseElectoralProfile,
} from './api.js';
import { deputyPlenaryStats, senatorPlenaryStats } from './plenary.js';
import { birthplace, isMagistrate, partyName } from './simbolos.js';
import { plenaryPanelHtml } from './views/plenaryPanel.js';
import { currentLegislatureLabel } from './legislature.js';

export async function openDossierModal(p) {
  const m = mandateProgress(p);

  const { el, close } = modal(`
    <div class="row between no-print">
      <div class="row">
        <span class="mi u-c-primary u-fs-24" aria-hidden="true">description</span>
        <h3 class="h2 u-fs-16">Dossiê Cívico de Prestação de Contas</h3>
      </div>
      <div class="row">
        <button class="btn primary sm" id="btn-print-dossier"><span class="mi" aria-hidden="true">print</span>Imprimir / Salvar PDF</button>
        <button class="btn icon ghost" data-close aria-label="Fechar"><span class="mi" aria-hidden="true">close</span></button>
      </div>
    </div>

    <div id="dossier-content" class="stack u-mt-10">
      <div class="row"><span class="spin"></span><span class="muted">Consolidando dados oficiais para o relatório…</span></div>
    </div>
  `);

  const dossierContent = el.querySelector('#dossier-content');
  const btnPrint = el.querySelector('#btn-print-dossier');

  try {
    let profile = null;
    let expenses = [];
    let propositions = [];
    let votes = [];
    let plenary = null;

    if (p.source === 'camara') {
      [profile, expenses, propositions, plenary] = await Promise.all([
        deputyProfile(p.camaraId).catch(() => null),
        deputyExpenses(p.camaraId, 80).catch(() => []),
        deputyPropositions(p.camaraId, 10).catch(() => []),
        deputyPlenaryStats(p.camaraId).catch(() => null),
      ]);
    } else if (p.source === 'senado') {
      [votes, plenary] = await Promise.all([
        senatorVotes(p.senadoId, 15).catch(() => []),
        senatorPlenaryStats(p.senadoId).catch(() => null),
      ]);
    }

    // Cálculo do Hash SHA-256 de integridade local
    const nowIso = new Date().toISOString();
    const payloadForHash = JSON.stringify({
      politicianId: p.id,
      name: p.name,
      party: p.party,
      uf: p.uf,
      timestamp: nowIso,
      expensesLength: expenses.length,
      propositionsLength: propositions.length,
      votesLength: votes.length,
      plenary: plenary && { a: plenary.attendance.rate, f: plenary.fidelity.rate },
    });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadForHash));
    const sha256Hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const tse = getTseElectoralProfile(p);
    const totalSpent = expenses.reduce((acc, x) => acc + (x.value || 0), 0);

    dossierContent.innerHTML = `
      <div class="dossier-paper stack u-gap-16 u-bg-card u-border-1-solid-line u-br-14 u-p-24">
        <!-- Cabeçalho Institucional -->
        <div class="row between u-bb-2-solid-primary u-pb-12">
          <div>
            <span class="sm u-ls-1 u-tt-uppercase u-fw-700 u-c-primary">COLA CIDADÃ · AUDITORIA CÍVICA</span>
            <h2 class="u-fs-20 u-fw-800 u-mt-2">Relatório de Desempenho & Fiscalização de Mandato</h2>
            <span class="sm muted">Documento emitido diretamente pelo cidadão via Dados Abertos Oficiais</span>
          </div>
          <div class="u-ta-right">
            <span class="chip green">${currentLegislatureLabel()}</span><br>
            <span class="sm muted u-d-inline-block u-mt-4">Emissão: ${new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <!-- Identificação Parlamentar -->
        <div class="row u-gap-18 u-ai-flex-start">
          ${avatar(p)}
          <div class="u-flex-1">
            <h3 class="u-fs-18 u-fw-700">${esc(p.name)}</h3>
            <p class="sm muted u-mt-2">
              <b>Cargo:</b> ${ROLES[p.roleKey]?.label || 'Parlamentar'} · ${isMagistrate(p) ? `<b>Natural de:</b> ${esc(birthplace(p)?.texto || 'não informado')}` : `<b>Partido:</b> ${esc(partyName(p) || 'sem partido')} · <b>Estado/UF:</b> ${esc(p.uf || 'SP')}`}
            </p>
            ${
              profile?.civilName && profile.civilName !== p.name
                ? `<p class="sm muted"><b>Nome Civil Registrado:</b> ${esc(profile.civilName)}</p>`
                : ''
            }
            <div class="row sm u-mt-6 u-gap-16">
              <span><b>Mandato:</b> ${m.pct}% cumprido</span>
              <span><b>Término Previsto:</b> ${m.end}</span>
              <span><b>Dias Restantes:</b> ${m.label}</span>
            </div>
          </div>
        </div>

        <!-- Seção: Origem Eleitoral (TSE) -->
        ${
          tse.available
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <div class="row between">
            <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">Origem Eleitoral (TSE)</h4>
            <span class="chip gold sm">Eleição ${tse.electionYear}</span>
          </div>
          <div class="row sm u-gap-16 u-fwrap-wrap">
            <span><b>Número de Urna:</b> <code class="u-fw-700 u-c-primary">${esc(tse.ballotNumber)}</code></span>
            <span><b>Resultado:</b> ${esc(tse.status)}</span>
            <span><b>Coligação/Federação:</b> ${esc(tse.electoralCoalition || (tse.isolatedParty ? 'Partido isolado' : '—'))}</span>
          </div>
          <div class="u-bg-s1 u-p-10 u-br-8">
            <span class="sm muted u-d-block">Patrimônio declarado no registro de candidatura:</span>
            <b class="u-fs-15 u-c-primary">${tse.declaredAssets != null ? brl(tse.declaredAssets) : 'Não declarado'}</b>
          </div>
        </div>`
            : ''
        }

        <!-- Seção: Presença & Fidelidade (Câmara) -->
        ${
          plenary
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">Presença em Plenário & Fidelidade à Bancada</h4>
          ${plenaryPanelHtml(plenary)}
        </div>`
            : ''
        }

        <!-- Seção: Despesas da Cota Parlamentar (CEAP) -->
        ${
          expenses.length
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <div class="row between">
            <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">Auditoria Financeira da Cota (CEAP)</h4>
            <span class="sm u-fw-700 u-c-primary">Soma da amostra: ${brl(totalSpent)}</span>
          </div>
          <p class="sm muted">Amostra recente dos últimos ${expenses.length} comprovantes emitidos pelo gabinete:</p>
          <div class="stack u-gap-4">
            ${expenses
              .slice(0, 5)
              .map(
                (ex) => `
              <div class="row between sm u-bg-s1 u-p-6-10 u-br-6">
                <span class="truncate u-maxw-320">${esc(ex.supplier || ex.type)}</span>
                <span class="muted">${fmtDate(ex.date)}</span>
                <b>${brl(ex.value || 0)}</b>
              </div>`
              )
              .join('')}
          </div>
        </div>`
            : ''
        }

        <!-- Seção: Projetos de Lei de Autoria -->
        ${
          propositions.length
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">Projetos Autorais Recentes (PLs & PECs)</h4>
          <div class="stack u-gap-6">
            ${propositions
              .slice(0, 4)
              .map(
                (pr) => `
              <div class="stack u-gap-2 u-bg-s1 u-p-8-10 u-br-6">
                <div class="row between sm">
                  <b>${esc(pr.type)} ${esc(pr.number)}/${esc(pr.year)}</b>
                  <span class="muted">${fmtDate(pr.date)}</span>
                </div>
                <p class="sm u-c-text u-lh-1_3">${esc(pr.summary)}</p>
              </div>`
              )
              .join('')}
          </div>
        </div>`
            : ''
        }

        <!-- Seção: Votações do Senado -->
        ${
          votes.length
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">Deliberações Nominais no Senado Federal</h4>
          <div class="stack u-gap-6">
            ${votes
              .slice(0, 5)
              .map(
                (v) => `
              <div class="row between sm u-bg-s1 u-p-8-10 u-br-6">
                <div class="u-flex-1">
                  <b>${esc(v.matter)}</b>
                  <p class="muted u-mt-2">${esc(v.summary.slice(0, 90))}…</p>
                </div>
                <span class="chip ${v.vote === 'Sim' ? 'green' : v.vote === 'Não' ? 'red' : 'gold'} u-fw-700">${esc(v.vote)}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>`
            : ''
        }

        <!-- Seção: Dados de Gabinete Estadual / Municipal -->
        ${
          (typeof p.source === 'string' && /^(al|cm)-/.test(p.source))
            ? `
        <div class="stack u-gap-8 u-bt-1-solid-line u-pt-12">
          <h4 class="u-fs-14 u-tt-uppercase u-fw-700 u-c-text">
            ${
              p.source.startsWith('al-')
                ? `Atuação Estadual · ${esc(p.house || p.uf || '')}`
                : `Atuação Municipal · ${esc(p.house || p.city || '')}`
            }
          </h4>
          <p class="sm"><b>Base Eleitoral / Domicílio:</b> ${esc(p.baseEleitoral || p.uf || 'Geral')}</p>
          ${p.areaAtuacao ? `<p class="sm"><b>Áreas de Atuação:</b> ${esc(p.areaAtuacao)}</p>` : ''}
          <p class="sm"><b>Gabinete:</b> ${esc(p.room || 'Gabinete Parlamentar')} ${p.phone ? `· <b>Telefone:</b> ${esc(p.phone)}` : ''}</p>
        </div>`
            : ''
        }

        <!-- Selo Criptográfico de Integridade -->
        <div class="u-bt-1-dashed-line u-pt-12 u-mt-6">
          <div class="row between sm muted">
            <span>Código de conferência (SHA-256 do resumo deste relatório):</span>
            <span>Gerado neste dispositivo</span>
          </div>
          <code class="sm u-d-block u-mt-4 u-word-break-break-all u-fs-10 u-c-muted u-bg-s2 u-p-6 u-br-6">
            ${sha256Hex}
          </code>
        </div>
      </div>
    `;

    btnPrint.onclick = () => window.print();
  } catch (err) {
    dossierContent.innerHTML = `<p class="muted">Falha ao gerar relatório: ${esc(err.message)}</p>`;
  }
}
