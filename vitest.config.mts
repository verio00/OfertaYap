import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Pruebas unitarias y de componentes (con mocks). No requieren Supabase.
 * Las pruebas de integración real están en tests/integration y se ejecutan
 * aparte con `npm run test:integration` (vitest.integration.config.mts).
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    // Garantiza que las pruebas con mocks no lean un .env.local real.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://mock-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
