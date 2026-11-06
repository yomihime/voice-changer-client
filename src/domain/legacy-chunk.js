// Legacy VCC expresses chunk duration in 128-frame units at a nominal 48 kHz.
const unitsPerSecond = 48000 / 128;
const minUnits = Math.ceil(0.02 * unitsPerSecond);
const maxUnits = 5 * unitsPerSecond;

export const legacyChunkSeconds = units => units / unitsPerSecond;

export function legacyChunkUnits(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0.02 || seconds > 5) return null;
  const units = Math.round(seconds * unitsPerSecond);
  return units >= minUnits && units <= maxUnits ? units : null;
}

export function chunkDurationOptions(presets, current, legacy) {
  const values = presets.map(seconds => {
    if (!legacy) return seconds;
    const units = legacyChunkUnits(seconds);
    return units === null ? null : legacyChunkSeconds(units);
  }).filter(seconds => Number.isFinite(seconds) && seconds > 0);
  if (Number.isFinite(current)) values.push(current);
  return [...new Set(values)].sort((left, right) => left - right);
}
