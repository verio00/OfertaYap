import type { Metadata } from "next";
import { Suspense } from "react";

import { ConfirmationResult } from "@/components/auth/confirmation-result";
import { AuthShell } from "@/components/layout/auth-shell";
import { parseOutcome } from "@/lib/auth/confirmation";

export const metadata: Metadata = {
  title: "Confirmación de correo",
  robots: { index: false },
};

async function ConfirmationFromParams({ searchParams }: { searchParams: PageProps<"/auth/confirmacion">["searchParams"] }) {
  const { estado } = await searchParams;
  return <ConfirmationResult outcome={parseOutcome(estado)} />;
}

export default function ConfirmacionPage(props: PageProps<"/auth/confirmacion">) {
  return (
    <AuthShell title="Confirmación de correo">
      <Suspense fallback={<p className="text-sm text-slate-600">Cargando resultado…</p>}>
        <ConfirmationFromParams searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
