import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * Contenedor visual común para las pantallas de cuenta (registro, inicio de
 * sesión y confirmación). Diseño mobile-first con tarjeta centrada.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-emerald-50 via-white to-amber-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Logo />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-6">
        <section
          aria-labelledby="auth-title"
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-emerald-900/5 sm:p-8"
        >
          <h1 id="auth-title" className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div> : null}
          <div className="mt-6">{children}</div>
        </section>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        © OfertaYap · Compara precios y encuentra ofertas en Perú
      </footer>
    </div>
  );
}
