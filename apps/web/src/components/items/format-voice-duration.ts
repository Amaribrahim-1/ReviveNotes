export function formatVoiceDuration(seconds: number | null): string {
  const total = seconds === null || seconds < 0 ? 0 : Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const restDigits = rest < 10 ? `0${rest}` : `${rest}`;
  return `${minutes}:${restDigits}`;
}
