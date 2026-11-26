export const productionCsp = [
  "default-src 'self'",
  "script-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://api.clerk.com https://*.protect.clerk.com:*",
  "frame-src https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
export const productionHeaders = {
  'Content-Security-Policy': productionCsp,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};
