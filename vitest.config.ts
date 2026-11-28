import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    env: {
      VITE_PUBLIC_CATALOGUE_URL: "",
      VITE_AUTH_PROVIDER: "supabase",
      VITE_SUPABASE_URL: "https://career-radar-test.invalid",
      VITE_SUPABASE_ANON_KEY: "test-only-anon-key",
    },
  },
});
