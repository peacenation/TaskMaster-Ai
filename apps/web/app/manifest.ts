import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest. With the service worker
// (public/sw.js) this makes TaskMaster installable. Public in proxy.ts so the
// browser can fetch it before sign-in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TaskMaster",
    short_name: "TaskMaster",
    description: "Turn everything on your mind into a clear, realistic plan.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf6ee",
    theme_color: "#5a4632",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Brain dump", url: "/dump" },
      { name: "Focus", url: "/focus" },
    ],
  };
}
