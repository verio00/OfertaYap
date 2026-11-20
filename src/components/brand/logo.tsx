import Link from "next/link";

interface LogoProps {
  className?: string;
}

/** Logotipo de OfertaYap: etiqueta de precio + nombre. Enlaza a la página de inicio. */
export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 ${className}`}
      aria-label="OfertaYap, ir al inicio"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"
          />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-slate-900">
        Oferta<span className="text-amber-500">Yap</span>
      </span>
    </Link>
  );
}
