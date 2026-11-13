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
};

export default nextConfig;
