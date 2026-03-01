export interface Env {
  // Cloudflare RealtimeKit credentials
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  REALTIME_APP_ID: string;
  // Deepgram direct API (Nova-2 fallback for languages unsupported by Nova-3)
  DEEPGRAM_API_KEY: string;
  // CORS
  WEB_URL: string;
  // Durable Object binding
  CAPTION_ROOM: DurableObjectNamespace;
}
