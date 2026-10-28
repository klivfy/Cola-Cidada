import { test, expect, seed, go, ROUTES, ICONS, CSP } from './fixtures.mjs';

test.describe('telas', () => {
  for (const theme of ['light', 'dark']) {
    test(`todas as telas renderizam sem estourar a largura (${theme})`, async ({ page }) => {
      await seed(page, { theme });
      for (const r of ROUTES) {
        await go(page, r);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow, `${r} mais larga que a tela`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('fonte grande do sistema (24 px): texto cresce e nada estoura', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24 } });
    await seed(page);
    for (const r of ROUTES) {
      await go(page, r);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${r} mais larga que a tela`).toBeLessThanOrEqual(0);
    }
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBe(21);
    const nav = page.locator('.mobile-nav a');
    if (await nav.first().isVisible()) {
      const boxes = await nav.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      expect(Math.max(...boxes)).toBeLessThanOrEqual(page.viewportSize().width);
    }
  });

  // fração visível da pílula: ela ocupa a trilha toda e é deslocada para a esquerda por transform
  const fillOf = (i) => {
    const w = i.offsetWidth;
    return Math.round(((w + new DOMMatrix(getComputedStyle(i).transform).m41) / w) * 100);
  };

  test('barras de progresso refletem data-w por transform, sem style de largura no HTML', async ({ page }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    const bar = page.locator('.pol-card .bar > i').first();
    const pct = parseInt((await page.locator('.pol-card b', { hasText: '% cumprido' }).first().innerText()), 10);
    await expect.poll(() => bar.evaluate(fillOf), 'preenchimento final (após a transição)').toBe(pct);
    expect(await bar.evaluate((i) => i.style.width), 'não usa width').toBe('');
    // barra que chega depois da primeira exibição entra já no lugar, sem recomeçar do zero
    await page.waitForTimeout(1200);
    const late = await page.evaluate((fn) => {
      document.body.insertAdjacentHTML('beforeend', '<div class="bar" id="t"><i data-w="25"></i></div>');
      const i = document.querySelector('#t i');
      return new Promise((r) => queueMicrotask(() => queueMicrotask(() => r(new Function('i', `return (${fn})(i)`)(i)))));
    }, fillOf.toString());
    expect(late).toBe(25);
  });

  test('ícones não herdam maiúsculas nem espaçamento (a ligadura se perderia)', async ({ page }) => {
    await seed(page);
    for (const r of ROUTES) {
      await go(page, r);
      const bad = await page.evaluate(() => [...document.querySelectorAll('.mi')].filter((e) => {
        const cs = getComputedStyle(e);
        return cs.textTransform !== 'none' || (cs.letterSpacing !== 'normal' && cs.letterSpacing !== '0px');
      }).map((e) => e.textContent.trim()));
      expect(bad, `ícones afetados em ${r}`).toEqual([]);
    }
    // contêiner em maiúsculas com ícone dentro: o caso do cartão "Próximo evento"
    const ok = await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<h3 id="up" style="text-transform:uppercase;letter-spacing:2px"><span class="mi">event</span>X</h3>');
      const cs = getComputedStyle(document.querySelector('#up .mi'));
      return cs.textTransform === 'none' && cs.letterSpacing === 'normal';
    });
    expect(ok).toBe(true);
  });

  test('faixas rolagem horizontal esmaecem só do lado com conteúdo', async ({ page }) => {
    await seed(page);
    await go(page, 'inicio');
    const r = await page.evaluate(async () => {
      document.body.insertAdjacentHTML('beforeend', '<div id="strip" data-edge-fade><div id="inner"></div></div>');
      const el = document.querySelector('#strip');
      el.style.cssText = 'width:200px;overflow-x:auto;';
      document.querySelector('#inner').style.cssText = 'width:600px;height:10px';
      const tick = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const read = () => [el.classList.contains('edge-fade'), el.style.getPropertyValue('--fade-l'), el.style.getPropertyValue('--fade-r')];
      await tick();
      const start = read();
      el.scrollLeft = 200; await tick();
      const middle = read();
      el.scrollLeft = 1000; await tick();
      const end = read();
      el.querySelector('#inner').style.width = '100px'; el.dispatchEvent(new Event('scroll')); await tick();
      const fits = read();
      return { start, middle, end, fits };
    });
    expect(r.start).toEqual([true, '0px', '1.5rem']);
    expect(r.middle).toEqual([true, '1.5rem', '1.5rem']);
    expect(r.end).toEqual([true, '1.5rem', '0px']);
    expect(r.fits[0]).toBe(false);
  });

  test('ícones usados estão no subconjunto da fonte', async ({ page }) => {
    await seed(page);
    const used = new Set();
    const collect = async () => (await page.$$eval('.mi', (els) => els.map((e) => e.textContent.trim()))).forEach((t) => t && used.add(t));
    for (const r of ROUTES) { await go(page, r); await collect(); }
    await go(page, 'meus-politicos');
    for (const sel of ['[data-details]', '[data-dossier]', '[data-share]']) {
      await page.locator(sel).first().click();
      await page.waitForSelector('.overlay .modal');
      await collect();
      await page.keyboard.press('Escape');
      await expect(page.locator('.overlay')).toHaveCount(0);
    }
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=orgaos]').click();
    await page.waitForSelector('[data-accounts]');
    await collect();
    await page.locator('#painel-tabs [data-section=governadores]').click();
    await page.locator('.painel-open').first().click();
    await page.waitForSelector('#follow-btn');
    await page.locator('#follow-btn').click();
    await collect();
    expect([...used].filter((i) => !ICONS.has(i))).toEqual([]);
  });

  test('CSP do vercel.json não bloqueia nada do app', async ({ page }) => {
    await page.route('http://localhost:4173/**', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
    });
    const violations = [];
    await page.exposeFunction('__csp', (v) => violations.push(v));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.__csp(`${e.violatedDirective} ${e.blockedURI}`)));
    await seed(page);
    for (const r of ROUTES) await go(page, r);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.waitForSelector('#pol-tabs');
    expect(violations).toEqual([]);
  });
});

test.describe('diálogos', () => {
  test('abas da ficha ficam visíveis e acessíveis', async ({ page }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    const tabs = page.locator('#pol-tabs');
    await expect(tabs).toHaveAttribute('role', 'tablist');
    expect((await tabs.boundingBox()).height).toBeGreaterThanOrEqual(36);
    const second = tabs.locator('button').nth(1);
    await second.click();
    await expect(second).toHaveAttribute('aria-selected', 'true');
  });

  test('modal de análise alterna as abas e mostra o resultado do simulador', async ({ page }) => {
    await seed(page);
    await go(page, 'inicio');
    await page.evaluate(async () => {
      const m = await import('/src/analysis.js');
      m.openAnalysisModal({ type: 'PL', number: '1', year: '2024', summary: 'Dispõe sobre o saneamento básico.' });
    });
    await expect(page.locator('#tab-summary-content')).toContainText('Dados oficiais da proposição');
    await expect(page.locator('#tab-summary-content')).not.toContainText('Impacto Financeiro');
    const panes = { summary: '#tab-summary-content', jabuti: '#tab-jabuti-content', simulator: '#tab-simulator-content' };
    for (const [tab, sel] of Object.entries(panes)) {
      await page.locator(`#tab-${tab}-btn`).click();
      for (const [other, osel] of Object.entries(panes)) {
        await (other === tab ? expect(page.locator(osel)).toBeVisible() : expect(page.locator(osel)).toBeHidden());
      }
    }
    await page.locator('#btn-run-sim').click();
    await expect(page.locator('#sim-result-container')).toBeVisible();
    await page.locator('#sim-text-input').fill('Art. 42-A. Prorroga o subsídio da usina termelétrica a carvão mineral.');
    await page.locator('#btn-run-sim').click();
    await expect(page.locator('#sim-result-container .verdict')).toBeVisible();
  });

  test('Esc fecha, foco fica preso e volta ao botão de origem', async ({ page, isMobile }) => {
    test.skip(isMobile, 'teclado só no desktop');
    await seed(page);
    await go(page, 'meus-politicos');
    const trigger = page.locator('[data-details]').first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.modal')).toHaveAttribute('aria-labelledby', /.+/);
    await expect(page.locator('.app-wrapper'), 'fundo fora do alcance do leitor de tela').toHaveAttribute('inert');
    // A cada Tab (e Shift+Tab) o foco segue dentro do diálogo; abas inativas (tabindex=-1) não contam como fim do ciclo.
    for (const key of [...Array(15).fill('Tab'), ...Array(15).fill('Shift+Tab')]) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), `foco escapou após ${key}`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.overlay')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.classList.contains('modal-open'))).toBe(false);
    await expect(page.locator('.app-wrapper')).not.toHaveAttribute('inert');
  });

  test('folha inferior: arrasto curto volta, arrasto longo fecha', async ({ page, isMobile, context }) => {
    test.skip(!isMobile, 'gesto só no celular');
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.waitForTimeout(400);
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('.modal').boundingBox();
    const drag = async (dy, steps, ms) => {
      const x = box.x + box.width / 2, y = box.y + 30;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / steps }] });
        await page.waitForTimeout(ms);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // curto e lento: posição + inércia projetada ficam bem abaixo de metade da folha (que é baixa sem as APIs)
    await drag(60, 12, 40);
    await page.waitForTimeout(800);
    await expect(page.locator('.overlay')).toHaveCount(1);
    // longo o bastante para fechar só pela posição: a inércia (velocityFrom/project) tem testes unitários
    // e a entrega dos toques via CDP varia com a carga da máquina
    await drag(240, 6, 8);
    await expect(page.locator('.overlay')).toHaveCount(0);
  });

  // Toques reais via CDP (geram Pointer Events na alça e eventos de toque no corpo).
  const touchTools = async (page, context) => {
    const cdp = await context.newCDPSession(page);
    const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const offset = () => page.locator('.modal').evaluate((m) => parseFloat(m.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? '0'));
    return { send, offset };
  };

  test('folha: a alça fecha mesmo com o conteúdo rolado (o corpo só rola)', async ({ page, isMobile, context }) => {
    test.skip(!isMobile, 'gesto só no celular');
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.waitForTimeout(600);
    // em repouso a alça não cobre nada do conteúdo (a faixa é sólida: já cortou o avatar do cabeçalho)
    const overlap = await page.locator('.modal').evaluate((m) => m.querySelector('.sheet-grabber').getBoundingClientRect().bottom - m.children[1].getBoundingClientRect().top);
    expect(overlap, 'alça sobre o conteúdo').toBeLessThanOrEqual(0.5);
    // conteúdo comprido e já rolado: antes, arrastar de cima rolava o conteúdo em vez de fechar a folha
    await page.locator('.modal').evaluate((m) => {
      const pad = document.createElement('div');
      pad.style.height = '1500px';
      m.append(pad);
      m.scrollTop = 80;
    });
    const { send } = await touchTools(page, context);
    const box = await page.locator('.sheet-grabber').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await send('touchStart', x, y);
    for (let i = 1; i <= 8; i++) {
      await send('touchMove', x, y + i * 40);
      await page.waitForTimeout(10);
    }
    await send('touchEnd');
    await expect(page.locator('.overlay')).toHaveCount(0);
  });

  test('folha: pode ser agarrada no meio da entrada e do fechamento', async ({ page, isMobile, context }) => {
    test.skip(!isMobile, 'gesto só no celular');
    await seed(page);
    await go(page, 'meus-politicos');
    // relógio parado: o tempo só anda com runFor, então "no meio da animação" é determinístico
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    const { send, offset } = await touchTools(page, context);

    // entrada: com o tempo parado a 60 ms, a folha ainda está bem abaixo do repouso
    await page.locator('[data-details]').first().click();
    await page.clock.runFor(100);
    const mid = await offset();
    expect(mid, 'folha ainda subindo').toBeGreaterThan(20);
    const vh = page.viewportSize().height;
    const box = await page.locator('.modal').boundingBox();
    const x = box.x + box.width / 2, y = Math.min(box.y + 80, vh - 8); // dentro da folha e da tela
    await send('touchStart', x, y);
    await send('touchMove', x, y + 20);
    await send('touchMove', x, y + 120);
    // antes a animação (@keyframes) vencia o arrasto; agora o dedo continua de onde a folha estava
    expect(await offset(), 'arrasto segue o dedo a partir do valor apresentado').toBeGreaterThan(mid + 60);
    await send('touchEnd');
    await page.clock.runFor(1500);
    await expect(page.locator('.overlay')).toHaveCount(0);

    // fechamento: agarrar a folha que desce a traz de volta, e ela continua fechável
    await page.locator('[data-details]').first().click();
    await page.clock.runFor(1000);
    await page.locator('.modal').evaluate((m) => m.querySelector('[data-close]')?.click());
    await page.clock.runFor(60);
    const midClose = await offset();
    expect(midClose, 'folha descendo').toBeGreaterThan(20);
    const box2 = await page.locator('.modal').boundingBox();
    const x2 = box2.x + box2.width / 2, y2 = Math.min(box2.y + 80, vh - 8);
    await send('touchStart', x2, y2);
    await send('touchMove', x2, y2 + 1);
    await send('touchEnd');
    await page.clock.runFor(1500);
    await expect(page.locator('.overlay'), 'agarrada, a folha volta e fica').toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.clock.runFor(1500);
    await expect(page.locator('.overlay'), 'e ainda fecha depois').toHaveCount(0);
  });

  test('desfoque do fundo só em telas largas; no celular o fundo só escurece', async ({ page, isMobile }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.waitForSelector('.overlay .modal');
    const f = await page.locator('.overlay').evaluate((o) => getComputedStyle(o).backdropFilter);
    if (isMobile) expect(f, 'sem blur de tela inteira no celular').toBe('none');
    else expect(f).toContain('blur');
  });

  test('movimento reduzido troca deslizamento por esmaecimento', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    expect(await page.locator('.modal').evaluate((m) => getComputedStyle(m).animationName)).toBe('fade');
  });
});

test.describe('navegação entre telas', () => {
  const navLink = (page, route) => page.locator(`a[data-route="${route}"]:visible`).first();
  const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));

  test('Voltar devolve a rolagem; clicar num link abre do topo', async ({ page }) => {
    await seed(page);
    await go(page, 'perfil');
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => scrollY(page)).toBe(400);

    await navLink(page, 'inicio').click();
    await expect(page).toHaveURL(/#\/inicio$/);
    await expect.poll(() => scrollY(page), 'link do app abre do topo').toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/#\/perfil$/);
    await expect.poll(() => scrollY(page), 'Voltar restaura onde o usuário estava').toBe(400);

    await page.goForward();
    await expect(page).toHaveURL(/#\/inicio$/);
    await navLink(page, 'perfil').click();
    await expect.poll(() => scrollY(page), 'abrir a tela de novo por link volta ao topo').toBe(0);
  });

  test('o conteúdo desliza na direção do item da navegação e o nome da transição some depois', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' }); // não depende do que o sistema do CI informa
    await seed(page);
    await go(page, 'inicio');
    const env = await page.evaluate(() => ({ vt: typeof document.startViewTransition, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    test.skip(env.vt !== 'function', 'navegador sem View Transitions: a troca é instantânea');
    // espia a chamada à transição: registra a direção no instante em que ela começa (sem depender de pegar um atributo passageiro)
    await page.evaluate(() => {
      window.__vt = [];
      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        window.__vt.push(document.documentElement.dataset.navDir);
        return orig(cb);
      };
    });
    await navLink(page, 'comparador').click(); // adiante na navegação
    // espera a tela nova montar antes de voltar: com a página lenta os dois hashchange se acumulariam e o app,
    // ao tratá-los, já leria o endereço final (inicio → inicio, sem transição)
    await expect(page.locator('#view h1')).toContainText('Comparador');
    await page.goBack(); // para trás
    await expect(page.locator('#view h1')).toContainText('Acompanhamento');
    const diag = async () => `ambiente: ${JSON.stringify(env)} chamadas: ${JSON.stringify(await page.evaluate(() => window.__vt))} hash: ${await page.evaluate(() => location.hash)}`;
    await expect.poll(() => page.evaluate(() => window.__vt.join(',')), await diag()).toBe('fwd,back');
    await expect.poll(() => page.evaluate(() => 'navDir' in document.documentElement.dataset), 'marca some ao fim').toBe(false);
  });

  test('com movimento reduzido a troca é instantânea, sem transição', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await go(page, 'inicio');
    await page.evaluate(() => {
      window.__dirs = [];
      new MutationObserver(() => window.__dirs.push(document.documentElement.dataset.navDir)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-nav-dir'] });
    });
    await navLink(page, 'comparador').click();
    await expect(page).toHaveURL(/#\/comparador$/);
    await expect(page.locator('#view h1')).toContainText('Comparador');
    expect(await page.evaluate(() => window.__dirs)).toEqual([]);
  });
});

test.describe('abas e carregamento', () => {
  test('o indicador acompanha a aba ativa e desliza ao trocar; o painel entra com esmaecimento', async ({ page }) => {
    await seed(page);
    await go(page, 'comparador');
    const tabs = page.locator('#house-tabs > button');
    const ind = page.locator('#house-tabs > .tab-ind');
    const gap = async (tab) => {
      const [a, b] = await Promise.all([ind.boundingBox(), tab.boundingBox()]);
      return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
    };
    await expect(ind).toHaveClass(/ready/);
    expect(await gap(tabs.nth(0)), 'indicador sobre a aba ativa').toBeLessThanOrEqual(1);
    // a pílula passa a ser o indicador, não o botão
    expect(await tabs.nth(0).evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

    const anim = await page.evaluate(() => {
      const btn = document.querySelectorAll('#house-tabs > button')[1];
      btn.click();
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      return getComputedStyle(panel).animationName;
    });
    expect(anim, 'painel novo entra com animação').toBe('tab-in');
    await expect.poll(() => gap(tabs.nth(1)), 'indicador chega na aba nova').toBeLessThanOrEqual(1);
    expect(await ind.evaluate((i) => getComputedStyle(i).transitionProperty)).toContain('transform');
  });

  test('carregamento mostra a forma do conteúdo, com a legenda anunciada como status', async ({ page }) => {
    await seed(page);
    // segura as respostas das APIs para flagrar o estado de carregamento
    await page.route(/dadosabertos\.camara\.leg\.br|legis\.senado\.leg\.br/, () => {});
    await go(page, 'inicio');
    const sk = page.locator('#feed .skeleton');
    await expect(sk).toBeVisible();
    await expect(sk).toHaveAttribute('role', 'status');
    await expect(sk).toContainText('Carregando votações recentes');
    await expect(sk.locator('.sk-card')).toHaveCount(2);
    await expect(sk.locator('.sk-card').first().locator('.sk-line')).toHaveCount(3);
    expect(await page.locator('#feed .spin').count(), 'sem spinner na lista').toBe(0);
  });

  test('com movimento reduzido o brilho do espaço de carregamento fica parado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await page.route(/dadosabertos\.camara\.leg\.br|legis\.senado\.leg\.br/, () => {});
    await go(page, 'inicio');
    const line = page.locator('#feed .sk-line').first();
    await expect(line).toBeVisible();
    expect(await line.evaluate((l) => getComputedStyle(l, '::after').animationName)).toBe('none');
  });
});

test.describe('fluxos', () => {
  test('remover político pode ser desfeito na mesma posição', async ({ page }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-remove]').first().click();
    await expect(page.locator('.pol-card')).toHaveCount(2);
    await page.locator('.toast-action').click();
    await expect(page.locator('.pol-card')).toHaveCount(3);
    const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('monitor-cidadao:v1')).politicians.map((p) => p.id));
    expect(ids[0]).toBe('camara-160561');
  });

  test('aviso: arrastar para o lado dispensa; arrasto curto volta e o aviso fica', async ({ page }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-remove]').first().click();
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await page.waitForTimeout(400); // fim da animação de entrada
    const drag = async (dx, steps, ms) => {
      const b = await toast.boundingBox();
      const x = b.x + 24, y = b.y + b.height / 2; // fora do botão Desfazer
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x + (dx * i) / steps, y);
        await page.waitForTimeout(ms);
      }
      await page.mouse.up();
    };
    // curto e lento: volta ao lugar e continua ali
    await drag(30, 6, 30);
    await expect.poll(() => toast.evaluate((t) => t.style.transform), 'volta ao lugar').toMatch(/^$|translateX\(0(px)?\)|translateX\(-?0\.\d+px\)/);
    await expect(toast).toBeVisible();
    // longo: sai de cena e some, sem desfazer a remoção
    await drag(500, 6, 8);
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(page.locator('.pol-card')).toHaveCount(2);
  });

  test('toque háptico curto ao remover e ao desfazer; nenhum com movimento reduzido', async ({ page }) => {
    await page.addInitScript(() => {
      window.__vib = [];
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (ms) => { window.__vib.push(ms); return true; } });
    });
    await seed(page);
    await go(page, 'meus-politicos');
    await page.locator('[data-remove]').first().click();
    await page.locator('.toast-action').click();
    expect(await page.evaluate(() => window.__vib), 'remover (15) e desfazer (8)').toEqual([15, 8]);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.__vib = []; });
    await page.locator('[data-remove]').first().click();
    await page.locator('.toast-action').click();
    expect(await page.evaluate(() => window.__vib), 'sem háptico com movimento reduzido').toEqual([]);
  });

  test('pressão proporcional ao tamanho: ícones afundam mais, cartões menos', async ({ page }) => {
    await seed(page);
    await go(page, 'inicio');
    const scale = (sel) => page.evaluate((sel) => {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // folhas de outra origem (fontes) não são legíveis
        for (const r of rules) {
          if (r.selectorText === sel) return r.style.transform;
        }
      }
      return null;
    }, sel);
    expect(await scale('.btn.icon:active, .header-user-btn:active')).toBe('scale(0.9)');
    expect(await scale('button.chip:active, a.chip:active, .tabs button:active')).toBe('scale(0.95)');
    expect(await scale('a.card:active')).toBe('scale(0.985)');
  });

  test('tema segue o sistema e o botão do cabeçalho alterna', async ({ page, isMobile }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await seed(page, { theme: 'system' });
    await go(page, 'inicio');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    if (isMobile) {
      await page.locator('#header-theme-btn').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    }
  });

  test('painel: assembleia abre no estado do domicílio; acompanhar só dentro do perfil e grava o mandato da UF', async ({ page }) => {
    await seed(page, { politicians: [], domicile: { state: 'MG', city: 'Belo Horizonte' } });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=assembleias]').click();
    await expect(page.locator('#painel-uf')).toHaveValue('MG');
    await expect(page.locator('#painel-count')).toContainText('77 resultados');
    // o cartão só abre o perfil; não há como acompanhar sem vê-lo
    await expect(page.locator('.painel-card #follow-btn')).toHaveCount(0);
    await page.locator('.painel-open').first().click();
    const follow = page.locator('#follow-btn');
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('monitor-cidadao:v1')).politicians[0]);
    expect(saved.uf).toBe('MG');
    expect(saved.mandate).toEqual(['2023-02-01', '2027-01-31']);
    expect(saved.tse?.ballotNumber).toBeTruthy();
    // a lista atrás do diálogo não foi remontada: o selo aparece no cartão e a busca continua lá
    await page.keyboard.press('Escape');
    await expect(page.locator('.painel-card .follow-badge:visible')).toHaveCount(1);
    await expect(page.locator('.painel-open').first()).toBeFocused();
  });

  test('painel: governadores e prefeitos mostram quem ocupa o cargo hoje, e o STF não tem ficha do TSE', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=governadores]').click();
    await expect(page.locator('#painel-count')).toContainText('27 resultados');
    await page.locator('#painel-q').fill('minas');
    await expect(page.locator('#painel-count')).toHaveText('1 resultado');
    await page.locator('.painel-open').click();
    await expect(page.locator('.office-list')).toContainText('Eleito(a) na chapa original');
    await page.keyboard.press('Escape');
    await page.locator('#painel-tabs [data-section=stf]').click();
    await page.locator('.painel-open').first().click();
    await expect(page.locator('#pol-tabs [data-tab=tse]')).toHaveCount(0);
    await expect(page.locator('.office-list')).toContainText('Aposentadoria compulsória');
  });

  test('painel: prefeitos e vereadores incluem as duas maiores cidades de cada estado, com o contexto da cidade no perfil', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=prefeitos]').click();
    await expect(page.locator('#painel-count')).toContainText('78 resultados');
    await page.locator('#painel-uf').selectOption('SC');
    await expect(page.locator('#painel-count')).toHaveText('3 resultados');
    await expect(page.locator('.painel-grid')).toContainText('Joinville');
    await expect(page.locator('.painel-grid')).toContainText('Itajaí');
    await expect(page.locator('.painel-grid')).toContainText('Florianópolis');

    await page.locator('#painel-tabs [data-section=vereadores]').click();
    await expect(page.locator('#painel-city-field')).toBeVisible();
    await expect(page.locator('#painel-city option')).toHaveText(['Todas as cidades (3)', 'Florianópolis', 'Itajaí', 'Joinville']);
    await page.locator('#painel-city').selectOption('Itajaí');
    await expect(page.locator('#painel-count')).toContainText('17 resultados');
    await page.locator('.painel-open').first().click();
    await expect(page.locator('#city-facts')).toContainText('2ª maior economia do estado');
    await expect(page.locator('#city-facts')).toContainText('264.054');
    await expect(page.locator('#city-facts')).toContainText('Emendas parlamentares desde 2023');
    await expect(page.locator('#city-emendas li').first()).toBeVisible();
    await page.keyboard.press('Escape');

    // trocar de estado zera a cidade escolhida
    await page.locator('#painel-uf').selectOption('SP');
    await expect(page.locator('#painel-city')).toHaveValue('');
    await expect(page.locator('#painel-city option')).toContainText(['Guarulhos', 'Osasco', 'São Paulo']);
  });

  test('painel: prefeito interino de cidade-polo mostra a nota, quem foi eleito e o aviso de data da conferência', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=prefeitos]').click();
    await expect(page.locator('#painel-results')).toContainText('conferidos em notícias de 15/10/2026');
    await page.locator('#painel-q').fill('coari');
    await expect(page.locator('#painel-count')).toHaveText('1 resultado');
    await expect(page.locator('.painel-card')).toContainText('interino');
    await page.locator('.painel-open').click();
    await expect(page.locator('#tab-local .office-list')).toContainText('Eleito(a) na chapa original');
    await expect(page.locator('.modal')).toContainText('afastado por 90 dias');
  });

  test('painel: Contas lista a prefeitura e a câmara de cada cidade-polo depois das da capital; o DF não tem polos', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=orgaos]').click();
    await page.locator('#painel-uf').selectOption('SP');
    await expect(page.locator('#painel-count')).toContainText('12 órgãos');
    await expect(page.locator('.painel-name').nth(8)).toHaveText('Prefeitura de Osasco');
    await expect(page.locator('.painel-card').nth(8)).toContainText('2ª maior economia do estado');
    await page.locator('#painel-uf').selectOption('DF');
    await expect(page.locator('#painel-count')).toHaveText('6 órgãos: federais, de Distrito Federal');
  });

  test('perfil do senador mostra o resumo da cota (CEAPS) gerado do dado aberto, com a data do resumo', async ({ page }) => {
    const ceaps = JSON.parse((await import('node:fs')).readFileSync(new URL('../../src/data/ceaps.json', import.meta.url), 'utf8'));
    const [id, s] = Object.entries(ceaps.senadores).find(([, x]) => x.grandes.length >= 2);
    await seed(page, { politicians: [{ id: `senado-${id}`, source: 'senado', senadoId: id, name: 'Senador Real', party: 'MDB', uf: 'SE', roleKey: 'senador', mandate: ['2023-02-01', '2031-01-31'] }] });
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.locator('#pol-tabs [data-tab=cota]').click();
    await expect(page.locator('#tab-cota')).toContainText('Cota parlamentar (CEAPS)');
    await expect(page.locator('#tab-cota')).toContainText('Resumo de');
    await expect(page.locator('#tab-cota')).toContainText(Object.keys(s.anos).sort().reverse()[0]);
    await expect(page.locator('#tab-cota')).toContainText('Despesas a partir de');
  });

  test('contas: a prefeitura mostra os contratos mais recentes do PNCP; câmaras e governos não têm o botão', async ({ page }) => {
    const contratos = (n) => Array.from({ length: n }, (_, i) => ({
      numeroControlePNCP: `1-2-00${i}/2026`, dataPublicacaoPncp: `2026-10-${String(i + 1).padStart(2, '0')}T09:00:00`, objetoContrato: `Reforma da escola ${i}`,
      nomeRazaoSocialFornecedor: `CONSTRUTORA ${i}`, valorGlobal: 1000 * (i + 1), tipoContrato: { nome: 'Contrato' }, orgaoEntidade: { cnpj: '1' }, anoContrato: 2026, sequencialContrato: i,
      emendaParlamentar: i === 11 ? { numero: 9 } : null,
    }));
    const urls = [];
    await page.route('https://pncp.gov.br/**', (route) => {
      urls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: contratos(12), totalRegistros: 12, totalPaginas: 1 }) });
    });
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=orgaos]').click();
    await page.waitForSelector('[data-accounts]');
    await expect(page.locator('.painel-card:has([data-contracts])')).toHaveCount(3); // prefeitura da capital e das duas cidades-polo
    await expect(page.locator('.painel-card', { hasText: 'Câmara Municipal' }).locator('[data-contracts]')).toHaveCount(0);
    await expect(page.locator('.painel-card', { hasText: 'Governo do Estado' }).locator('[data-contracts]')).toHaveCount(0);
    const card = page.locator('.painel-card:has([data-contracts])').first();
    // pelo teclado: no celular a barra fixa de cima ou a de baixo cobre o botão depois da rolagem automática do clique
    await card.locator('[data-contracts]').focus();
    await page.keyboard.press('Enter');
    await expect(card).toContainText('Contratos publicados (30 dias)');
    await expect(card.locator('[id^=ct-] li')).toHaveCount(10); // 5 maiores e 5 mais recentes
    await expect(card.locator('[id^=ct-] li').first()).toContainText('Reforma da escola 11');
    await expect(card).toContainText('Maiores contratos');
    await expect(card).toContainText('Soma dos valores informados');
    await expect(card).toContainText('emenda parlamentar');
    await expect(card.locator('[id^=ct-] a[href^="https://pncp.gov.br/app/contratos/"]').first()).toBeVisible();
    expect(urls[0]).toContain('cnpjOrgao=');
  });

  test('perfil do parlamentar mostra as emendas individuais (ligadas pelo nome) e avisa quando o nome não aparece', async ({ page }) => {
    const emendas = JSON.parse((await import('node:fs')).readFileSync(new URL('../../src/data/emendas.json', import.meta.url), 'utf8'));
    const autor = Object.values(emendas.autores).find((a) => a.destinos.length >= 3 && a.favorecidos.length >= 3);
    const sen = (id, name) => ({ id: `senado-${id}`, source: 'senado', senadoId: id, name, party: 'MDB', uf: 'SE', roleKey: 'senador', mandate: ['2023-02-01', '2031-01-31'] });
    await seed(page, { politicians: [sen('1', autor.nome.toLowerCase()), sen('2', 'Fulano Sem Emenda')] });
    await go(page, 'meus-politicos');
    await page.locator('[data-details]').first().click();
    await page.locator('#pol-tabs [data-tab=emendas]').click();
    await expect(page.locator('#tab-emendas')).toContainText('Emendas individuais desde 2023');
    await expect(page.locator('#tab-emendas')).toContainText('Municípios que mais receberam');
    await expect(page.locator('#tab-emendas')).toContainText('Quem mais recebeu o dinheiro');
    await expect(page.locator('#tab-emendas')).toContainText('Resumo de');
    await page.keyboard.press('Escape');
    await page.locator('[data-details]').nth(1).click();
    await page.locator('#pol-tabs [data-tab=emendas]').click();
    await expect(page.locator('#tab-emendas')).toContainText('Nenhuma emenda individual encontrada');
  });

  test('painel: ministros do STF mostram o estado de nascimento no lugar do partido; governadores, a bandeira do partido; todos com foto', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    // as fotos são preguiçosas: só as de cima carregam sem rolar a lista
    const loaded = (loc) => loc.evaluateAll((imgs) => imgs.slice(0, 4).length === 4 && imgs.slice(0, 4).every((i) => i.complete && i.naturalWidth > 0));

    await page.locator('#painel-tabs [data-section=stf]').click();
    await expect(page.locator('.painel-card')).toHaveCount(10);
    for (const card of await page.locator('.painel-card').all()) {
      await expect(card).toContainText('Natural de');
      await expect(card.locator('img.flag[src^="/partidos/"]')).toHaveCount(0); // magistrado não tem vínculo partidário
      await expect(card.locator('img.flag[src^="/bandeiras/"]')).toHaveCount(1);
    }
    const gilmar = page.locator('.painel-card', { hasText: 'Gilmar Mendes' });
    await expect(gilmar.locator('.chip', { hasText: 'Natural de MT' })).toHaveAttribute('title', 'Natural de Diamantino, Mato Grosso');
    await expect.poll(() => loaded(page.locator('.painel-card img.avatar'))).toBe(true); // carregam do próprio app
    await expect(page.locator('.painel-card img.avatar')).toHaveCount(10);

    await page.locator('#painel-tabs [data-section=governadores]').click();
    await expect(page.locator('.painel-card')).toHaveCount(24); // a lista mostra 24 de cada vez
    await expect(page.locator('.painel-card img.flag[src^="/partidos/"]').first()).toBeVisible();
    await expect(page.locator('.painel-card .chip', { hasText: 'Natural de' })).toHaveCount(0);
    await expect.poll(() => page.locator('.painel-card img.avatar[src^="/fotos/tse/2022/"]').count()).toBeGreaterThan(15);
    await expect.poll(() => loaded(page.locator('.painel-card img.avatar'))).toBe(true);
  });

  test('ficha do ministro do STF: estado de nascimento no cabeçalho e nos dados, e o crédito da foto; sem partido', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=stf]').click();
    await page.locator('.painel-card', { hasText: 'Dias Toffoli' }).locator('.painel-open').click();
    const modal = page.locator('.overlay .modal');
    await expect(modal.locator('.chip', { hasText: 'Natural de SP' })).toBeVisible();
    await expect(modal).toContainText('Marília/SP');
    await expect(modal).toContainText('Foto: Geraldo Magela/Agência Senado · CC BY 2.0');
    await expect(modal.locator('a', { hasText: 'Foto:' })).toHaveAttribute('href', /commons\.wikimedia\.org/);
    await expect(modal).not.toContainText('Partido atual');
  });

  test('quem acompanhava um ministro antes do estado de nascimento existir passa a vê-lo, e a foto do TSE vem do caminho de sempre', async ({ page }) => {
    const antigo = { id: 'stf-flavio-dino', source: 'stf', name: 'Min. Flávio Dino', party: '—', roleKey: 'ministro-stf', uf: 'BR', state: 'BR' };
    const eleito = { id: 'sp-250001610117', source: 'al-sp', name: 'Dep. Agente Federal Danilo Balas', party: 'PL', roleKey: 'dep-estadual', uf: 'SP', tse: { year: 2022, sq: '250001610117' } };
    await seed(page, { politicians: [antigo, eleito] });
    await go(page, 'meus-politicos');
    const dino = page.locator('.pol-card', { hasText: 'Flávio Dino' });
    await expect(dino.locator('.chip', { hasText: 'Natural de MA' })).toBeVisible();
    await expect(dino.locator('img.avatar[src="/fotos/stf/flavio-dino.jpg"]')).toBeVisible();
    await expect(page.locator('.pol-card', { hasText: 'Danilo Balas' }).locator('img.avatar[src="/fotos/tse/2022/250001610117.jpg"]')).toBeVisible();
    await expect(page.locator('.pol-card', { hasText: 'Danilo Balas' }).locator('img.flag[src="/partidos/PL.png"]')).toBeVisible();
  });

  test('créditos das imagens: fotos do STF com autor e licença, e as bandeiras de 31 partidos e 27 estados', async ({ page }) => {
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await page.locator('#creditos-btn').focus(); // pelo teclado: as barras fixas do celular cobrem o botão no clique
    await page.keyboard.press('Enter');
    await expect(page.locator('#creditos')).toContainText('Fotos dos ministros do STF (Wikimedia Commons)');
    await expect(page.locator('#creditos')).toContainText('Marcelo Camargo/Agência Brasil · CC BY 3.0 br');
    await expect(page.locator('#creditos li')).toHaveCount(10 + 31 + 27);
    await expect(page.locator('#creditos')).toContainText('não têm vínculo partidário');
  });

  test('gastos por Poder: estado com a União, a capital e as cidades-polo; e o comparativo entre estados', async ({ page }) => {
    await seed(page);
    await go(page, 'painel');
    await page.locator('#painel-tabs [data-section=orgaos]').click();
    await page.locator('a[href="#/poderes"]').click();
    await expect(page.locator('h1')).toHaveText('Gastos por Poder');
    await page.locator('#poderes-uf').selectOption('SP');
    await expect(page.locator('.poder-card .painel-name')).toHaveText(['União (Governo Federal)', 'São Paulo', 'São Paulo — SP', 'Guarulhos — SP', 'Osasco — SP']);
    const uniao = page.locator('.poder-card').first();
    await expect(uniao).toContainText('não é comparável');
    const sp = page.locator('.poder-card').nth(1);
    for (const poder of ['Executivo', 'Legislativo', 'Judiciário']) await expect(sp.getByRole('heading', { name: poder })).toBeVisible();
    await expect(sp).toContainText('do limite');
    await expect(sp).toContainText('Despesa total por função');
    await expect(sp).toContainText('Encargos especiais');
    // município: sem Judiciário
    const osasco = page.locator('.poder-card').nth(4);
    await expect(osasco.getByRole('heading', { name: 'Judiciário' })).toHaveCount(0);
    await expect(osasco).toContainText('não tem Judiciário próprio');

    await page.locator('#poderes-tabs [data-tab=comparar]').click();
    await expect(page.locator('tbody tr')).toHaveCount(27);
    await page.locator('#poderes-poder').selectOption('p:J');
    await expect(page.locator('#poderes-body')).toContainText('6%');
    await expect(page.locator('#poderes-body')).toContainText('Judiciário');
    await page.locator('#poderes-poder').selectOption('f:legislativa');
    await expect(page.locator('tbody tr')).toHaveCount(27);
    await expect(page.locator('#poderes-body')).toContainText('% da despesa total');
    await expect(page.locator('#poderes-body')).toContainText('Função não é Poder');
  });

  test('cadastro antigo com data da ALESP exibe o mandato correto', async ({ page }) => {
    await seed(page);
    await go(page, 'meus-politicos');
    await expect(page.locator('.pol-card').nth(2)).toContainText('31/01/2027');
  });

  test('comparador mostra as votações de todos, sem acompanhar ninguém, e compara dois deputados quaisquer', async ({ page }) => {
    const dep = (id, nome, siglaPartido, siglaUf) => ({ id, nome, siglaPartido, siglaUf });
    const votos = [
      { deputado_: dep(1, 'Ana Lima', 'PT', 'SP'), tipoVoto: 'Sim' },
      { deputado_: dep(2, 'Bruno Reis', 'PL', 'RJ'), tipoVoto: 'Não' },
      { deputado_: dep(3, 'Carla Dias', 'PT', 'BA'), tipoVoto: 'Sim' },
    ];
    await page.route(/dadosabertos\.camara\.leg\.br\/api\/v2\/votacoes\?/, (r) =>
      // a API é paginada: só a primeira página tem votações
      r.fulfill({ json: { dados: /pagina=1(&|$)/.test(r.request().url()) ? [{ id: '9-1', descricao: 'Aprovado o projeto de saneamento. Sim: 2; Não: 1; Total: 3.', data: '2026-09-01', siglaOrgao: 'PLEN', aprovacao: 1 }] : [] } })
    );
    await page.route(/votacoes\/9-1\/votos/, (r) => r.fulfill({ json: { dados: votos } }));
    await page.route(/legis\.senado\.leg\.br\/dadosabertos\/votacao\?/, (r) =>
      r.fulfill({
        json: [{
          codigoSessaoVotacao: 7, identificacao: 'PL 1/2026', ementa: 'Dispõe sobre a saúde.', dataSessao: '2026-09-02', resultadoVotacao: 'A', votacaoSecreta: 'N',
          votos: [
            { codigoParlamentar: 10, nomeParlamentar: 'Davi Souza', siglaPartidoParlamentar: 'MDB', siglaUFParlamentar: 'AP', siglaVotoParlamentar: 'Sim' },
            { codigoParlamentar: 11, nomeParlamentar: 'Eva Ramos', siglaPartidoParlamentar: 'PSD', siglaUFParlamentar: 'MG', siglaVotoParlamentar: 'NA' },
          ],
        }],
      })
    );
    await seed(page, { politicians: [] });
    await go(page, 'comparador');
    const card = page.locator('#camara-list article');
    await expect(card).toHaveCount(1);
    // a lista completa só é montada ao abrir
    await expect(card.locator('.vote-list')).toHaveCount(0);
    await card.locator('details.vote-details summary').click();
    await expect(card.locator('.party-table tbody tr')).toHaveCount(2);
    await expect(card.locator('.party-table tbody tr').first()).toContainText('PT');
    await card.locator('.vote-q').fill('bruno');
    await expect(card.locator('.vote-list li:visible')).toHaveCount(1);
    await page.locator('#house-tabs [data-house=senado]').click();
    // quem não estava presente (NA) não entra na lista
    await page.locator('#senado-list details.vote-details summary').click();
    await expect(page.locator('#senado-list .vote-list li')).toHaveCount(1);
    await page.locator('#house-tabs [data-house=confronto]').click();
    await page.locator('#sel-pol-a').selectOption('1');
    await page.locator('#sel-pol-b').selectOption('3');
    await expect(page.locator('#confronto-results')).toContainText('100% de Alinhamento');
  });

  test('alertas: sem acompanhar ninguém chegam as votações do Plenário; os filtros escondem o que não é do tipo', async ({ page }) => {
    await page.route(/dadosabertos\.camara\.leg\.br\/api\/v2\/votacoes\?/, (r) =>
      r.fulfill({ json: { dados: /pagina=1(&|$)/.test(r.request().url()) ? [{ id: '9-1', descricao: 'Aprovado o projeto de saneamento. Sim: 2; Não: 1; Total: 3.', data: '2026-09-01', siglaOrgao: 'PLEN', aprovacao: 1 }] : [] } })
    );
    await page.route(/votacoes\/9-1\/votos/, (r) =>
      r.fulfill({ json: { dados: [{ deputado_: { id: 1, nome: 'Ana Lima', siglaPartido: 'PT', siglaUf: 'SP' }, tipoVoto: 'Sim' }] } })
    );
    await page.route(/legis\.senado\.leg\.br\/dadosabertos\/votacao\?/, (r) => r.fulfill({ json: [] }));
    await seed(page, { politicians: [], alerts: [{ id: 'antigo', ts: '2026-01-01', text: 'Alerta gravado por uma versão anterior.' }] });
    await go(page, 'alertas');
    await page.locator('#check').click();
    await expect(page.locator('.alert-item[data-kind=plenario]')).toHaveCount(1);
    await expect(page.locator('.alert-item[data-kind=plenario]')).toContainText('Câmara — Aprovado o projeto de saneamento');
    // alerta antigo, sem tipo, conta como voto de quem a pessoa acompanha
    await page.locator('#alert-filters [data-filter=plenario]').click();
    await expect(page.locator('#alert-filters [data-filter=plenario]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.alert-item:visible')).toHaveCount(1);
    await page.locator('#alert-filters [data-filter=gasto]').click();
    await expect(page.locator('.alert-item:visible')).toHaveCount(0);
    await expect(page.locator('#alerts-empty-filter')).toBeVisible();
  });

  test('sem nenhum pedido a terceiros: ícones e texto saem do próprio app e os ícones viram glifos', async ({ page }) => {
    const outside = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) outside.push(r.url()); });
    await seed(page, { politicians: [] });
    for (const r of ['painel', 'perfil', 'alertas', 'comparador']) {
      await go(page, r);
      await page.evaluate(() => document.fonts.ready);
      // fonte de ícones carregada, e nenhum ícone mostrando o nome da ligadura (que estoura o quadrado de 1em)
      expect(await page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"')), r).toBe(true);
      const leaking = await page.$$eval('.mi', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()));
      expect(leaking, `${r}: ícones virando texto`).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${r}: barra de rolagem horizontal`).toBeLessThanOrEqual(0);
    }
    expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
    // só as APIs públicas de dados abertos; nenhuma fonte, folha de estilo ou script de terceiros
    const APIS = /^https:\/\/(dadosabertos\.camara\.leg\.br|legis\.senado\.leg\.br|apidatalake\.tesouro\.gov\.br)\//;
    expect(outside.filter((u) => !APIS.test(u))).toEqual([]);
  });

  test('fonte de ícones que falha esconde os ícones em vez de mostrar o nome cortado', async ({ page }) => {
    await page.route('**/fonts/material-symbols.woff2', (r) => r.abort());
    await seed(page, { politicians: [] });
    await go(page, 'painel');
    await expect(page.locator('html')).toHaveClass(/no-icon-font/);
    const visible = await page.$$eval('.mi', (els) => els.filter((e) => getComputedStyle(e).visibility !== 'hidden').length);
    expect(visible).toBe(0);
    // o rótulo ao lado continua lá
    await expect(page.locator('.nav a[data-route=alertas]')).toContainText('Alertas');
  });

  test('foto que não carrega vira as iniciais, sem texto alternativo quebrado', async ({ page }) => {
    await page.route('https://www.camara.leg.br/**', (r) => r.abort());
    await seed(page, { politicians: [{ id: 'camara-1', source: 'camara', camaraId: 1, name: 'Dep. Maria Souza', party: 'PT', uf: 'SP', roleKey: 'dep-federal', photo: 'http://www.camara.leg.br/foto.jpg' }] });
    await go(page, 'meus-politicos');
    await expect(page.locator('.pol-card img.avatar')).toHaveCount(0);
    await expect(page.locator('.pol-card .avatar').first()).toHaveText('MS');
  });

  test('primeiro acesso abre o Painel Público direto, sem diálogo nem escolha', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view h1')).toHaveText('Painel público');
    await expect(page.locator('.painel-card').first()).toBeVisible();
    await expect(page.locator('.overlay')).toHaveCount(0);
  });
});
