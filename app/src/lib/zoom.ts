/**
 * Zoom du contenu (bouton « − 90 % + » de l'en-tête), indépendant du zoom du navigateur.
 * Appliqué avec la propriété CSS `zoom` sur le conteneur #zoom-root (le CONTENU de la page seulement :
 * l'en-tête garde toujours sa taille), via la variable --zoom posée sur <html> avant l'affichage.
 * Valeur par défaut : --zoom-default (globals.css) = 90 % sur grand écran, 100 % sur téléphone.
 * Mémorisé dans ce navigateur (confort).
 * Les fenêtres flottantes (barre de surlignage, popovers) sont hors du conteneur : `viewportFactor()`
 * convertit les mesures faites dans le conteneur, quel que soit le navigateur.
 */

export const ZOOM_LEVELS = [0.75, 0.8, 0.9, 1, 1.1, 1.25];
export const ZOOM_KEY = "dashboard.zoom";
export const ZOOM_EVENT = "dashboard:zoom";

/** Script exécuté dans <head> avant l'affichage : reprend le zoom mémorisé. */
export const ZOOM_INIT_SCRIPT = `try{var z=parseFloat(localStorage.getItem(${JSON.stringify(ZOOM_KEY)}));if(z>=0.5&&z<=2)document.documentElement.style.setProperty("--zoom",String(z))}catch(e){}`;

/** Zoom par défaut de cet écran (variable CSS --zoom-default : 0,9 sur grand écran, 1 sur téléphone). */
export function defaultZoom(): number {
  if (typeof document === "undefined") return 1;
  const d = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zoom-default"));
  return d >= 0.5 && d <= 2 ? d : 1;
}

export function getZoom(): number {
  if (typeof document === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zoom"));
  return z >= 0.5 && z <= 2 ? z : defaultZoom();
}

export function setZoom(z: number) {
  const clamped = Math.min(Math.max(z, ZOOM_LEVELS[0]), ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
  const isDefault = Math.abs(clamped - defaultZoom()) < 0.001;
  if (isDefault) document.documentElement.style.removeProperty("--zoom");
  else document.documentElement.style.setProperty("--zoom", String(clamped));
  try {
    if (isDefault) localStorage.removeItem(ZOOM_KEY);
    else localStorage.setItem(ZOOM_KEY, String(clamped));
  } catch {
    /* stockage indisponible : le zoom vaut pour cette page seulement */
  }
  window.dispatchEvent(new Event(ZOOM_EVENT));
}

/** Niveau suivant / précédent dans la liste. */
export function stepZoom(current: number, dir: 1 | -1): number {
  const i = ZOOM_LEVELS.findIndex((l) => Math.abs(l - current) < 0.001);
  const idx = i === -1 ? ZOOM_LEVELS.indexOf(1) : i;
  return ZOOM_LEVELS[Math.min(Math.max(idx + dir, 0), ZOOM_LEVELS.length - 1)];
}

/**
 * Facteur à appliquer aux mesures (getBoundingClientRect) d'un élément du conteneur zoomé pour obtenir
 * des pixels de l'écran : 1 si le navigateur renvoie déjà des mesures zoomées (Chrome, Firefox récents),
 * sinon le zoom (anciens moteurs, Safari selon les versions). Mesuré une fois par niveau de zoom.
 */
const factorCache = new Map<number, number>();
export function viewportFactor(): number {
  const zoom = getZoom();
  if (zoom === 1) return 1;
  const cached = factorCache.get(zoom);
  if (cached) return cached;
  const root = document.getElementById("zoom-root");
  if (!root) return 1;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:1px;left:0;top:0";
  root.appendChild(probe);
  const measured = probe.getBoundingClientRect().width / 100;
  root.removeChild(probe);
  const factor = measured > 0 ? zoom / measured : 1;
  factorCache.set(zoom, factor);
  return factor;
}
