const test = require('node:test');
const assert = require('node:assert/strict');
require('../dist/data.js');
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
test('legacy sessions migrate as focus sessions without changing their deadline', () => {
  const old=T.start(T.fresh(45),1000,'old');delete old.mode;delete old.design;delete old.focusMinutes;
  const restored=T.restore(old);assert.equal(restored.mode,'focus');assert.equal(restored.focusMinutes,45);assert.equal(restored.deadline,old.deadline);
});
test('breaks are opt-in, keep the completed design and restore the focus duration', () => {
  const focus=T.finish(T.start(T.fresh(45,'initials','custom',{initials:'NZK',month:6,colours:['#ab1234','#cd5678','#ab9944']}),1000,'focus'));
  assert.equal(T.takeBreak(focus,0),focus);
  const pause=T.takeBreak(focus,5,5000,'break');assert.equal(pause.mode,'break');assert.equal(pause.focusMinutes,45);assert.equal(pause.deadline,305000);assert.equal(pause.status,'running');assert.deepEqual(pause.design,focus.design);
  const restored=T.restore(JSON.parse(JSON.stringify(T.pause(pause,10000))));assert.equal(restored.mode,'break');assert.equal(restored.remaining,295000);assert.equal(restored.focusMinutes,45);
  assert.equal(T.takeBreak(T.finish(pause),5).status,'completed');
});
test('personalised patterns survive pause, reload and completion', () => {
  for(const pattern of ['strawberries','initials','birthflower']){
    const running=T.start(T.fresh(25,pattern,'custom',{initials:'NZK',month:11,colours:['#ab1234','#cd5678','#ab9944']}),1000,'test');
    const restored=T.restore(T.pause(running,3000));assert.deepEqual(restored.design,running.design);assert.equal(restored.pattern,pattern);assert.equal(T.finish(restored).remaining,0);
  }
});
