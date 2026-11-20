import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` lanza un error fuera del bundler de Next; en pruebas se neutraliza.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
