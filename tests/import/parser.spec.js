/**
 * Unit tests for app/js/import/parser.js
 * Run: node --test tests/import/parser.spec.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Load parser (CommonJS compatible via module.exports branch)
const { parse, parseNotationToken } = require('../../app/js/import/parser.js');

// ---- parseNotationToken tests ----

test('load-only token', () => {
  const f = parseNotationToken('40!');
  assert.equal(f.load, '40');
  assert.equal(f.sets, null);
  assert.equal(f.reps, null);
  assert.equal(f.holdSec, null);
  assert.equal(f.sideScheme, 'bilateral');
});

test('load + reps + sets', () => {
  const f = parseNotationToken('40!5-3');
  assert.equal(f.load, '40');
  assert.equal(f.reps, '5');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'bilateral');
});

test('load + per-side reps + sets', () => {
  const f = parseNotationToken('40!:5-3');
  assert.equal(f.load, '40');
  assert.equal(f.reps, '5');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'unilateral-l-first');
});

test('pair of implements + per-side reps + sets', () => {
  const f = parseNotationToken(':20!:5-3');
  assert.equal(f.load, ':20');
  assert.equal(f.reps, '5');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'unilateral-l-first');
});

test('pair of implements + bilateral reps + sets', () => {
  const f = parseNotationToken(':20!10-3');
  assert.equal(f.load, ':20');
  assert.equal(f.reps, '10');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'bilateral');
});

test('cable stack notation', () => {
  const f = parseNotationToken('^15!:10-2');
  assert.equal(f.load, '^15');
  assert.equal(f.reps, '10');
  assert.equal(f.sets, 2);
  assert.equal(f.sideScheme, 'unilateral-l-first');
});

test('hold time + sets', () => {
  const f = parseNotationToken('30s!-3');
  assert.equal(f.load, '30s');
  assert.equal(f.holdSec, null); // 30s is in load, not holdSec here
  assert.equal(f.sets, 3);
});

test('bodyweight per-side reps + sets', () => {
  const f = parseNotationToken(':5-3');
  assert.equal(f.load, '');
  assert.equal(f.reps, '5');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'unilateral-l-first');
});

test('bodyweight bilateral reps + sets', () => {
  const f = parseNotationToken('8-3');
  assert.equal(f.load, '');
  assert.equal(f.reps, '8');
  assert.equal(f.sets, 3);
  assert.equal(f.sideScheme, 'bilateral');
});

test('empty token returns defaults', () => {
  const f = parseNotationToken('');
  assert.equal(f.load, '');
  assert.equal(f.sets, null);
  assert.equal(f.reps, null);
  assert.equal(f.sideScheme, 'bilateral');
});

// ---- parse() line-classifier tests ----

test('extracts workout name from # heading', () => {
  const ast = parse('# My Workout\n');
  assert.equal(ast.name, 'My Workout');
});

test('creates block from ## N. heading', () => {
  const md = '# WO\n## 1. Push Day\n';
  const ast = parse(md);
  assert.equal(ast.blocks.length, 1);
  assert.equal(ast.blocks[0].name, 'Push Day');
  assert.equal(ast.blocks[0].order, 1);
});

test('creates block from ## heading without order', () => {
  const md = '# WO\n## Accessory\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].name, 'Accessory');
  assert.equal(ast.blocks[0].order, 0);
});

test('ignores checkbox state on prescription bullet', () => {
  const md = '# WO\n## 1. A\n- [x] *Squat* 40!8-3\n';
  const ast = parse(md);
  const p = ast.blocks[0].prescriptions[0];
  assert.equal(p.name, 'Squat');
});

test('strips italic markers from prescription name', () => {
  const md = '# WO\n## 1. A\n- [ ] *Bench Press*\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].prescriptions[0].name, 'Bench Press');
});

test('strips bold markers from prescription name', () => {
  const md = '# WO\n## 1. A\n- [ ] **Bench Press**\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].prescriptions[0].name, 'Bench Press');
});

test('parses trailing notation token on bullet line', () => {
  const md = '# WO\n## 1. A\n- [ ] *Squat* 40!8-3\n';
  const ast = parse(md);
  const p = ast.blocks[0].prescriptions[0];
  assert.equal(p.load, '40');
  assert.equal(p.reps, '8');
  assert.equal(p.sets, 3);
});

test('captures Alt: as prescription.alt', () => {
  const md = '# WO\n## 1. A\n- [ ] *Press*\n    Alt: Band press\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].prescriptions[0].alt, 'Band press');
});

test('captures Cue: as prescription.cues entry', () => {
  const md = '# WO\n## 1. A\n- [ ] *Press*\n    Cue: Keep elbows in\n';
  const ast = parse(md);
  assert.deepEqual(ast.blocks[0].prescriptions[0].cues, ['Keep elbows in']);
});

test('captures indented free text as notes', () => {
  const md = '# WO\n## 1. A\n- [ ] *Press*\n    Keep tight.\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].prescriptions[0].notes, 'Keep tight.');
});

test('captures same-line trailing text (after " - ") as notes', () => {
  const md = '# WO\n## 1. A\n- [ ] *Press* - do this slowly\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].prescriptions[0].notes, 'do this slowly');
});

test('extracts inline URL into refs', () => {
  const md = '# WO\n## 1. A\n- [ ] *[Bear crawl](https://example.com)*\n';
  const ast = parse(md);
  const p = ast.blocks[0].prescriptions[0];
  assert.equal(p.name, 'Bear crawl');
  assert.equal(p.refs.length, 1);
  assert.equal(p.refs[0].url, 'https://example.com');
});

test('captures block description (free text before first bullet)', () => {
  const md = '# WO\n## 1. A\n3 rounds, 90s rest.\n- [ ] *Squat*\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].description, '3 rounds, 90s rest.');
});

test('captures sub-block label from ### heading', () => {
  const md = '# WO\n## 1. A\n### Warm-up\n- [ ] *Row*\n';
  const ast = parse(md);
  assert.equal(ast.blocks[0].subLabel, 'Warm-up');
});

test('creates implicit block for orphan bullets (no ## heading)', () => {
  const md = '# Shoulder PT\n- [ ] *Band Pull-Apart*\n';
  const ast = parse(md);
  assert.equal(ast.blocks.length, 1);
  assert.equal(ast.blocks[0].prescriptions.length, 1);
});

test('multiple blocks in sequence', () => {
  const md = [
    '# WO',
    '## 1. Push',
    '- [ ] *Bench*',
    '## 2. Pull',
    '- [ ] *Row*',
  ].join('\n');
  const ast = parse(md);
  assert.equal(ast.blocks.length, 2);
  assert.equal(ast.blocks[0].prescriptions[0].name, 'Bench');
  assert.equal(ast.blocks[1].prescriptions[0].name, 'Row');
});

// ---- Fixture round-trip ----

test('fixture parses without crashing', () => {
  const fixturePath = path.join(__dirname, 'fixtures', '9.2B-shoulder-pt.md');
  const text = fs.readFileSync(fixturePath, 'utf8');
  const ast = parse(text);
  assert.ok(ast.name, 'has workout name');
  assert.ok(ast.blocks.length > 0, 'has blocks');
});

test('fixture: workout name is Shoulder PT', () => {
  const fixturePath = path.join(__dirname, 'fixtures', '9.2B-shoulder-pt.md');
  const ast = parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(ast.name, 'Shoulder PT');
});

test('fixture: has 4 blocks', () => {
  const fixturePath = path.join(__dirname, 'fixtures', '9.2B-shoulder-pt.md');
  const ast = parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(ast.blocks.length, 4);
});

test('fixture: first block has 3 prescriptions', () => {
  const fixturePath = path.join(__dirname, 'fixtures', '9.2B-shoulder-pt.md');
  const ast = parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(ast.blocks[0].prescriptions.length, 3);
});

test('fixture: RDL prescription has per-side reps', () => {
  const fixturePath = path.join(__dirname, 'fixtures', '9.2B-shoulder-pt.md');
  const ast = parse(fs.readFileSync(fixturePath, 'utf8'));
  // Block 2 (index 2) = Posterior Chain, first prescription = Barbell RDL
  const rdl = ast.blocks[2].prescriptions[0];
  assert.equal(rdl.name, 'Barbell RDL');
  assert.equal(rdl.sideScheme, 'unilateral-l-first');
  assert.equal(rdl.reps, '5');
  assert.equal(rdl.sets, 3);
});
