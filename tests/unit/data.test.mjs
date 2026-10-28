// Integridade dos dados regionais gerados do TSE (scripts/build-regional-data.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { FEDERATION_UNITS } from '../../src/data/federation.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url)));
const REQUIRED = ['id', 'name', 'fullName', 'party', 'role', 'house', 'source', 'state', 'situacao', 'tse', 'pageUrl'];

for (const u of FEDERATION_UNITS) {
  test(`${u.uf}: assembleia com ${u.totalDep} eleitos e campos completos`, () => {
    const list = load(`states/${u.uf.toLowerCase()}.json`);
    assert.equal(list.length, u.totalDep);
    assert.equal(new Set(list.map((d) => d.id)).size, list.length, 'ids repetidos');
    for (const d of list) {
      for (const k of REQUIRED) assert.ok(d[k] != null && d[k] !== '', `${d.id} sem ${k}`);
      assert.equal(d.state, u.uf);
      assert.match(d.pageUrl, /^https:\/\/divulgacandcontas\.tse\.jus\.br\//);
      if (d.tse.declaredAssets != null) assert.equal(Math.round(d.tse.declaredAssets * 100) / 100, d.tse.declaredAssets);
    }
  });

  if (u.hasCouncil) {
    test(`${u.uf}: câmara da capital com até ${u.councilDep} eleitos`, () => {
      const list = load(`capitais/${u.uf.toLowerCase()}.json`);
      // Porto Alegre tem 35 de 36: um registro do TSE está sem situação final (#NULO).
      assert.ok(list.length >= u.councilDep - 1 && list.length <= u.councilDep, `${list.length}/${u.councilDep}`);
      for (const d of list) assert.equal(d.city, u.capital);
    });
  } else {
    test(`${u.uf}: sem câmara de capital no catálogo`, () => {
      assert.equal(existsSync(new URL(`../../src/data/capitais/${u.uf.toLowerCase()}.json`, import.meta.url)), false);
    });
  }
}

// Executivo (TSE + ocupantes atuais), STF e códigos do Siconfi.
const exe = load('executivo.json');

test('executivo: 1 presidente, 27 governadores e 26 prefeitos de capitais, com ids únicos', () => {
  assert.equal(exe.presidente.length, 1);
  assert.equal(exe.governadores.length, 27);
  assert.equal(exe.prefeitos.length, 26);
  const all = [...exe.presidente, ...exe.governadores, ...exe.prefeitos];
  assert.equal(new Set(all.map((e) => e.id)).size, all.length);
  assert.match(exe.consultadoEm, /^\d{4}-\d{2}-\d{2}$/);
  for (const e of all) {
    for (const k of ['id', 'name', 'party', 'roleKey', 'house', 'state', 'situacao', 'mandate']) assert.ok(e[k], `${e.id} sem ${k}`);
    assert.ok(e.mandate[0] < e.mandate[1], `${e.id}: mandato invertido`);
  }
  assert.deepEqual(new Set(exe.governadores.map((g) => g.state)), new Set(FEDERATION_UNITS.map((u) => u.uf)));
  assert.deepEqual(new Set(exe.prefeitos.map((p) => p.city)), new Set(FEDERATION_UNITS.filter((u) => u.hasCouncil).map((u) => u.capital)));
});

test('executivo: quem assumiu no lugar do eleito não herda a ficha do TSE nem o vice da chapa', () => {
  const swapped = [...exe.governadores, ...exe.prefeitos].filter((e) => e.eleitoPeloTse);
  assert.ok(swapped.length > 0);
  for (const e of swapped) {
    assert.equal(e.tse, undefined, `${e.id} manteve a ficha do eleito`);
    assert.ok(e.desde, `${e.id} sem data de posse`);
    assert.equal(e.mandate[0], e.desde);
    assert.notEqual(e.name.replace(/^\S+ /, ''), e.eleitoPeloTse.name);
  }
});

test('STF: ministros com posse, indicação e aposentadoria compulsória; no máximo 11 cadeiras', () => {
  const { ministros } = load('stf.json');
  assert.ok(ministros.length >= 9 && ministros.length <= 11);
  assert.equal(new Set(ministros.map((m) => m.id)).size, ministros.length);
  for (const m of ministros) {
    assert.equal(m.roleKey, 'ministro-stf');
    assert.match(m.posse, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(m.indicadoPor && m.aposentadoriaCompulsoria > 2025);
  }
  assert.equal(ministros.filter((m) => m.cargo === 'Presidente do STF').length, 1);
});

test('entes do Siconfi: um código para cada estado e para cada capital', () => {
  const { uniao, ufs } = load('entes.json');
  assert.equal(uniao, 1);
  for (const u of FEDERATION_UNITS) {
    assert.ok(ufs[u.uf]?.estado >= 11 && ufs[u.uf].estado <= 53, u.uf);
    if (u.hasCouncil) assert.equal(String(ufs[u.uf].capital).slice(0, 2), String(ufs[u.uf].estado), `${u.uf}: capital de outro estado`);
  }
});

test('resumos financeiros carregam fonte e data de geração', () => {
  for (const file of ['ceaps.json', 'poderes.json', 'emendas.json']) {
    const data = load(file);
    assert.match(data.geradoEm, /^\d{4}-\d{2}-\d{2}$/i, `${file}: data inválida`);
    assert.ok(data.fonte, `${file}: fonte ausente`);
  }
  const emendas = load('emendas.json');
  assert.match(String(emendas.desde), /^20\d{2}$/);
});
