import type { MetadataRoute } from "next";

// Links only. Text and files are not listed, so the share sheet does not offer them.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReviveNotes",
    short_name: "ReviveNotes",
    start_url: "/inbox",
    display: "standalone",
    // Same values as --rn-bg and --rn-accent in globals.css (light theme).
    background_color: "#e8f0eb",
    theme_color: "#2a6b58",
    share_target: {
      action: "/share",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        url: "url",
      },
    },
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
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
