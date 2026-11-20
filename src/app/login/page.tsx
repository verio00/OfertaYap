import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/layout/auth-shell";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "El inicio de sesión de OfertaYap estará disponible próximamente.",
};

/**
 * Página provisional. El inicio de sesión se implementa en HU02; aquí solo
 * existe el destino de navegación usado por el registro (HU01).
 */
export default function LoginPage() {
  return (
    <AuthShell
      title="Iniciar sesión"
      description="Estamos preparando el inicio de sesión. Muy pronto podrás ingresar con tu correo y contraseña."
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">Próximamente</p>
        <p className="mt-1">
          Esta funcionalidad se implementará en la historia HU02. Si ya confirmaste tu correo, tu cuenta está lista.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Volver al inicio
        </Link>
        <Link
          href="/registro"
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Crear una cuenta
        </Link>
      </div>
    </AuthShell>
  );
}
