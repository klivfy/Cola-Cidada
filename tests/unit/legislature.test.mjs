import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLegislature, currentLegislatureLabel } from '../../src/legislature.js';

test('calcula a legislatura vigente no início e no fim do ciclo', () => {
  assert.equal(currentLegislature(new Date('2023-02-01T12:00:00Z')), 57);
  assert.equal(currentLegislature(new Date('2026-12-31T12:00:00Z')), 57);
  assert.equal(currentLegislature(new Date('2027-01-31T12:00:00Z')), 57);
  assert.equal(currentLegislature(new Date('2027-02-01T12:00:00Z')), 58);
  assert.equal(currentLegislatureLabel(new Date('2027-02-01T12:00:00Z')), '58ª Legislatura');
});
