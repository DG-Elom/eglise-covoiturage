export type NavApp = "google" | "apple" | "waze";

export function buildNavUrl(app: NavApp, lat: number, lng: number): string {
  switch (app) {
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    case "apple":
      return `https://maps.apple.com/?daddr=${lat},${lng}`;
    case "waze":
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
}

export function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function defaultNavApp(): NavApp {
  return detectPlatform() === "ios" ? "apple" : "google";
}
