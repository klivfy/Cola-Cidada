import { initialState, parseStoredState, recoverStoredState, reduce } from '../state';
import type { Politician } from '../types';

const mk = (id: string, extra: Partial<Politician> = {}): Politician => ({
  id,
  source: 'camara',
  name: id,
  party: 'XX',
  uf: 'SP',
  roleKey: 'dep-federal',
  ...extra,
});

describe('reduce', () => {
  it('não aceita estado local corrompido para evitar sobrescrever dados antigos', () => {
    expect(parseStoredState(JSON.stringify(initialState()))).toEqual(initialState());
    expect(() => parseStoredState('{"politicians":"erro","alerts":[],"prefs":{},"domicile":{}}')).toThrow('Estado local inválido');
    expect(() => parseStoredState('{"politicians":[],"alerts":[],"prefs":{"rollcall":"sim"},"domicile":{"state":"SP","city":"São Paulo"}}')).toThrow('Estado local inválido');
  });

  it('recupera dados salvos e reaplica ações feitas enquanto a leitura falhou', () => {
    const saved = { ...initialState(), politicians: [mk('antigo')] };
    const recovered = recoverStoredState(JSON.stringify(saved), [
      { type: 'add', politician: mk('novo') },
      { type: 'setPref', key: 'rollcall', value: false },
    ]);
    expect(recovered.politicians.map((p) => p.id)).toEqual(['antigo', 'novo']);
    expect(recovered.prefs.rollcall).toBe(false);
  });
  it('adiciona e preenche o mandato padrão quando falta', () => {
    const s = reduce(initialState(), { type: 'add', politician: mk('a') });
    expect(s.politicians).toHaveLength(1);
    expect(s.politicians[0].mandate).toEqual(['2023-02-01', '2027-01-31']);
  });

  it('mantém o mandato informado e ignora duplicados', () => {
    let s = reduce(initialState(), { type: 'add', politician: mk('a', { mandate: ['2023-02-01', '2031-01-31'] }) });
    s = reduce(s, { type: 'add', politician: mk('a') });
    expect(s.politicians).toHaveLength(1);
    expect(s.politicians[0].mandate?.[1]).toBe('2031-01-31');
  });

  it('remover e restaurar devolve o político à mesma posição', () => {
    let s = initialState();
    for (const id of ['a', 'b', 'c']) s = reduce(s, { type: 'add', politician: mk(id) });
    const b = s.politicians[1];
    s = reduce(s, { type: 'remove', id: 'b' });
    expect(s.politicians.map((p) => p.id)).toEqual(['a', 'c']);
    s = reduce(s, { type: 'restore', politician: b, index: 1 });
    expect(s.politicians.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('restaurar duas vezes não duplica', () => {
    let s = reduce(initialState(), { type: 'add', politician: mk('a') });
    const a = s.politicians[0];
    s = reduce(s, { type: 'restore', politician: a, index: 0 });
    expect(s.politicians).toHaveLength(1);
  });

  it('hydrate aceita dados parciais ou corrompidos sem quebrar', () => {
    const s = reduce(initialState(), { type: 'hydrate', state: { politicians: 'lixo' as any } });
    expect(s.politicians).toEqual([]);
    expect(s.domicile.state).toBe('SP');
    const ok = reduce(initialState(), { type: 'hydrate', state: { politicians: [mk('x')], domicile: { state: 'MG', city: 'BH' } } });
    expect(ok.politicians).toHaveLength(1);
    expect(ok.domicile.state).toBe('MG');
  });

  it('purge volta ao estado inicial', () => {
    const s = reduce(reduce(initialState(), { type: 'add', politician: mk('a') }), { type: 'purge' });
    expect(s).toEqual(initialState());
  });

  it('alertas: guarda só os novos, no máximo 200, e preferências antigas ganham as novas', () => {
    let s = reduce(initialState(), { type: 'addAlerts', alerts: [{ id: 'a', ts: '2026-01-01', text: 'um' }] });
    s = reduce(s, { type: 'addAlerts', alerts: [{ id: 'a', ts: '2026-01-01', text: 'um' }, { id: 'b', ts: '2026-01-02', text: 'dois' }] });
    expect(s.alerts.map((a) => a.id)).toEqual(['b', 'a']);
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `x${i}`, ts: '2026-01-01', text: 't' }));
    expect(reduce(initialState(), { type: 'addAlerts', alerts: many }).alerts).toHaveLength(200);
    const h = reduce(initialState(), { type: 'hydrate', state: { prefs: { rollcall: false } as never } });
    expect(h.prefs).toEqual({ plenario: true, rollcall: false, expenses: true, bills: true });
    expect(reduce(h, { type: 'setPref', key: 'bills', value: false }).prefs.bills).toBe(false);
  });
});
