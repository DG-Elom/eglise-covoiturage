import type { NextConfig } from "next";

// 'unsafe-eval' n'est requis que par le bundler en développement (HMR/Turbopack).
// En production il élargit inutilement la surface XSS : on le retire.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://accounts.google.com",
  "https://apis.google.com",
].join(" ");

// En dev/test, autorise le Supabase local (127.0.0.1:54321).
// La valeur provient de la variable d'env pour éviter de hardcoder en prod.
const supabaseLocalOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1")
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : null;
const extraConnectSrc = supabaseLocalOrigin
  ? `${supabaseLocalOrigin} ${supabaseLocalOrigin.replace("http://", "ws://")}`
  : "";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
              "img-src 'self' data: blob: https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://lh3.googleusercontent.com",
              "font-src 'self'",
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://events.mapbox.com https://accounts.google.com${extraConnectSrc ? " " + extraConnectSrc : ""}`,
              "frame-src https://accounts.google.com",
              "frame-ancestors 'none'",
              // mapbox-gl decode les vector tiles dans un Web Worker cree via blob:.
              // Sans worker-src/child-src explicite, default-src 'self' bloque ce
              // worker et la carte n'affiche que les markers (fond vide).
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
