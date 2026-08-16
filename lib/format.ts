export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatSpeedKmh(speedMps: number): string {
  return `${(speedMps * 3.6).toFixed(1)} km/h`;
}

export function formatPaceMinPerKm(speedMps: number): string {
  if (speedMps < 0.2) return '--:--';
  const paceMinutes = 1000 / speedMps / 60;
  const minutes = Math.floor(paceMinutes);
  const seconds = Math.round((paceMinutes - minutes) * 60);
  const ss = String(seconds).padStart(2, '0');
  return `${minutes}:${ss} /km`;
}
