import Link from "next/link";
import { Empty } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Empty>
      Page introuvable.{" "}
      <Link href="/" className="text-accent-text underline underline-offset-2">Retour à l&apos;accueil</Link>
    </Empty>
  );
}
