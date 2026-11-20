"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  CONFIRMATION_CONTENT,
  refineOutcomeWithHash,
  type ConfirmationOutcome,
} from "@/lib/auth/confirmation";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Muestra el resultado de la confirmación, precisándolo con el fragmento de la URL si existe. */
export function ConfirmationResult({ outcome }: { outcome: ConfirmationOutcome }) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const content = CONFIRMATION_CONTENT[refineOutcomeWithHash(outcome, hash)];
  const box =
    content.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div role="status" className={`rounded-xl border p-5 ${box}`}>
      <h2 className="font-semibold">{content.title}</h2>
      <p className="mt-1 text-sm leading-6">{content.body}</p>
      <Link
        href={content.cta.href}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {content.cta.label}
      </Link>
    </div>
  );
}
