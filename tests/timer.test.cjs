const test = require('node:test');
const assert = require('node:assert/strict');
require('../dist/timer.js');
const T = globalThis.StitchTimer;

test('a timer uses elapsed wall time, even when callbacks stop', () => {
  const timer = T.start(T.fresh(25), 1000, 'test');
  assert.equal(T.remaining(timer, 61000), 24 * 60000);
  assert.equal(T.remaining(timer, 2e6), 0);
  assert.equal(T.progress(timer, 2e6), 1);
});
test('pause freezes the remaining time and resume sets a new deadline', () => {
  const timer = T.start(T.fresh(1), 1000, 'test');
  const paused = T.pause(timer, 11000);
  assert.equal(T.remaining(paused, 100000), 50000);
  const resumed = T.start(paused, 100000, 'new-id');
  assert.equal(resumed.id, 'test');
  assert.equal(resumed.deadline, 150000);
  assert.equal(T.remaining(resumed, 120000), 30000);
});
test('a persisted running timer keeps its deadline after a reload', () => {
  const restored = T.restore(JSON.parse(JSON.stringify(T.start(T.fresh(15), 1000, 'test'))));
  assert.equal(T.remaining(restored, 301000), 10 * 60000);
});
test('completion is a stable state that cannot be resumed', () => {
  const completed = T.finish(T.start(T.fresh(1), 1000, 'test'));
  assert.equal(T.remaining(completed), 0);
  assert.equal(T.progress(completed), 1);
  assert.equal(T.start(completed, 999999).status, 'completed');
});
test('invalid durations and corrupt persisted states are rejected', () => {
  for (const value of [0, -1, 181, 1.5, '', 'hello', NaN, Infinity]) assert.equal(T.validMinutes(value), false);
  for (const value of [1, 25, '45', 180]) assert.equal(T.validMinutes(value), true);
  for (const raw of [null, {}, { ...T.fresh(), status: 'running', deadline: null }, { ...T.fresh(), pattern: 'invalid' }, { ...T.fresh(), remaining: Infinity }]) assert.equal(T.restore(raw).status, 'idle');
});
