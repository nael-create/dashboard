import { redirect } from "next/navigation";

/** L'ancien onglet « pipeline » n'existe plus : redirigé vers la liste des projets. */
export default function PipelineTab() {
  redirect("/projets/liste");
}
