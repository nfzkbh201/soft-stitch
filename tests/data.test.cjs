const test = require('node:test');
const assert = require('node:assert/strict');
require('../dist/data.js');
const D = globalThis.StitchData;
const piece = (id = 'one', extra = {}) => ({ id, pattern:'cherries', palette:'rose', minutes:25, completedAt:Date.UTC(2026,9,11), intention:'A chapter', ...extra });

test('old pieces migrate with their original identity, duration and palette', () => {
  const original = piece();
  const restored = D.readPieces([original]);
  assert.equal(restored.length,1);
  for (const key of Object.keys(original)) assert.equal(restored[0][key],original[key]);
  assert.deepEqual(restored[0].design,D.design());
});
test('custom colours and initials survive a backup round trip', () => {
  const original = piece('initials',{pattern:'initials',palette:'custom',design:{initials:'NZK',month:6,colours:['#bb3366','#ce9933','#446644']}});
  const restored = D.parseBackup(JSON.stringify(D.backup([original])));
  assert.deepEqual(restored[0],D.piece(original));
});
test('merge is idempotent and never replaces an existing piece with an import', () => {
  const existing = [piece('one')], incoming = [piece('one',{palette:'blue'}),piece('two')];
  const once = D.merge(existing,incoming);
  assert.equal(once.length,2);assert.equal(once.find(p=>p.id==='one').palette,'rose');
  assert.deepEqual(D.merge(once,incoming),once);
});
test('collection has no old 365-piece truncation', () => {
  const collection = Array.from({length:400},(_,i)=>piece(String(i)));
  assert.equal(D.parseBackup(JSON.stringify(D.backup(collection))).length,400);
});
test('invalid or unsupported backups fail atomically', () => {
  for (const text of ['bad','null','{}',JSON.stringify({app:'other',version:2,pieces:[]}),JSON.stringify({app:'soft-stitch',version:99,pieces:[]})]) assert.throws(()=>D.parseBackup(text));
  for(const invalid of [piece(''),piece('x',{minutes:NaN}),piece('x',{pattern:'__proto__'}),piece('x',{palette:'custom'}),piece('x',{completedAt:9e15}),piece('x',{design:null})]) {
    assert.throws(()=>D.parseBackup(JSON.stringify({app:'soft-stitch',version:2,pieces:[piece(),invalid]})));
  }
});
test('design normalizes untrusted input and copies the colour array', () => {
  assert.deepEqual(D.design(null),D.design());
  assert.equal(D.design({initials:'<n!zk4>',month:99}).initials,'NZK');
  assert.equal(D.design({month:99}).month,4);
  const first=D.design();first.colours[0]='#ffffff';assert.notEqual(D.design().colours[0],first.colours[0]);
});
test('calendar is Monday-first and handles leap years and year boundaries', () => {
  const feb=D.monthDays(2024,1);assert.equal(feb.length%7,0);assert.equal(feb.filter(d=>d.inMonth).length,29);assert.equal(feb[0].key,'2024-01-29');
  assert.equal(D.monthDays(2026,11).filter(d=>d.inMonth).length,31);
  assert.equal(D.dayKey(new Date(2026,9,11,23,59)),'2026-10-11');
});
