import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Pruebas de integración REAL contra un proyecto Supabase de DESARROLLO.
 * Lee .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * y opcionalmente INTEGRATION_TEST_EMAIL). Nunca usar un proyecto de producción.
 */
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 20_000,
  },
}));
