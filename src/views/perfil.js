import { store } from '../store.js';
import { toast, esc, brl, $, ROLES } from '../ui.js';
import { partyOrBirth } from '../simbolos.js';
import { FEDERATION_UNITS } from '../api.js';

export function render(root) {
  const s = store.get();
  const polCount = s.politicians.length;
  const alertCount = s.alerts.length;

  root.innerHTML = `
    <!-- Top Header do Perfil (Estilo Stitch) -->
    <div class="top">
      <div>
        <div class="row u-gap-8 u-mb-4">
          <span class="chip green xs">GOVERNANÇA & LGPD</span>
          <span class="xs muted">Painel Individual de Auditoria</span>
        </div>
        <h1>Perfil do Cidadão & Governança</h1>
        <p>Garantia de soberania de dados pessoais (Art. 5º da LGPD) e fiscalização do ciclo eleitoral em vigor.</p>
      </div>
      <div class="row page-actions two">
        <button class="btn outlined" id="btn-export-top"><span class="mi" aria-hidden="true">download</span>Backup JSON</button>
        <a class="btn primary" href="#/painel"><span class="mi" aria-hidden="true">account_balance</span>Painel Público</a>
      </div>
    </div>

    <!-- 1. Card Principal do Eleitor (Conforme Stitch) -->
    <div class="card stack u-gap-18 u-p-24 u-mb-20 u-bl-4-solid-primary">
      <div class="row between">
        <div class="row nowrap u-gap-16">
          <div class="u-width-64 u-height-64 u-br-50pct u-bg-f4e9bb u-d-grid u-place-items-center u-c-fff u-fs-24 u-fw-700 u-flex-shrink-0">
            <span class="mi fill u-fs-32" aria-hidden="true">person</span>
          </div>
          <div>
            <div class="row u-gap-8">
              <h2 class="u-fs-20 u-fw-800">Seu Perfil</h2>
            </div>
            <p class="sm muted u-mt-2">
              Domicílio eleitoral: <b>${esc(s.domicile?.city || 'São Paulo')} - ${esc(s.domicile?.state || 'SP')}</b>
            </p>
            <span class="xs muted">Usado para sugerir a Assembleia e a Câmara Municipal da sua região.</span>
          </div>
        </div>

        <div class="row u-gap-8">
          <button class="btn outlined sm" id="btn-edit-domicile">
            <span class="mi" aria-hidden="true">edit_location_alt</span>Alterar Município
          </button>
        </div>
      </div>

      <!-- Métricas Cívicas do Cidadão (Stitch) -->
      <div class="grid u-cols-3760d4 u-gap-10 u-bt-1-solid-line u-pt-16">
        <div class="stat">
          <span>Pessoas acompanhadas</span>
          <b>${polCount}</b>
          <span class="xs muted u-tt-none">Escolha opcional, feita no perfil de cada uma</span>
        </div>
        <div class="stat">
          <span>Alertas Registrados</span>
          <b>${alertCount}</b>
          <span class="xs muted u-tt-none">Votações encontradas em "Verificar agora"</span>
        </div>
      </div>
    </div>

    <div class="grid g2 u-ai-start">
      
      <!-- COLUNA 1: Quem a pessoa acompanha e domicílio -->
      <div class="stack">
        
        <!-- Lista de quem a pessoa acompanha -->
        <div class="card stack u-gap-14 u-p-20">
          <div class="row between">
            <div>
              <h2 class="h2">Quem você acompanha</h2>
              <span class="xs muted">Acompanhar não diz em quem você votou: é só uma lista de atalhos, guardada neste aparelho.</span>
            </div>
          </div>

          ${
            polCount
              ? `
            <div class="stack u-gap-10">
              ${s.politicians
                .map(
                  (p) => `
                <div class="card soft row between sm u-p-10-14 u-br-r-md u-bg-s2">
                  <div class="row nowrap u-gap-12">
                    <div class="u-width-36 u-height-36 u-br-50pct u-bg-card u-d-grid u-place-items-center u-fw-700">
                      ${p.name.charAt(0)}
                    </div>
                    <div>
                      <b class="u-fs-13_5">${esc(p.name)}</b><br>
                      <span class="xs muted">${esc([partyOrBirth(p), ROLES[p.roleKey]?.label || 'Mandato'].filter(Boolean).join(' • '))}</span>
                    </div>
                  </div>
                  <div class="row u-gap-6">
                    <span class="chip xs">${p.camaraId ? 'Câmara' : p.senadoId ? 'Senado' : p.roleKey === 'ministro-stf' ? 'STF' : p.tse ? 'TSE' : 'Registro público'}</span>
                  </div>
                </div>`
                )
                .join('')}
            </div>`
              : `
            <div class="empty u-p-28">
              <span class="mi" aria-hidden="true">bookmark_add</span>
              <h3 class="u-fs-14">Você ainda não acompanha ninguém</h3>
              <p class="xs muted">Tudo continua aberto no Painel Público. Para acompanhar alguém, abra o perfil e toque em Acompanhar.</p>
            </div>`
          }

        </div>

        <!-- Domicílio Eleitoral Form -->
        <div class="card stack u-gap-12 u-p-18" id="card-domicile">
          <div class="row between">
            <h2 class="h2">Domicílio Eleitoral Federativo</h2>
            <span class="chip blue xs">Filtro Regional</span>
          </div>
          <p class="xs muted">
            Priorize deputados estaduais e vereadores do seu Estado e Município de residência.
          </p>
          <div class="grid g2 u-gap-10">
            <div>
              <label class="label" for="dom-state">Estado (UF)</label>
              <select class="input" id="dom-state">
                ${FEDERATION_UNITS.map(
                  (u) => `<option value="${u.uf}" ${(s.domicile?.state || 'SP') === u.uf ? 'selected' : ''}>${esc(u.name)} (${u.uf})</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="label" for="dom-city">Município</label>
              <input class="input" id="dom-city" value="${esc(s.domicile?.city || 'São Paulo')}" placeholder="Ex.: São Paulo, Rio, BH, Niterói">
            </div>
          </div>
          <button class="btn sm primary u-align-self-flex-start" id="btn-save-domicile">
            <span class="mi" aria-hidden="true">check</span>Salvar Domicílio
          </button>
        </div>

      </div>

      <!-- COLUNA 2: Segurança Criptográfica & LGPD Cívica (Stitch) -->
      <div class="stack">
        
        <div class="card stack u-gap-14 u-p-20 u-bl-4-solid-primary">
          <div class="row between">
            <div class="row u-gap-8">
              <span class="mi u-c-primary u-fs-22" aria-hidden="true">shield</span>
              <h2 class="h2">Privacidade & LGPD</h2>
            </div>
          </div>

          <p class="sm muted u-lh-1_5">
            O Cola Cidadã opera sob o princípio da <b>minimização absoluta de dados</b> (Art. 6º, III da Lei 13.709/18). Suas escolhas eleitorais e histórico de auditoria são dados pessoais sensíveis e <b>nunca são transmitidos para servidores remotos</b>.
          </p>

          <div class="stack u-gap-8 u-mt-4">
            <b class="xs muted u-tt-uppercase u-fw-700">Backup & Portabilidade (Art. 18 LGPD):</b>
            <div class="row u-gap-8">
              <button class="btn sm outlined u-flex-1" id="export">
                <span class="mi" aria-hidden="true">download</span>Exportar JSON
              </button>
              <label class="btn sm outlined u-flex-1 u-cursor-pointer u-ta-center">
                <span class="mi" aria-hidden="true">upload</span>Restaurar
                <input type="file" id="import-file" accept=".json" class="u-d-none">
              </label>
            </div>
          </div>

          <div class="u-bt-1-solid-line u-pt-14 u-mt-4">
            <button class="btn danger sm u-width-100pct" id="purge">
              <span class="mi" aria-hidden="true">delete_forever</span>Expurgar Todos os Dados Locais
            </button>
            <span class="xs muted u-d-block u-ta-center u-mt-6">
              Apaga permanentemente todos os registros e zera a memória local.
            </span>
          </div>
        </div>

        <!-- Card de Conformidade Legal -->
        <div class="card soft stack u-gap-10 u-p-16">
          <h3 class="h3">De onde vêm os dados</h3>
          <div class="stack xs muted u-gap-6">
            <div>• <b>Dados abertos oficiais:</b> APIs da Câmara dos Deputados e do Senado Federal e arquivos públicos do TSE, disponibilizados com base na LAI (Lei 12.527/11).</div>
            <div>• <b>Sem servidor próprio:</b> o app consulta essas fontes direto do seu navegador; a lista de quem você acompanha fica só neste dispositivo.</div>
            <div>• <b>Funciona offline:</b> telas e dados já consultados ficam em cache no aparelho.</div>
          </div>
        </div>

      </div>

    </div>`;


  $('#btn-save-domicile', root).onclick = () => {
    const st = $('#dom-state', root)?.value || 'SP';
    const ct = $('#dom-city', root)?.value || 'São Paulo';
    store.setDomicile(st, ct);
    toast('Domicílio eleitoral atualizado!');
  };

  $('#btn-edit-domicile', root).onclick = () => {
    $('#dom-city', root)?.focus();
  };

  // Exportar Backup
  const handleExport = () => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    a.href = url;
    a.download = `monitor-cidadao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast('Backup exportado com sucesso.');
  };

  $('#export', root).onclick = handleExport;
  $('#btn-export-top', root).onclick = handleExport;

  // Importar Backup
  const importInput = $('#import-file', root);
  if (importInput) {
    importInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5_000_000) {
        toast('Backup muito grande (limite de 5 MB).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        const preview = store.previewImport(text);
        if (!preview) {
          toast('Arquivo de backup inválido.', 'error');
          return;
        }
        const valid = window.confirm(`Restaurar este backup com ${preview.politicians} pessoa(s) acompanhada(s) e ${preview.alerts} alerta(s)? Os dados atuais deste aparelho serão substituídos.`);
        if (valid && store.importJson(text)) {
          toast('Dados restaurados com sucesso!');
          render(root);
        } else if (valid) {
          toast('Não foi possível restaurar o backup. Confira o arquivo e o espaço disponível no aparelho.', 'error');
        }
      };
      reader.onerror = () => toast('Não foi possível ler o arquivo de backup.', 'error');
      reader.readAsText(file);
    };
  }

  // Expurgo LGPD
  $('#purge', root).onclick = () => {
    const ok = confirm(
      'Atenção (LGPD): Esta ação apagará permanentemente a lista de quem você acompanha, alertas e preferências salvas em cache neste dispositivo. Deseja prosseguir?'
    );
    if (ok) {
      store.purge();
      toast('Todos os dados locais foram expurgados.', 'delete');
      render(root);
    }
  };
}
