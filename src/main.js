import { store } from './store.js';
import { $, $$, initImageFallback, toast } from './ui.js';
import { prefersReducedMotion } from './motion.js';
import { initDynamicStyles } from './dynamic.js';
import * as painel from './views/painel.js';
import * as inicio from './views/inicio.js';
import * as politicos from './views/politicos.js';
import * as comparador from './views/comparador.js';
import * as alertas from './views/alertas.js';
import * as perfil from './views/perfil.js';
import * as poderes from './views/poderes.js';
import { refreshFollowed } from './refresh.js';

window.addEventListener('cola:storage-error', () => {
  toast('Não foi possível guardar a alteração neste aparelho. Confira o espaço disponível e exporte um backup.', 'error');
});

// nav: false — a tela existe (links internos levam a ela), mas não ocupa lugar na navegação.
const routes = {
  painel: { icon: 'account_balance', label: 'Painel Público', short: 'Painel', view: painel },
  inicio: { icon: 'feed', label: 'Acompanhamento', short: 'Início', view: inicio },
  'meus-politicos': { icon: 'bookmark_added', label: 'Quem Acompanho', short: 'Acompanho', view: politicos, nav: false },
  poderes: { icon: 'balance', label: 'Gastos por Poder', short: 'Poderes', view: poderes, nav: false },
  comparador: { icon: 'compare_arrows', label: 'Comparador Cívico', short: 'Comparar', view: comparador },
  alertas: { icon: 'notifications', label: 'Alertas', short: 'Alertas', view: alertas },
  perfil: { icon: 'person', label: 'Perfil', short: 'Perfil', view: perfil },
};

const app = $('#app');
let deferredPrompt = null;

function shell() {
  const unreadAlerts = store.get().alerts.length;

  app.innerHTML = `
    <div class="app-wrapper">
      <a href="#view" class="skip-link">Pular para o conteúdo</a>
      <!-- 1. Top Global Header (Conforme Stitch) -->
      <header class="top-header" role="banner">
        <div class="header-brand">
          <a href="#/inicio" class="u-d-flex u-ai-center u-gap-10 u-c-inherit">
            <img class="header-mark" src="/icon.svg" alt="" width="36" height="36">
            <div class="brand-badge">
              <span class="brand-title">Cola Cidadã</span>
              <span class="brand-subtitle">Acompanhe seu mandato</span>
            </div>
          </a>
        </div>

        <div class="header-actions">
          <span class="header-source-status"><span class="status-dot" aria-hidden="true"></span>Dados públicos oficiais</span>
          <button class="btn icon ghost header-icon-btn" id="header-theme-btn" aria-label="Alternar tema claro/escuro">
            <span class="mi" aria-hidden="true" id="header-theme-icon">dark_mode</span>
          </button>

          <a href="#/alertas" class="btn icon ghost u-position-relative" title="Central de Alertas" aria-label="Alertas">
            <span class="mi" aria-hidden="true">notifications</span>
            ${
              unreadAlerts > 0
                ? `<span class="u-position-absolute u-top-4 u-right-4 u-width-8 u-height-8 u-br-50pct u-bg-primary-c"></span>`
                : ''
            }
          </a>

          <a href="#/perfil" class="header-user-btn" title="Perfil do Cidadão">
            <div class="user-avatar">
              <span class="mi u-fs-18" aria-hidden="true">person</span>
            </div>
            <div class="user-text">
              <b class="u-fs-12">Meu Perfil</b>
              <span class="xs muted">Dados neste aparelho</span>
            </div>
          </a>
        </div>
      </header>

      <!-- 3. Shell Principal (Sidebar + Content) -->
      <div class="shell">
        <aside class="side" aria-label="Menu lateral">
          <div class="side-main">
            <a class="side-brand" href="#/inicio" aria-label="Cola Cidadã, início">
              <img src="/icon.svg" alt="" width="40" height="40">
              <span><b>Cola Cidadã</b><small>Transparência pública</small></span>
            </a>
          <nav class="nav" aria-label="Navegação principal">
            ${Object.entries(routes)
              .filter(([, r]) => r.nav !== false)
              .map(
                ([k, r]) => `
              <a href="#/${k}" data-route="${k}">
                <span class="mi" aria-hidden="true">${r.icon}</span>
                <span>${r.label}</span>
              </a>`
              )
              .join('')}
          </nav>
          </div>

          <div class="side-foot">
            <button class="btn outlined sm u-width-100pct u-jc-flex-start" id="pwa-install" hidden>
              <span class="mi" aria-hidden="true">install_mobile</span>
              <span>Instalar Aplicativo</span>
            </button>

            <!-- Toggle Claro / Escuro -->
            <div class="row between u-p-4-6">
              <div class="row u-gap-8">
                <span class="mi u-fs-18 u-c-muted" aria-hidden="true" id="theme-icon">light_mode</span>
                <span class="sm u-fw-600" id="theme-label">Tema Claro</span>
              </div>
              <label class="switch" title="Alternar entre Tema Claro e Escuro">
                <input type="checkbox" id="theme-toggle-check" role="switch" aria-label="Tema escuro">
                <i></i>
              </label>
            </div>

            <!-- Card de Segurança LGPD -->
            <div class="user-quick-card">
              <span class="mi citizen-shield" aria-hidden="true">shield</span>
              <div class="u-flex-1">
                <b class="u-fs-11_5 u-d-block">Privacidade LGPD</b>
                <span class="xs muted">Dados salvos só neste dispositivo</span>
              </div>
            </div>

            <small class="muted u-fs-10_5 u-p-0-4">
              © ${new Date().getFullYear()} Mestry's Tecnologia
            </small>
          </div>
        </aside>

        <div class="main-col">
          <!-- 2. Sub-Banner Cívico Institucional -->
          <aside class="sub-civic-bar no-print" aria-label="Fontes oficiais e atalhos">
            <div class="civic-status">
              <b><span class="status-dot" aria-hidden="true"></span>TRANSPARÊNCIA CÍVICA</b>
              <span class="civic-sources"><span class="mi u-fs-15 u-c-primary" aria-hidden="true">verified</span>Fontes oficiais: TSE • Câmara • Senado • Tesouro</span>
            </div>

            <div class="row civic-chips u-gap-8">
              <a href="#/painel" class="chip u-cursor-pointer u-text-decoration-none" aria-label="Painel Público"><span class="mi u-fs-14" aria-hidden="true">dashboard</span>Painel</a>
              <a href="#/comparador" class="chip u-cursor-pointer u-text-decoration-none"><span class="mi u-fs-14" aria-hidden="true">gavel</span>Votações</a>
              <a href="#/meus-politicos" class="chip u-cursor-pointer u-text-decoration-none" aria-label="Quem Acompanho"><span class="mi u-fs-14" aria-hidden="true">bookmark_added</span>Acompanho</a>
            </div>
          </aside>

          <!-- Main Content -->
          <main class="content" id="view" role="main"></main>
        </div>
      </div>

      <!-- 4. Mobile Bottom Navigation Bar (Material You MD3) -->
      <nav class="mobile-nav no-print" aria-label="Navegação Inferior Mobile">
        ${Object.entries(routes)
          .filter(([, r]) => r.nav !== false)
          .map(
            ([k, r]) => `
          <a href="#/${k}" data-route="${k}">
            <div class="nav-pill">
              <span class="mi" aria-hidden="true">${r.icon}</span>
            </div>
            <span>${r.short}</span>
          </a>`
          )
          .join('')}
      </nav>

      <!-- 5. Rodapé Institucional Corporativo (Conforme Stitch) -->
      <footer class="footer-corporate no-print" role="contentinfo">
        <div class="u-maxw-1400 u-m-0-auto u-p-0-32">
          <div class="footer-top">
            <div>
              <div class="row u-gap-8 u-mb-8">
                <div class="u-width-24 u-height-24 u-br-6 u-bg-primary u-d-grid u-place-items-center u-c-fff">
                  <span class="mi fill u-fs-15" aria-hidden="true">balance</span>
                </div>
                <b class="u-fs-14 u-c-text">Mestry's Tecnologia</b>
              </div>
              <p class="u-fs-12 u-lh-1_5 u-maxw-440">
                Desenvolvimento de software de alta conformidade e soluções para integridade cívica, inteligência legislativa e auditoria de dados públicos abertos.
              </p>
            </div>

            <div>
              <b class="u-fs-12_5 u-c-text u-d-block u-mb-6">Contato</b>
              <p class="u-fs-12 u-lh-1_5">
                <a href="mailto:contato@mestrys.com.br">contato@mestrys.com.br</a>
              </p>
            </div>
          </div>

          <div class="footer-bottom">
            <div>
              © ${new Date().getFullYear()} Cola Cidadã • Todos os direitos reservados.
            </div>

            <div class="footer-badges">
              <span class="footer-badge-item">
                <span class="mi u-fs-14 u-c-primary" aria-hidden="true">lock</span>
                Dados só neste dispositivo
              </span>
              <span class="footer-badge-item">
                <span class="mi u-fs-14 u-c-primary" aria-hidden="true">database</span>
                Dados abertos: Câmara • Senado • TSE • Tesouro
              </span>
            </div>
          </div>
        </div>
      </footer>

    </div>`;


  // O roteamento usa o hash, então o link de pulo move o foco em vez de navegar.
  $('.skip-link').onclick = (e) => {
    e.preventDefault();
    focusViewHeading({ scroll: true });
  };

  const themeCheck = $('#theme-toggle-check');
  if (themeCheck) {
    themeCheck.checked = resolvedTheme() === 'dark';
    themeCheck.onchange = () => {
      store.set({ theme: themeCheck.checked ? 'dark' : 'light' });
    };
  }

  const themeBtn = $('#header-theme-btn');
  if (themeBtn) themeBtn.onclick = () => store.set({ theme: resolvedTheme() === 'dark' ? 'light' : 'dark' });

  const installBtn = $('#pwa-install');
  if (installBtn) {
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.hidden = true;
      }
      deferredPrompt = null;
    };
  }
}

// Ouvinte de instalação PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $('#pwa-install');
  if (btn) btn.hidden = false;
});

// 'system' (padrão) segue a preferência do aparelho até o usuário escolher um tema.
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function resolvedTheme() {
  const t = store.get().theme;
  return t === 'dark' || t === 'light' ? t : darkQuery.matches ? 'dark' : 'light';
}

function paintTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  const label = $('#theme-label'),
    icon = $('#theme-icon'),
    check = $('#theme-toggle-check'),
    headerIcon = $('#header-theme-icon');
  if (label) {
    label.textContent = t === 'dark' ? 'Tema Escuro' : 'Tema Claro';
    icon.textContent = t === 'dark' ? 'dark_mode' : 'light_mode';
  }
  if (check) check.checked = t === 'dark';
  if (headerIcon) headerIcon.textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim();
}

// Troca de tema com crossfade suave (evita o salto brusco de brilho); instantânea com movimento reduzido.
function applyTheme({ animate = false } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate && !reduce && document.startViewTransition) {
    // A second theme change or a resize can interrupt the transition. The
    // browser reports that interruption through a rejected `finished` promise;
    // it is expected and must not become an uncaught page error.
    const transition = document.startViewTransition(paintTheme);
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished.catch(() => {});
  } else paintTheme();
}

darkQuery.addEventListener('change', () => {
  if (store.get().theme === 'system') applyTheme({ animate: true });
});

// Divisória do cabeçalho só aparece quando há conteúdo rolando por baixo dele.
let scrollTicking = false;
window.addEventListener(
  'scroll',
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      $('.top-header')?.classList.toggle('scrolled', window.scrollY > 4);
      scrollTicking = false;
    });
  },
  { passive: true }
);

// Leva o foco ao título da tela, para o leitor de tela anunciar onde o usuário chegou.
function focusViewHeading({ scroll = false } = {}) {
  const target = $('#view h1') || $('#view');
  target.setAttribute('tabindex', '-1');
  target.classList.add('focus-target');
  target.focus({ preventScroll: !scroll });
}

let cleanup;
let renderId = 0;
async function render({ moveFocus = false } = {}) {
  const myRender = ++renderId;
  const key = location.hash.replace('#/', '') || 'painel';
  const route = routes[key] || routes.painel;

  // Atualiza active na sidebar e no mobile nav
  $$('.nav a, .mobile-nav a').forEach((a) => {
    const active = a.dataset.route === (routes[key] ? key : 'painel');
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const root = $('#view');
  if (typeof cleanup === 'function') cleanup();
  document.title = `${route.label} · Cola Cidadã`;
  const next = await route.view.render(root);
  // uma renderização mais nova começou enquanto esta esperava: o que ela montou é que vale
  if (myRender !== renderId) return typeof next === 'function' && next();
  cleanup = next;
  if (moveFocus && !document.querySelector('.overlay')) focusViewHeading();
}

// Registro do Service Worker (Offline & PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker ativo:', reg.scope))
      .catch((err) => console.warn('Erro ao registrar Service Worker:', err));
  });
}

initImageFallback();
// Se a fonte de ícones não carregar, o ícone some (o rótulo ao lado basta) em vez de mostrar o nome da ligadura cortado.
document.fonts?.load('24px "Material Symbols Outlined"', 'home').then(
  (f) => !f.length && document.documentElement.classList.add('no-icon-font'),
  () => document.documentElement.classList.add('no-icon-font')
);
shell();
initDynamicStyles();
applyTheme();
let lastTheme = store.get().theme;

store.subscribe((s) => {
  if (s.theme !== lastTheme) {
    lastTheme = s.theme;
    applyTheme({ animate: true });
    return;
  }
  // telas que sabem se atualizar no lugar não são remontadas (o usuário não perde busca, rolagem nem foco)
  const route = routes[routeOf()];
  if (route?.view.onStore) return route.view.onStore($('#view'), s);
  render();
});

// --- Navegação entre telas: continuidade espacial e lugar guardado ---
// O navegador não restaura a rolagem de uma tela que é remontada; guardamos por rota.
// Clicar num link do app abre a tela do topo; Voltar/Avançar devolve ao ponto onde o usuário estava.
history.scrollRestoration = 'manual';
const routeKeys = Object.keys(routes);
const routeOf = () => {
  const k = location.hash.replace('#/', '') || 'painel';
  return routes[k] ? k : 'painel';
};
let currentKey = routeOf();
const scrollByRoute = new Map();
let freshNav = false;
document.addEventListener('click', (e) => {
  if (!e.target.closest('a[href^="#/"]')) return;
  freshNav = true;
  setTimeout(() => { freshNav = false; }, 300); // o hashchange sai logo após o clique; sem ele a marca expira
}, true);

// A tela volta a crescer quando os dados chegam: reaplica a posição até ela caber ou o usuário rolar.
function restoreScroll(y) {
  window.scrollTo(0, y);
  if (!y) return () => {};
  const ro = new ResizeObserver(() => window.scrollTo(0, y));
  const stop = () => {
    ro.disconnect();
    for (const t of ['wheel', 'touchstart', 'keydown']) removeEventListener(t, stop);
  };
  ro.observe($('#view'));
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, stop, { once: true, passive: true });
  setTimeout(stop, 1500);
  return stop;
}

// Cada navegação tem uma marca: se outra começa antes de esta terminar, esta para de mexer na página.
let navToken = 0;
let stopRestore = () => {};

window.addEventListener('hashchange', () => {
  stopRestore();
  const token = ++navToken;
  const prev = currentKey;
  const key = routeOf();
  scrollByRoute.set(prev, window.scrollY);
  const target = freshNav ? 0 : scrollByRoute.get(key) ?? 0;
  freshNav = false;
  currentKey = key;

  const update = async () => {
    if (token !== navToken) return;
    window.scrollTo(0, 0);
    // a tela nova entra assim que o HTML inicial existe; dados lentos não seguram a transição
    await Promise.race([render({ moveFocus: true }), new Promise((r) => setTimeout(r, 250))]);
    if (token === navToken) stopRestore = restoreScroll(target);
  };
  const dir = routeKeys.indexOf(key) - routeKeys.indexOf(prev);
  if (dir && document.startViewTransition && !prefersReducedMotion()) {
    const root = document.documentElement;
    root.dataset.navDir = dir > 0 ? 'fwd' : 'back';
    // Navigation can be superseded by another click or a viewport resize.
    // Treat that interruption as a normal cancellation, while always clearing
    // the direction marker used by the transition CSS.
    const transition = document.startViewTransition(update);
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => delete root.dataset.navDir);
  } else {
    update();
  }
});

// Nada a escolher no primeiro acesso: o Painel abre direto, com tudo público.
// fichas antigas de ministros do STF ganham o estado de nascimento e a foto antes da primeira tela
await refreshFollowed().catch(() => {});
render();
