// Utilitários de UI e domínio.
import { spring, project, rubberband, velocityFrom, prefersReducedMotion } from './motion.js';
import { partyName, partyFlag, stateFlag, birthplace, isMagistrate } from './simbolos.js';
import { safeUrl } from './urls.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Títulos que vêm antes do nome ("Pref. Abilio Brunini", "Presidente Lula") não entram nas iniciais.
// Só o que o app mesmo coloca ("Pref.", "Gov.", "Dep.", "Ver.", "Min.", "Presidente") e abreviaturas com ponto:
// um nome que apenas começa com "Cap" ou "Min", sem ponto, continua inteiro.
const TITLE = /^(presidente|(pref|gov|dep|ver|min|sen|sr|sra|dr|dra|prof|profa|cel|cap|sgt|gen|cons)\.)$/i;
export const initials = (n = '') => {
  const words = String(n).split(/\s+/).filter(Boolean);
  const rest = words.filter((w, i) => !(i === 0 && words.length > 1 && TITLE.test(w)));
  return rest.slice(0, 2).map((w) => [...w][0]).join('').toUpperCase();
};

// Fotos oficiais: sempre https (o Senado ainda entrega http, que a CSP e o navegador bloqueiam) e direto na
// URL final, sem os dois redirecionamentos que o endereço antigo faz até chegar ao arquivo.
export function photoUrl(u) {
  if (!u) return '';
  const url = String(u).replace(/^http:\/\//i, 'https://');
  const m = url.match(/^https:\/\/www\.senado\.leg\.br\/senadores\/img\/fotos-oficiais\/senador(\d+)\.jpg$/i);
  return safeUrl(m ? `https://legis.senado.leg.br/senadores/fotos-oficiais/${m[1]}` : url);
}

// Foto que não carrega (rede, bloqueio, arquivo removido) vira as iniciais, em vez do texto alternativo quebrado.
// Ouve a fase de captura porque `error` não borbulha; a CSP não permite onerror inline.
export function initImageFallback(doc = document) {
  doc.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img?.tagName !== 'IMG' || !img.classList.contains('avatar')) return;
      const box = doc.createElement('div');
      box.className = img.className;
      box.setAttribute('aria-hidden', 'true'); // decorativo, como a foto: o nome está escrito ao lado
      box.textContent = initials(img.dataset.name);
      img.replaceWith(box);
    },
    true
  );
}

// Quem foi acompanhado antes de as fotos existirem guarda a ficha sem `photo`: se tem ficha do TSE, a foto está no caminho de sempre
// (se o arquivo não existir, o navegador não carrega e a foto vira as iniciais, como qualquer foto que falha).
const tsePhoto = (p) => (p.tse?.sq && p.tse?.year ? `/fotos/tse/${p.tse.year}/${p.tse.sq}.jpg` : '');

export function avatar(p, cls = '') {
  const photo = photoUrl(p.photo || tsePhoto(p));
  return photo
    ? `<img class="avatar ${cls}" src="${esc(photo)}" alt="" data-name="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<div class="avatar ${cls}" aria-hidden="true">${esc(initials(p.name))}</div>`;
}

// Bandeira pequena ao lado do texto: decorativa (o nome do partido ou do estado está escrito ao lado).
const flagImg = (asset) => (asset ? `<img class="flag" src="${esc(asset.arquivo)}" alt="" width="22" height="16" loading="lazy" decoding="async">` : '');

/**
 * No lugar certo do cartão e da ficha: a bandeira e a sigla do partido; para magistrado, que não tem vínculo partidário,
 * o estado onde nasceu (com a bandeira dele). Sem partido e sem naturalidade conhecida, nada.
 */
export function partyChip(p, cls = '') {
  if (isMagistrate(p)) {
    const b = birthplace(p);
    if (!b) return '';
    return `<span class="chip xs ${cls}" title="Natural de ${esc(b.cidade ? `${b.cidade}, ${b.estado}` : b.estado)}">${flagImg(stateFlag(b.uf))}Natural de ${esc(b.uf)}</span>`;
  }
  const party = partyName(p);
  if (!party) return '';
  return `<span class="chip xs ${cls}">${flagImg(partyFlag(party))}${esc(party)}</span>`;
}

export const ROLES = {
  presidente: { label: 'Presidente', term: 4 },
  'ministro-stf': { label: 'Ministro(a) do STF', term: 0 },
  governador: { label: 'Governador(a)', term: 4 },
  prefeito: { label: 'Prefeito(a)', term: 4 },
  senador: { label: 'Senador(a)', term: 8 },
  'dep-federal': { label: 'Deputado(a) Federal', term: 4 },
  'dep-estadual': { label: 'Deputado(a) Estadual', term: 4 },
  vereador: { label: 'Vereador(a)', term: 4 },
};

// Mandatos eleitos em out/2022 começam em 1/jan/2023 (Presidente, Governadores; terminam em 5/jan/2027, pois a posse seguinte passa a ser em 6/jan, EC 111/2021)
// ou 1/fev/2023 (Legislativo federal e estadual) e terminam 4 anos depois.
// Exceção: a 20ª legislatura da ALESP tomou posse em 15/mar/2023; uma PEC da Alesp antecipou
// a posse seguinte para 1/fev/2027, então o mandato atual termina em 31/jan/2027.
// Senadores eleitos em 2018 terminam em 31/jan/2027; os de 2022, em 31/jan/2031.
// Vereadores eleitos em 2024 iniciam mandato em 1/jan/2025 até 31/dez/2028.
export function defaultMandate(role, uf) {
  const dates = {
    presidente: ['2023-01-01', '2027-01-05'],
    governador: ['2023-01-01', '2027-01-05'],
    'dep-federal': ['2023-02-01', '2027-01-31'],
    'dep-estadual': String(uf || '').toUpperCase() === 'SP' ? ['2023-03-15', '2027-01-31'] : ['2023-02-01', '2027-01-31'],
    senador: ['2023-02-01', '2031-01-31'],
    vereador: ['2025-01-01', '2028-12-31'],
    prefeito: ['2025-01-01', '2028-12-31'],
  };
  return dates[role];
}

// Cadastros antigos gravaram a data da ALESP (15/03/2023–14/03/2027) para todas as assembleias.
const LEGACY_STATE_MANDATE = '2023-03-15|2027-03-14';

export function mandateProgress(p) {
  const stored = p.mandate && p.mandate.join('|') !== LEGACY_STATE_MANDATE ? p.mandate : null;
  const [start, end] = stored || defaultMandate(p.roleKey, p.uf) || [];
  // Ministros do STF não têm mandato: o cargo é vitalício, até a aposentadoria compulsória aos 75 anos.
  if (!start) return { pct: 0, label: p.roleKey === 'ministro-stf' ? 'Cargo vitalício (até os 75 anos)' : '—', open: true };
  const s = new Date(start), e = new Date(end), now = new Date();
  const pct = Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100));
  const left = Math.ceil((e - now) / 864e5);
  return {
    pct: Math.round(pct),
    label: left > 0 ? `${left} dias restantes` : 'Mandato encerrado',
    end: e.toLocaleDateString('pt-BR'),
    ended: left <= 0,
  };
}

const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info', delete: 'delete' };

// Snackbar com região live para leitores de tela; `action` adiciona um botão (ex.: Desfazer).
// Toque háptico curto, só onde confirma um ato (remover, desfazer). Silencioso sem suporte (iOS) e com movimento reduzido.
export function buzz(ms = 10) {
  if (!prefersReducedMotion()) navigator.vibrate?.(ms);
}

export function toast(msg, icon = 'check_circle', { action, duration } = {}) {
  document.querySelectorAll('.toast').forEach((old) => old.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.innerHTML = `<span class="mi" aria-hidden="true">${TOAST_ICONS[icon] || icon}</span><span class="toast-msg">${esc(msg)}</span>`;
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    t.classList.add('leaving');
    t.addEventListener('animationend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 400);
  };
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.label;
    b.onclick = () => {
      buzz(8);
      action.onClick();
      dismiss();
    };
    t.append(b);
  }
  document.body.append(t);
  const wait = duration || (action ? 6000 : 3200);
  timer = setTimeout(dismiss, wait);
  if (icon === 'delete') buzz(15);
  enableToastSwipe(t, {
    hold: () => clearTimeout(timer), // segurando o aviso, ele não some
    resume: () => { timer = setTimeout(dismiss, wait); },
    dismiss: () => t.remove(),
  });
}

// Arrastar o aviso para o lado o dispensa: acompanha o dedo 1:1, projeta a inércia na soltura e anima
// com mola a partir da velocidade do gesto (volta ao lugar se o arrasto for curto).
function enableToastSwipe(t, { hold, resume, dismiss }) {
  let startX = 0, offset = 0, dragging = false, samples = [], anim = null;
  const apply = (x) => {
    offset = x;
    t.style.transform = x ? `translateX(${x}px)` : '';
    t.style.opacity = String(Math.max(0, 1 - Math.abs(x) / (t.offsetWidth * 1.2)));
  };
  t.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    t.setPointerCapture(e.pointerId);
    if (anim?.running) apply(anim.stop().value);
    startX = e.clientX - offset;
    samples = [{ v: e.clientX, t: e.timeStamp }];
    dragging = true;
    hold();
  });
  t.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    apply(e.clientX - startX);
    samples.push({ v: e.clientX, t: e.timeStamp });
    if (samples.length > 6) samples.shift();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    const velocity = velocityFrom(samples);
    const w = t.offsetWidth;
    const gone = Math.abs(offset + project(velocity)) > w * 0.4;
    if (prefersReducedMotion()) {
      if (gone) dismiss();
      else { apply(0); resume(); }
      return;
    }
    const dir = Math.sign(offset + project(velocity)) || 1;
    anim = spring({
      from: offset,
      to: gone ? dir * (w + 32) : 0,
      velocity,
      dampingRatio: 1,
      response: gone ? 0.28 : 0.35,
      onUpdate: apply,
      onComplete: gone ? dismiss : resume,
    });
  };
  t.addEventListener('pointerup', release);
  t.addEventListener('pointercancel', release);
}

let scrollLocks = 0;
// Só o que o Tab alcança: abas inativas (tabindex=-1, ver tablist) ficam de fora, senão o ciclo nunca fecha.
const FOCUSABLE = ':is(a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]):not([tabindex="-1"])';

// Enquanto houver diálogo aberto, o resto do app sai da árvore de acessibilidade e não recebe foco nem cliques.
function setBackgroundInert(on) {
  document.documentElement.classList.toggle('modal-open', on);
  document.querySelector('.app-wrapper')?.toggleAttribute('inert', on);
}

// Diálogo modal: entra e sai pelo mesmo caminho, fecha com Esc, prende o foco e devolve-o ao gatilho.
// Em telas estreitas vira folha inferior, movida por mola do começo ao fim: pode ser agarrada
// (pela alça, em qualquer momento) e arrastada para baixo para fechar.
export function modal(html) {
  const opener = document.activeElement;
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" tabindex="-1"><div class="sheet-grabber" aria-hidden="true"></div>${html}</div>`;
  const m = o.lastChild;
  const heading = m.querySelector('h1, h2, h3, h4');
  if (heading) {
    heading.id ||= `dlg-${Math.random().toString(36).slice(2, 8)}`;
    m.setAttribute('aria-labelledby', heading.id);
  }

  // Teclado virtual: o diálogo acompanha a área realmente visível (o iOS não encolhe a viewport de layout),
  // então a folha encosta no teclado em vez de ficar escondida atrás dele.
  const vv = window.visualViewport;
  const fit = () => {
    const zoomed = vv.scale > 1.01;
    o.style.top = zoomed ? '' : `${vv.offsetTop}px`;
    o.style.height = zoomed ? '' : `${vv.height}px`;
    o.style.setProperty('--vv-h', zoomed ? '100dvh' : `${vv.height}px`);
  };
  const reveal = (e) => {
    // com o teclado abrindo, o campo focado vai para o meio da área visível
    if (!e.target.matches('input, textarea, select')) return;
    setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }), 300);
  };
  if (vv) {
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
  }
  o.addEventListener('focusin', reveal);

  let closed = false;
  let sheet = null;
  const finish = () => {
    if (!o.isConnected) return;
    if (vv) {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    }
    o.remove();
    document.removeEventListener('keydown', onKey, true);
    if (--scrollLocks === 0) setBackgroundInert(false);
    const nothingFocused = !document.activeElement || document.activeElement === document.body;
    if (nothingFocused && opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const close = ({ animate = true } = {}) => {
    if (closed) return;
    closed = true;
    if (!animate) return finish();
    if (sheet?.springs()) return sheet.close(finish);
    o.classList.add('closing');
    o.addEventListener('animationend', (e) => e.target === m && finish());
    setTimeout(finish, 450);
  };

  const onKey = (e) => {
    const top = [...document.querySelectorAll('.overlay:not(.closing)')].pop();
    if (top !== o) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const items = [...m.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === m)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
  o.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  if (scrollLocks++ === 0) setBackgroundInert(true);
  sheet = createSheet(o, m, {
    dismiss: () => { closed = true; finish(); },
    reopen: () => { closed = false; }, // agarrou a folha que estava fechando
  });
  document.body.append(o);
  m.focus({ preventScroll: true });
  sheet.enter();
  return { el: m, close };
}

const isNarrow = () => matchMedia('(max-width: 600px)').matches;

// Física da folha inferior. Um só estado (`offset`, em px abaixo da posição de repouso) é movido
// pelo dedo (1:1, com resistência para cima), pela entrada e pela saída (molas). Qualquer gesto
// agarra a folha onde ela estiver: a mola em curso é parada e o arrasto continua do valor apresentado.
//  - Alça (Pointer Events + captura): sempre arrasta, com o conteúdo rolado ou não, com dedo, caneta ou mouse.
//  - Corpo (eventos de toque): arrasta quando o conteúdo está no topo; senão rola normalmente. O toque
//    precisa de preventDefault no touchmove, que Pointer Events não permite, então o corpo segue em touch.
function createSheet(o, m, { dismiss, reopen }) {
  const grabber = m.querySelector('.sheet-grabber');
  let offset = 0, startY = 0, startX = 0, decided = false, dragging = false, closing = false;
  let samples = [];
  let anim = null;

  // Mola só quando a tela é estreita e o usuário não pediu menos movimento.
  const springs = () => isNarrow() && !prefersReducedMotion();

  const apply = (y) => {
    offset = y;
    m.style.transform = y ? `translateY(${y}px)` : '';
    const h = m.offsetHeight || 1;
    o.style.setProperty('--scrim', String(Math.max(0, 1 - Math.max(0, y) / h)));
  };

  const animateTo = (to, velocity, response, onComplete) => {
    if (anim?.running) anim.stop();
    anim = spring({ from: offset, to, velocity, dampingRatio: 1, response, onUpdate: apply, onComplete });
  };

  const grab = (y, t) => {
    samples = [{ v: y, t }];
    if (anim?.running) {
      const { value } = anim.stop();
      if (closing) { closing = false; reopen(); }
      apply(value);
      startY = y - value;
      decided = dragging = true;
      return true;
    }
    startY = y;
    return false;
  };

  const move = (y, t) => {
    const raw = y - startY;
    apply(raw >= 0 ? raw : -rubberband(-raw, m.offsetHeight));
    samples.push({ v: y, t });
    if (samples.length > 6) samples.shift();
  };

  const release = () => {
    if (!dragging) return;
    dragging = false;
    const velocity = velocityFrom(samples);
    const h = m.offsetHeight;
    const shouldDismiss = offset + project(velocity) > h * 0.5;
    if (prefersReducedMotion()) {
      if (shouldDismiss) dismiss();
      else apply(0);
      return;
    }
    if (shouldDismiss) closing = true;
    animateTo(shouldDismiss ? h + 24 : 0, velocity, shouldDismiss ? 0.28 : 0.35, shouldDismiss ? dismiss : undefined);
  };

  // --- alça: Pointer Events com captura ---
  grabber.addEventListener('pointerdown', (e) => {
    if (!isNarrow() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    grabber.setPointerCapture(e.pointerId);
    grab(e.clientY, e.timeStamp);
    dragging = true;
    decided = true;
  });
  grabber.addEventListener('pointermove', (e) => {
    if (dragging && grabber.hasPointerCapture(e.pointerId)) move(e.clientY, e.timeStamp);
  });
  grabber.addEventListener('pointerup', release);
  grabber.addEventListener('pointercancel', release);

  // --- corpo: toque, só com o conteúdo no topo ---
  m.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('.sheet-grabber')) return;
    const t = e.touches[0];
    startX = t.clientX;
    if (!grab(t.clientY, e.timeStamp)) decided = dragging = false;
  }, { passive: true });

  m.addEventListener('touchmove', (e) => {
    if (e.target.closest('.sheet-grabber')) return;
    const t = e.touches[0];
    if (!decided) {
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.hypot(dx, dy) < 10) return; // histerese antes de escolher a direção
      decided = true;
      const blocked = e.target.closest('input, textarea, select, .tabs, [data-no-drag]');
      dragging = isNarrow() && dy > 0 && Math.abs(dy) > Math.abs(dx) && m.scrollTop <= 0 && !blocked;
      if (!dragging) return;
      startY = t.clientY;
    }
    if (!dragging) return;
    e.preventDefault();
    move(t.clientY, e.timeStamp);
  }, { passive: false });
  m.addEventListener('touchend', (e) => { if (!e.target.closest('.sheet-grabber')) release(); });
  m.addEventListener('touchcancel', (e) => { if (!e.target.closest('.sheet-grabber')) release(); });

  return {
    springs,
    // Entrada: sobe da borda por mola, a partir de fora da tela. Pode ser agarrada desde o primeiro quadro.
    enter() {
      if (!springs()) return;
      o.classList.add('sheet-mode');
      apply(m.offsetHeight);
      animateTo(0, 0, 0.32);
    },
    // Saída por botão, Esc ou toque no fundo: desce pelo mesmo caminho, a partir de onde a folha estiver.
    close(done) {
      closing = true;
      dragging = false;
      o.classList.add('sheet-mode');
      animateTo(m.offsetHeight + 24, 0, 0.28, done);
    },
  };
}

// Espaço reservado com a forma do conteúdo que vai chegar (evita o salto de layout) e a legenda do que está
// acontecendo, anunciada como status. Larguras e brilho ficam no CSS (.sk-*), sem atributo de estilo.
export function skeleton(label, rows = 2) {
  const card = '<div class="sk-card"><i class="sk-line"></i><i class="sk-line"></i><i class="sk-line"></i></div>';
  return `<div class="skeleton" role="status" aria-live="polite"><p class="xs muted">${esc(label)}</p>${card.repeat(rows)}</div>`;
}

export const VOTE_CLASS = { Sim: 'sim', Não: 'nao' };
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Grupo de abas acessível (padrão WAI-ARIA): papéis tablist/tab/tabpanel, um só ponto de Tab no grupo
// e setas, Home e End para trocar de aba. A troca de conteúdo continua no onclick de cada view;
// aqui só se espelha a seleção no ARIA e o teclado aciona o clique.
export function tablist(container, panelFor) {
  if (!container) return;
  const tabs = [...container.querySelectorAll(':scope > button')];
  container.setAttribute('role', 'tablist');

  // Indicador que desliza de uma aba à outra (posição e largura pelo CSSOM, que a CSP permite).
  // Só nos grupos com o visual de pílula (.tabs); outros estilos de abas ficam como estão.
  const pill = container.classList.contains('tabs');
  const ind = document.createElement('i');
  ind.className = 'tab-ind';
  ind.setAttribute('aria-hidden', 'true');
  if (pill) {
    container.prepend(ind);
    container.classList.add('has-ind');
  }
  // `instant`: reposicionamento por redimensionamento/fonte não anima; só a troca de aba desliza
  const place = (instant = false) => {
    if (!pill) return;
    const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true');
    if (!t || !t.offsetWidth) return; // contêiner ainda escondido: o ResizeObserver chama de novo ao aparecer
    if (instant === true && ind.classList.contains('ready')) {
      ind.classList.remove('ready');
      requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.add('ready')));
    }
    ind.style.width = `${t.offsetWidth}px`;
    ind.style.height = `${t.offsetHeight}px`;
    ind.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`;
  };
  // só anima depois da primeira posição, para o indicador não "voar" ao aparecer
  if (pill) {
    requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.add('ready')));
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => place(true)).observe(container);
    document.fonts?.ready.then(() => place(true));
  }

  const select = (tab) => {
    tabs.forEach((t) => {
      t.setAttribute('aria-selected', String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
    });
    place();
  };
  tabs.forEach((t, i) => {
    t.setAttribute('role', 'tab');
    t.id ||= `${container.id || 'tabs'}-tab-${i}`;
    const panel = panelFor(t);
    if (panel) {
      t.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', t.id);
    }
    t.addEventListener('click', () => {
      select(t);
      // o painel aparece com um esmaecimento curto (a view já o mostrou neste mesmo clique)
      if (panel && !panel.classList.contains('tab-enter')) {
        panel.classList.add('tab-enter');
        panel.addEventListener('animationend', () => panel.classList.remove('tab-enter'), { once: true });
      }
    });
  });
  select(tabs.find((t) => t.classList.contains('on') || t.classList.contains('active')) || tabs[0]);
  container.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    tab.focus();
    tab.click();
  });
}
