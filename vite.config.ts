import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { productionCsp, productionHeaders } from './securityHeaders.js';

export default defineConfig({
  plugins: [react(), {
    name: 'production-security-headers',
    apply: 'build',
    transformIndexHtml() {
      // CSP fallback for hosts that do not understand the generated _headers.
      // frame-ancestors must be delivered as an HTTP header, not a meta tag.
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: productionCsp.replace("; frame-ancestors 'none'", '') }, injectTo: 'head-prepend' }];
    },
    generateBundle() {
      const source = '/*\n' + Object.entries(productionHeaders).map(([key, value]) => `  ${key}: ${value}`).join('\n') + '\n';
      this.emitFile({ type: 'asset', fileName: '_headers', source });
    },
  }],
  preview: { headers: productionHeaders },
  server: {
    fs: {deny: ['.env','.env.*','*.{crt,pem}','**/.git/**','**/.clerk/**','**/research/**','**/reports/**','**/qa-artifacts/**','**/*.csv','**/*.xlsx','**/*.xls','**/*.sqlite','**/*.sqlite-*']},
    host: '0.0.0.0',
    strictPort: true,
    port: 5173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
});
