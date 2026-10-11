(function (root) {
  'use strict';
  const patterns = ['cherries', 'bow', 'flowers', 'strawberries', 'initials', 'birthflower'];
  const palettes = ['rose', 'blue', 'peach', 'custom'];
  const birthFlowers = ['Carnation', 'Violet', 'Daffodil', 'Daisy', 'Lily of the valley', 'Rose', 'Water lily', 'Poppy', 'Aster', 'Cosmos', 'Chrysanthemum', 'Paperwhite'];
  const defaults = ['#ae3959', '#d2ac59', '#667c4e'];
  const isColour = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function design(raw = {}) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      initials: typeof raw.initials === 'string' ? raw.initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'N' : 'N',
      month: Number.isInteger(raw.month) && raw.month >= 1 && raw.month <= 12 ? raw.month : 4,
      colours: Array.isArray(raw.colours) && raw.colours.length === 3 && raw.colours.every(isColour) ? [...raw.colours] : [...defaults]
    };
  }
  function piece(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 128 || !patterns.includes(raw.pattern) || !palettes.includes(raw.palette)) return null;
    if (!Number.isInteger(raw.minutes) || raw.minutes < 1 || raw.minutes > 180 || !Number.isFinite(raw.completedAt) || raw.completedAt < 0 || raw.completedAt > 8640000000000000) return null;
    if (raw.design !== undefined && (!raw.design || typeof raw.design !== 'object' || Array.isArray(raw.design))) return null;
    if (raw.palette === 'custom' && (!Array.isArray(raw.design?.colours) || raw.design.colours.length !== 3 || !raw.design.colours.every(isColour))) return null;
    return { id: raw.id, pattern: raw.pattern, palette: raw.palette, minutes: raw.minutes, completedAt: raw.completedAt,
      intention: typeof raw.intention === 'string' ? raw.intention.slice(0, 100) : '', design: design(raw.design) };
  }
  function merge(existing, incoming) {
    const unique = new Map();
    for (const value of [...existing, ...incoming]) {
      const valid = piece(value);
      if (valid && !unique.has(valid.id)) unique.set(valid.id, valid);
    }
    return [...unique.values()].sort((a, b) => b.completedAt - a.completedAt);
  }
  function readPieces(raw) { return merge([], Array.isArray(raw) ? raw : []); }
  function backup(pieces) { return { app: 'soft-stitch', version: 2, exportedAt: new Date().toISOString(), pieces: readPieces(pieces) }; }
  function parseBackup(text) {
    let raw;
    try { raw = JSON.parse(text); } catch { throw new Error('That file is not readable JSON.'); }
    if (!raw || raw.app !== 'soft-stitch' || ![1, 2].includes(raw.version) || !Array.isArray(raw.pieces)) throw new Error('Choose a Soft Stitch collection backup.');
    if (raw.pieces.length > 10000) throw new Error('A backup can contain up to 10,000 pieces.');
    if (raw.pieces.some(value => !piece(value))) throw new Error('This backup contains an invalid piece. Nothing was imported.');
    return readPieces(raw.pieces);
  }
  function dayKey(value) {
    const date = new Date(value);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function monthDays(year, month) {
    const days = new Date(year, month + 1, 0).getDate(), offset = (new Date(year, month, 1).getDay() + 6) % 7;
    return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
      const date = new Date(year, month, i - offset + 1, 12);
      return { key: dayKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
    });
  }
  function preferences(raw = {}) {
    return { breakMinutes: [0, 5, 10, 15].includes(raw?.breakMinutes) ? raw.breakMinutes : 5, notifications: raw?.notifications === true };
  }
  root.StitchData = { patterns, palettes, birthFlowers, design, piece, readPieces, merge, backup, parseBackup, dayKey, monthDays, preferences };
})(globalThis);
