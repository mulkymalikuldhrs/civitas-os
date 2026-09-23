import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // Audit F-09: semua error tsc di src/ sudah dibersihkan — build WAJIB gagal
    // bila ada kesalahan tipe baru, agar tidak pernah lagi lolos lewat build.
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
