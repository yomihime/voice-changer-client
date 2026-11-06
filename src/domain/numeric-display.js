// Display formatting only. Never use these strings as values sent to the backend.
export function parameterValue(value, minimumDecimals = 2) {
  if (!Number.isFinite(value)) return "未取得";
  // Remove only double arithmetic noise, retaining meaningful off-grid precision.
  const tolerance = Number.EPSILON * Math.abs(value) * 4;
  for (let digits = minimumDecimals; digits <= 15; digits++) {
    const text = value.toFixed(digits);
    if (Math.abs(Number(text) - value) <= tolerance) return text;
  }
  return String(value);
}

export function durationMilliseconds(seconds) {
  const milliseconds = seconds * 1000;
  const rounded = Number(milliseconds.toFixed(3));
  const approximate = Math.abs(rounded - milliseconds) > Number.EPSILON * Math.max(1, Math.abs(milliseconds)) * 4;
  return `${approximate ? "約" : ""}${rounded} ms`;
}

export function durationWithFrames(seconds, sampleRate) {
  const duration = durationMilliseconds(seconds);
  return Number.isFinite(sampleRate) && sampleRate > 0
    ? `${duration}（${Math.round(sampleRate * seconds)} frames）` : duration;
}
