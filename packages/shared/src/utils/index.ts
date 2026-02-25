export function getAuthUrl(envValue?: string): string {
  return envValue ?? "http://localhost:8788";
}

export function getWebUrl(envValue?: string): string {
  return envValue ?? "http://localhost:3000";
}

export function getRtcUrl(envValue?: string): string {
  return envValue ?? "http://localhost:8789";
}
