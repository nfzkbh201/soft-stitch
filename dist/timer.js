(function (root) {
  'use strict';
  const validMinutes = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 180;
  function fresh(minutes = 25, pattern = 'cherries', palette = 'rose') {
    return { id: null, status: 'idle', minutes, duration: minutes * 60000, remaining: minutes * 60000, deadline: null, pattern, palette, intention: '' };
  }
  function remaining(timer, now = Date.now()) {
    return Math.max(0, timer.status === 'running' ? timer.deadline - now : timer.remaining);
  }
  function progress(timer, now = Date.now()) {
    return Math.max(0, Math.min(1, 1 - remaining(timer, now) / timer.duration));
  }
  function start(timer, now = Date.now(), id = String(now)) {
    if (!['idle', 'paused'].includes(timer.status)) return timer;
    return { ...timer, id: timer.id || id, status: 'running', deadline: now + timer.remaining };
  }
  function pause(timer, now = Date.now()) {
    if (timer.status !== 'running') return timer;
    return { ...timer, status: 'paused', remaining: remaining(timer, now), deadline: null };
  }
  function finish(timer) {
    return { ...timer, status: 'completed', remaining: 0, deadline: null };
  }
  function restore(raw) {
    if (!raw || !validMinutes(raw.minutes) || raw.duration !== raw.minutes * 60000 || !['idle', 'running', 'paused', 'completed'].includes(raw.status)) return fresh();
    if (!Number.isFinite(raw.remaining) || raw.remaining < 0 || raw.remaining > raw.duration) return fresh();
    if (raw.status === 'running' && !Number.isFinite(raw.deadline)) return fresh();
    if (!['cherries', 'bow', 'flowers'].includes(raw.pattern) || !['rose', 'blue', 'peach'].includes(raw.palette)) return fresh();
    if (raw.status !== 'idle' && typeof raw.id !== 'string') return fresh();
    return { ...raw, intention: typeof raw.intention === 'string' ? raw.intention.slice(0, 100) : '' };
  }
  root.StitchTimer = { fresh, remaining, progress, start, pause, finish, restore, validMinutes };
})(globalThis);
