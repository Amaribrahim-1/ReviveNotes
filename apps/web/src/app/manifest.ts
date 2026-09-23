import type { MetadataRoute } from "next";

// Share target is a later task. This manifest only makes the app installable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReviveNotes",
    short_name: "ReviveNotes",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
