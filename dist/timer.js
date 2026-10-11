(function (root) {
  'use strict';
  const validMinutes = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 180;
  function fresh(minutes = 25, pattern = 'cherries', palette = 'rose', design) {
    return { id: null, status: 'idle', mode: 'focus', minutes, focusMinutes: minutes, duration: minutes * 60000, remaining: minutes * 60000, deadline: null, pattern, palette, intention: '', design: root.StitchData.design(design) };
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
    if (!root.StitchData.patterns.includes(raw.pattern) || !root.StitchData.palettes.includes(raw.palette)) return fresh();
    if (raw.status !== 'idle' && (typeof raw.id !== 'string' || !raw.id || raw.id.length > 128)) return fresh();
    const base = fresh(Number(raw.minutes), raw.pattern, raw.palette, raw.design);
    return { ...base, id: raw.status === 'idle' ? null : raw.id, status: raw.status,
      mode: raw.mode === 'break' ? 'break' : 'focus', focusMinutes: validMinutes(raw.focusMinutes) ? Number(raw.focusMinutes) : Number(raw.minutes),
      remaining: raw.status === 'completed' ? 0 : raw.status === 'idle' ? base.duration : raw.remaining,
      deadline: raw.status === 'running' ? raw.deadline : null,
      intention: typeof raw.intention === 'string' ? raw.intention.slice(0, 100) : '' };
  }
  function takeBreak(timer, minutes, now = Date.now(), id = String(now)) {
    if (!validMinutes(minutes) || timer.status !== 'completed' || timer.mode === 'break') return timer;
    return start({ ...fresh(minutes, timer.pattern, timer.palette, timer.design), mode: 'break', focusMinutes: timer.focusMinutes }, now, id);
  }
  root.StitchTimer = { fresh, remaining, progress, start, pause, finish, restore, validMinutes, takeBreak };
})(globalThis);
