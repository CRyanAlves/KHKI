export function motionDurationMilliseconds(value: string): number {
  const match = value.trim().match(/^([+]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)(ms|s)$/i);
  if (!match) return 0;
  const duration = Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1);
  return Number.isFinite(duration) && duration >= 0 ? duration : 0;
}
