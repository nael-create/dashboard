import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // L'app lit les fichiers Markdown du dossier parent (la racine du dépôt).
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  // Le bouton « N » de Next.js gênait la barre de navigation sur téléphone.
  devIndicators: false,
};

export default nextConfig;
