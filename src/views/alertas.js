import { store } from '../store.js';
import { collectAlerts, prefOn, EXPENSE_THRESHOLD } from '../alerts.js';
import { esc, fmtDate, toast, $ } from '../ui.js';

const KINDS = {
  plenario: { label: 'Plenário', icon: 'gavel', chip: 'blue', link: '' },
  votacao: { label: 'Voto de quem acompanho', icon: 'how_to_vote', chip: 'green', link: '' },
  gasto: { label: 'Gasto da cota', icon: 'receipt_long', chip: 'gold', link: 'Ver nota fiscal' },
  proposicao: { label: 'Projeto de lei', icon: 'description', chip: 'purple', link: 'Ver tramitação' },
};
// alertas gravados antes desta versão não têm tipo: eram todos votos de quem a pessoa acompanha
const kindOf = (a) => (KINDS[a.kind] ? a.kind : 'votacao');

// O filtro escolhido continua valendo enquanto a tela é refeita (verificar, mudar preferência).
let activeFilter = 'all';

export function render(root) {
  const { prefs, alerts, politicians } = store.get();
  const hasNotificationSupport = 'Notification' in window;
  const isNotificationGranted = hasNotificationSupport && Notification.permission === 'granted';

  const limiar = EXPENSE_THRESHOLD.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const toggles = [
    ['plenario', 'Votações do Plenário', 'Novas votações nominais na Câmara e no Senado, para qualquer pessoa, sem acompanhar ninguém.'],
    ['rollcall', 'Votos de quem você acompanha', 'Como cada deputado ou senador que você acompanha votou nessas votações.'],
    ['expenses', `Gastos da cota acima de ${limiar}`, 'Notas da cota parlamentar (CEAP) dos deputados federais que você acompanha.'],
    ['bills', 'Projetos de lei apresentados', 'PLs e PECs de autoria dos deputados federais que você acompanha.'],
  ];
  const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, alerts.filter((a) => kindOf(a) === k).length]));
  if (activeFilter !== 'all' && !KINDS[activeFilter]) activeFilter = 'all';

  root.innerHTML = `
    <!-- Top Header da Central de Alertas (Stitch) -->
    <div class="top">
      <div>
        <div class="row u-gap-8 u-mb-4">
          <span class="chip green xs">SOB DEMANDA</span>
          <span class="xs muted">Notificações e Avisos Oficiais</span>
        </div>
        <div class="row u-gap-10">
          <div class="u-width-36 u-height-36 u-br-10 u-bg-primary-soft u-c-primary u-d-grid u-place-items-center">
            <span class="mi u-fs-22" aria-hidden="true">notifications_active</span>
          </div>
          <h1>Central de Alertas</h1>
        </div>
        <p>Novas votações do Congresso e, se você acompanha alguém, os votos, gastos e projetos dessas pessoas. A consulta acontece quando você toca em "Verificar agora".</p>
      </div>
      <div class="row page-actions">
        <button class="btn primary" id="check"><span class="mi" aria-hidden="true">sync</span>Verificar Agora</button>
      </div>
    </div>

    <!-- Filtros de Alerta (Conforme Stitch) -->
    <div class="row u-gap-8 u-mb-20" id="alert-filters" aria-label="Filtrar alertas">
      <button class="chip ${activeFilter === 'all' ? 'green' : ''} u-cursor-pointer u-p-6-14 u-fs-12" data-filter="all" aria-pressed="${activeFilter === 'all'}">
        Todos (${alerts.length})
      </button>
      ${Object.entries(KINDS)
        .map(
          ([k, v]) => `<button class="chip ${activeFilter === k ? 'green' : ''} u-cursor-pointer u-p-6-14 u-fs-12" data-filter="${k}" aria-pressed="${activeFilter === k}">
        ${v.label} (${counts[k]})
      </button>`
        )
        .join('')}
    </div>

    <div class="grid g2 u-ai-start">
      
      <!-- COLUNA PRINCIPAL: Lista de Alertas -->
      <div class="stack" id="alerts-stream">
        ${
          hasNotificationSupport && !isNotificationGranted
            ? `
          <div class="card soft row between u-p-16 u-bg-secondary-soft u-bl-4-solid-secondary">
            <div>
              <b class="u-c-on-secondary-soft u-fs-14">Ativar Notificações no Dispositivo</b>
              <p class="xs u-c-on-secondary-soft u-mt-2">Receba avisos na área de trabalho quando houver votações de alto impacto.</p>
            </div>
            <button class="btn primary sm" id="btn-enable-notify">
              <span class="mi" aria-hidden="true">notifications</span>Ativar
            </button>
          </div>`
            : ''
        }

        ${
          alerts.length
            ? `
          <div class="stack u-gap-14">
            <div class="row between xs muted u-fw-700 u-tt-uppercase">
              <span>● Registros Mais Recentes</span>
              <span>${alerts.length} eventos monitorados</span>
            </div>
            <p class="sm muted" id="alerts-empty-filter" hidden>Nenhum alerta deste tipo ainda.</p>
            ${alerts
              .map((a) => {
                const k = KINDS[kindOf(a)];
                return `
              <article class="card stack u-gap-10 u-bl-4-solid-primary alert-item" data-kind="${kindOf(a)}">
                <div class="row between">
                  <span class="chip ${k.chip} xs"><span class="mi u-fs-12" aria-hidden="true">${k.icon}</span>${k.label}</span>
                  <span class="xs muted">${fmtDate(a.ts)}</span>
                </div>
                <p class="u-fs-14 u-fw-600 u-lh-1_45">${esc(a.text)}</p>
                ${
                  a.url && k.link
                    ? `<a class="btn outlined sm u-align-self-flex-start" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${k.link}<span class="sr-only"> (abre em nova aba)</span><span class="mi u-fs-14" aria-hidden="true">open_in_new</span></a>`
                    : ''
                }
              </article>`;
              })
              .join('')}
          </div>`
            : `
          <div class="card empty">
            <span class="mi" aria-hidden="true">notifications_off</span>
            <h2>Nenhum alerta ainda</h2>
            <p>Toque em "Verificar agora" para ver as votações recentes do Plenário. Para receber também votos, gastos e projetos de alguém, acompanhe essa pessoa pelo perfil no <a href="#/painel">Painel Público</a>.</p>
          </div>`
        }

        <!-- Card Stitch: Fiscalização Cívica Direcionada -->
        <div class="card stack u-gap-10 u-p-18 u-bg-s1 u-border-1-solid-line u-mt-10">
          <div class="row u-gap-8">
            <span class="mi u-c-primary u-fs-22" aria-hidden="true">verified</span>
            <b class="u-fs-14">Como os alertas funcionam</b>
          </div>
          <p class="sm muted u-lh-1_5">
            As votações do Plenário valem para todo mundo. ${
              politicians.length
                ? `Votos, gastos e projetos cobrem as <b>${politicians.length} pessoas</b> que você acompanha (gastos e projetos só existem para deputados federais).`
                : 'Votos, gastos e projetos aparecem quando você acompanha alguém.'
            } A consulta acontece quando você toca em "Verificar agora"; com as notificações do aparelho ativadas, o primeiro alerta novo também aparece como notificação.
          </p>
          <div class="row between sm u-mt-6">
            <span class="xs muted">Fonte: APIs da Câmara e do Senado</span>
            <a href="#/perfil" class="btn sm outlined">Configurar Preferências</a>
          </div>
        </div>
      </div>

      <!-- COLUNA LATERAL: Preferências de Notificação (Stitch) -->
      <aside class="card stack u-gap-16 u-p-20 u-position-sticky u-top-80">
        <div class="row between">
          <div class="row u-gap-8">
            <span class="mi u-c-primary u-fs-20" aria-hidden="true">tune</span>
            <h2 class="h2">Gatilhos de Notificação</h2>
          </div>
        </div>

        <p class="xs muted u-lh-1_5">
          Defina quais matérias acionam alertas locais no seu navegador. Os dados são processados inteiramente no seu dispositivo.
        </p>

        <div class="stack u-gap-12">
          ${toggles
            .map(
              ([k, t, d]) => `
            <div class="card soft row between u-p-12-14 u-gap-12">
              <div class="u-flex-1">
                <b class="u-fs-13 u-d-block">${t}</b>
                <span class="xs muted u-lh-1_4">${d}</span>
              </div>
              <label class="switch">
                <input type="checkbox" role="switch" data-pref="${k}" aria-label="${t}" ${prefOn(prefs, k) ? 'checked' : ''}>
                <i></i>
              </label>
            </div>`
            )
            .join('')}
        </div>

        <div class="card soft stack u-gap-8 u-p-12 u-fs-12 u-bg-s2">
          <div class="row u-gap-6 u-c-primary">
            <span class="mi u-fs-16" aria-hidden="true">security</span>
            <b>Privacidade LGPD</b>
          </div>
          <p class="xs muted">Nenhum servidor externo recebe a lista de deputados ou convicções que você monitora.</p>
        </div>
      </aside>

    </div>`;

  const btnNotify = $('#btn-enable-notify', root);
  if (btnNotify) {
    btnNotify.onclick = async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast('Notificações no dispositivo ativadas!');
        render(root);
      } else {
        toast('Permissão de notificação negada.', 'info');
      }
    };
  }

  root.querySelectorAll('[data-pref]').forEach((i) => {
    i.onchange = () => {
      store.setPref(i.dataset.pref, i.checked);
      toast('Preferência de notificação salva.');
    };
  });

  const applyFilter = () => {
    let shown = 0;
    root.querySelectorAll('.alert-item').forEach((el) => {
      el.hidden = activeFilter !== 'all' && el.dataset.kind !== activeFilter;
      if (!el.hidden) shown++;
    });
    const none = $('#alerts-empty-filter', root);
    if (none) none.hidden = shown > 0;
  };
  root.querySelectorAll('#alert-filters [data-filter]').forEach((b) => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      root.querySelectorAll('#alert-filters [data-filter]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('green', on);
        x.setAttribute('aria-pressed', String(on));
      });
      applyFilter();
    };
  });
  applyFilter();

  $('#check', root).onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span><span>Consultando Congresso…</span>';

    try {
      const { alerts: fresh, failures } = await collectAlerts(store.get());
      const count = store.addAlerts(fresh);
      const found = count > 0 ? `${count} ${count === 1 ? 'alerta novo' : 'alertas novos'}.` : 'Nada novo desde a última verificação.';
      // um aviso só: o toast seguinte apagaria o anterior antes de ser lido
      if (failures.length) toast(`${found} Não foi possível consultar: ${failures.join(', ')}.`, 'error');
      else toast(found, count > 0 ? 'check_circle' : 'info');
      if (count > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const first = fresh.find((a) => !alerts.some((old) => old.id === a.id));
        if (first) new Notification('Cola Cidadã', { body: first.text, icon: '/icon.svg' });
      }
    } catch {
      toast('Erro temporário ao consultar as bases de dados abertas.', 'error');
    }
    render(root);
  };
}
