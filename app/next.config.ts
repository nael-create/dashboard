import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // L'app lit les fichiers Markdown du dossier parent (la racine du dépôt).
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  // Le bouton « N » de Next.js gênait la barre de navigation sur téléphone.
  devIndicators: false,
  // Accès depuis le téléphone via Tailscale Serve (https://<mac>.<réseau>.ts.net) : sans cela,
  // Next.js refuse le rechargement à chaud venant de cette adresse. L'accès reste protégé par
  // le mot de passe (src/proxy.ts).
  allowedDevOrigins: ["**.ts.net"],
  experimental: {
    // Pas de cache de compilation sur disque : après une mise à jour (git pull), un cache gardé d'une
    // version précédente pouvait servir un CSS périmé (classes manquantes → images et mises en page cassées).
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
