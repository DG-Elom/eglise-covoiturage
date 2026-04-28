import type { Metadata } from "next";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Flyer Covoiturage ICC Metz",
};

export default function FlyerPage() {
  return (
    <>
      <style>{`
        @page { size: A5; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Flyer prêt à imprimer</h1>
          <p className="text-xs text-slate-500">
            Format A5 (148×210 mm). Clique sur Imprimer puis choisis « Enregistrer en PDF ».
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="flex justify-center bg-slate-100 px-4 pb-12 pt-4 dark:bg-slate-950">
        <Flyer />
      </div>
    </>
  );
}

function Flyer() {
  return (
    <article
      className="flyer bg-white text-slate-900 shadow-2xl"
      style={{
        width: "148mm",
        height: "210mm",
        padding: "12mm",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #ffffff 0%, #ffffff 60%, #ecfdf5 100%)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "8mm" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icc-logo.svg" alt="ICC" style={{ height: "16mm" }} />
        <div>
          <p
            style={{
              fontSize: "9pt",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#047857",
              margin: 0,
            }}
          >
            ICC Metz
          </p>
          <h1
            style={{
              fontSize: "20pt",
              fontWeight: 700,
              margin: "1mm 0 0",
              lineHeight: 1.1,
              color: "#0f172a",
            }}
          >
            Covoiturage
          </h1>
        </div>
      </header>

      <section style={{ textAlign: "center", marginTop: "2mm" }}>
        <h2
          style={{
            fontSize: "26pt",
            fontWeight: 800,
            lineHeight: 1.05,
            margin: 0,
            color: "#0f172a",
          }}
        >
          Allons à l&apos;église{" "}
          <span style={{ color: "#059669" }}>ensemble</span>
        </h2>
        <p
          style={{
            fontSize: "11pt",
            color: "#475569",
            margin: "4mm auto 0",
            maxWidth: "110mm",
            lineHeight: 1.4,
          }}
        >
          Tu n&apos;as pas de voiture pour venir au culte ? Tu en as une et tu
          veux aider la famille ? L&apos;app pour s&apos;organiser entre fidèles
          est là.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3mm",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "4mm",
            borderRadius: "4mm",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qr-code.svg"
            alt="QR code"
            style={{ width: "55mm", height: "55mm", display: "block" }}
          />
        </div>
        <p
          style={{
            fontSize: "16pt",
            fontWeight: 700,
            margin: 0,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          icc-covoit.fr
        </p>
        <p style={{ fontSize: "9pt", color: "#64748b", margin: 0 }}>
          Flashe le code ou tape l&apos;adresse dans ton navigateur
        </p>
      </section>

      <section style={{ display: "flex", justifyContent: "space-around", gap: "3mm" }}>
        <Step n="1" text="Crée ton compte" />
        <Step n="2" text="Choisis ton rôle" />
        <Step n="3" text="On te met en relation" />
      </section>

      <footer
        style={{
          textAlign: "center",
          fontSize: "8.5pt",
          color: "#64748b",
          borderTop: "1px solid #e2e8f0",
          paddingTop: "3mm",
        }}
      >
        Gratuit · Pas de pub · 100 % communautaire
      </footer>
    </article>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div
        style={{
          width: "10mm",
          height: "10mm",
          borderRadius: "50%",
          background: "#059669",
          color: "white",
          fontWeight: 700,
          fontSize: "11pt",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </div>
      <p
        style={{
          fontSize: "9pt",
          color: "#0f172a",
          margin: "2mm 0 0",
          fontWeight: 600,
        }}
      >
        {text}
      </p>
    </div>
  );
}
