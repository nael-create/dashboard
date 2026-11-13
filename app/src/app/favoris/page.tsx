import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { FavoritesBoard } from "@/components/favorites/favorites-board";

export const metadata: Metadata = { title: "Favoris" };

export default function FavoritesPage() {
  return (
    <>
      <PageHeader title="Favoris" subtitle="Tout ce que tu as mis de côté, dans FAVORIS.md (titres et liens uniquement)." />
      <FavoritesBoard />
    </>
  );
}
