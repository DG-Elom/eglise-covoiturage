import type { Metadata } from "next";

export const pwaMetadata: Metadata = {
  applicationName: "Covoiturage ICC Metz",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Covoiturage",
  },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};
