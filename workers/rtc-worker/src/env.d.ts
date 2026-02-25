export interface Env {
  // Cloudflare RealtimeKit credentials
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  REALTIME_APP_ID: string;
  // CORS
  WEB_URL: string;
  // Durable Object binding
  CAPTION_ROOM: DurableObjectNamespace;
}
