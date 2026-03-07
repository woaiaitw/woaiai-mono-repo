export interface Env {
  // Mux API credentials (HTTP Basic Auth)
  MUX_TOKEN_ID: string;
  MUX_TOKEN_SECRET: string;
  // Webhook signing secret
  MUX_WEBHOOK_SECRET: string;
  // CORS
  WEB_URL: string;
}
