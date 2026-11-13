/**
 * Accès en LECTURE SEULE au dossier « Newsletters » d'Outlook via Microsoft Graph.
 *
 * - Application « publique » (pas de secret client) : connexion dans le navigateur avec PKCE.
 * - Permission demandée : Mail.Read uniquement (MSAL ajoute openid, profile, offline_access
 *   pour la connexion elle-même).
 * - Jetons stockés uniquement dans app/data/msal-cache.local.json (ignoré par git, droits 0600).
 * - Seul le dossier configuré est lu ; la liste des autres dossiers n'est consultée que
 *   pour trouver son identifiant (noms seulement, jamais leurs messages).
 * - Rien n'est écrit dans le dépôt : les messages restent en mémoire quelques minutes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  CryptoProvider, InteractionRequiredAuthError, PublicClientApplication,
  type ICachePlugin, type TokenCacheContext,
} from "@azure/msal-node";
import sanitizeHtml from "sanitize-html";
import config from "@config";

export const SCOPES = ["Mail.Read"];
const GRAPH = "https://graph.microsoft.com/v1.0";
const CACHE_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "msal-cache.local.json");
const LIST_TTL_MS = 3 * 60 * 1000;

export const folderName = () => config.newslettersFolder;
/** Nom affiché du dossier lu (« inbox » → « Boîte de réception »). */
export const folderLabel = () => (folderName().trim().toLowerCase() === "inbox" ? "Boîte de réception" : folderName());

export function outlookSettings() {
  const clientId = process.env.MS_CLIENT_ID?.trim() || "";
  const tenant = process.env.MS_TENANT?.trim() || "common";
  return {
    clientId,
    configured: /^[0-9a-f-]{36}$/i.test(clientId),
    authority: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}`,
    redirectUri: process.env.MS_REDIRECT_URI?.trim() || "http://localhost:3000/api/outlook/callback",
  };
}

/** Erreur à afficher telle quelle (en français). */
export class OutlookError extends Error {
  constructor(message: string, public kind: "not-configured" | "not-connected" | "folder-missing" | "other" = "other") {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* MSAL                                                                 */
/* ------------------------------------------------------------------ */

const cachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx: TokenCacheContext) {
    try {
      ctx.tokenCache.deserialize(await fs.readFile(/*turbopackIgnore: true*/ CACHE_FILE, "utf8"));
    } catch {
      /* pas encore connecté */
    }
  },
  async afterCacheAccess(ctx: TokenCacheContext) {
    if (!ctx.cacheHasChanged) return;
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(/*turbopackIgnore: true*/ CACHE_FILE, ctx.tokenCache.serialize(), { mode: 0o600 });
  },
};

const g = globalThis as unknown as {
  __msal?: { key: string; app: PublicClientApplication };
  __msalPending?: Map<string, { verifier: string; at: number }>;
  __outlookList?: { at: number; folderId: string; items: NewsletterSummary[] };
  __outlookFolder?: { name: string; id: string };
};
const pending = (g.__msalPending ??= new Map());

function msal(): PublicClientApplication {
  const s = outlookSettings();
  if (!s.configured) {
    throw new OutlookError("Outlook n'est pas encore configuré (MS_CLIENT_ID manquant dans app/.env.local).", "not-configured");
  }
  const key = `${s.clientId}|${s.authority}`;
  if (g.__msal?.key !== key) {
    g.__msal = {
      key,
      app: new PublicClientApplication({
        auth: { clientId: s.clientId, authority: s.authority },
        cache: { cachePlugin },
      }),
    };
  }
  return g.__msal.app;
}

const crypto = new CryptoProvider();

/** URL de connexion Microsoft (étape 1). */
export async function loginUrl(): Promise<string> {
  const app = msal();
  const { verifier, challenge } = await crypto.generatePkceCodes();
  const state = crypto.createNewGuid();
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > 10 * 60 * 1000) pending.delete(k);
  pending.set(state, { verifier, at: now });
  return app.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: outlookSettings().redirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state,
    prompt: "select_account",
  });
}

/** Retour de Microsoft (étape 2) : échange le code contre des jetons, stockés en local. */
export async function completeLogin(code: string, state: string): Promise<void> {
  const p = pending.get(state);
  pending.delete(state);
  if (!p) throw new OutlookError("La connexion a expiré ou a été lancée depuis un autre onglet. Recommence.");
  await msal().acquireTokenByCode({ code, scopes: SCOPES, redirectUri: outlookSettings().redirectUri, codeVerifier: p.verifier });
  g.__outlookList = undefined;
}

export async function logout(): Promise<void> {
  try {
    const app = msal();
    const cache = app.getTokenCache();
    for (const a of await cache.getAllAccounts()) await cache.removeAccount(a);
  } catch {
    /* non configuré : rien à faire */
  }
  await fs.rm(/*turbopackIgnore: true*/ CACHE_FILE, { force: true });
  g.__outlookList = undefined;
  g.__outlookFolder = undefined;
}

export async function connectedAccount(): Promise<string | null> {
  if (!outlookSettings().configured) return null;
  const accounts = await msal().getTokenCache().getAllAccounts();
  return accounts[0]?.username ?? null;
}

async function accessToken(): Promise<string> {
  const app = msal();
  const [account] = await app.getTokenCache().getAllAccounts();
  if (!account) throw new OutlookError("Pas encore connecté à Outlook.", "not-connected");
  try {
    return (await app.acquireTokenSilent({ account, scopes: SCOPES })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      throw new OutlookError("La connexion à Outlook a expiré. Reconnecte-toi.", "not-connected");
    }
    throw e;
  }
}

/** Traduit les erreurs de connexion Microsoft les plus courantes. */
export function explainAuthError(code: string | null, description: string | null): string {
  const d = `${code ?? ""} ${description ?? ""}`;
  if (/access_denied/.test(d) && !/AADSTS/.test(d)) return "Connexion annulée.";
  if (/AADSTS65001|AADSTS90094|AADSTS65004|admin.*(consent|approval)|approbation/i.test(d)) {
    return "Ton organisation exige l'accord d'un administrateur pour cette application (consentement bloqué). Voir le guide, section « Compte professionnel ou scolaire ».";
  }
  if (/AADSTS50020|AADSTS50194|AADSTS9002331|AADSTS70002/.test(d)) {
    return "Ce type de compte n'est pas accepté par l'inscription de l'application. Vérifie « Types de comptes pris en charge » et MS_TENANT (voir le guide).";
  }
  if (/AADSTS700016/.test(d)) return "Application introuvable : vérifie MS_CLIENT_ID dans app/.env.local.";
  if (/AADSTS50011/.test(d)) return "L'URI de redirection ne correspond pas. Ajoute exactement http://localhost:3000/api/outlook/callback (voir le guide).";
  if (/AADSTS7000218/.test(d)) return "Active « Autoriser les flux clients publics » dans l'inscription de l'application (voir le guide).";
  return `Connexion refusée par Microsoft (${(code ?? "erreur").slice(0, 60)}).`;
}

/* ------------------------------------------------------------------ */
/* Microsoft Graph (lecture seule)                                      */
/* ------------------------------------------------------------------ */

async function graph<T>(pathAndQuery: string): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${GRAPH}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="html"' },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new OutlookError("Outlook a refusé l'accès : reconnecte-toi.", "not-connected");
  if (res.status === 403) throw new OutlookError("Accès refusé par Outlook : la permission Mail.Read n'a pas été accordée.");
  if (res.status === 404) throw new OutlookError("Message introuvable dans le dossier Newsletters.");
  if (!res.ok) throw new OutlookError(`Erreur Outlook (HTTP ${res.status}). Réessaie dans un instant.`);
  return res.json() as Promise<T>;
}

/** Identifiant du dossier configuré : « inbox » (Boîte de réception), sinon recherche par nom (racine, puis sous-dossiers de la Boîte de réception). */
async function folderId(): Promise<string> {
  const name = folderName();
  if (g.__outlookFolder?.name === name) return g.__outlookFolder.id;
  // « inbox » : la Boîte de réception elle-même (boîte dédiée aux newsletters).
  if (name.trim().toLowerCase() === "inbox") {
    const inbox = await graph<{ id: string }>(`/me/mailFolders/inbox?$select=id`);
    g.__outlookFolder = { name, id: inbox.id };
    return inbox.id;
  }
  const filter = encodeURIComponent(`displayName eq '${name.replace(/'/g, "''")}'`);
  type Folders = { value: { id: string; displayName: string }[] };
  let found = (await graph<Folders>(`/me/mailFolders?$filter=${filter}&$select=id,displayName`)).value[0];
  if (!found) found = (await graph<Folders>(`/me/mailFolders/inbox/childFolders?$filter=${filter}&$select=id,displayName`)).value[0];
  if (!found) {
    throw new OutlookError(
      `Aucun dossier « ${name} » trouvé dans ta boîte Outlook. Crée-le (et une règle pour y ranger tes newsletters) : voir le guide.`,
      "folder-missing",
    );
  }
  g.__outlookFolder = { name, id: found.id };
  return found.id;
}

export interface NewsletterSummary {
  id: string;
  subject: string;
  from: string;
  fromAddress: string;
  received: string;
  preview: string;
  webLink: string;
  isRead: boolean;
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  bodyPreview?: string;
  webLink?: string;
  isRead?: boolean;
  parentFolderId?: string;
  body?: { contentType: string; content: string };
}

const summarize = (m: GraphMessage): NewsletterSummary => ({
  id: m.id,
  subject: m.subject?.trim() || "(sans objet)",
  from: m.from?.emailAddress?.name?.trim() || m.from?.emailAddress?.address || "Expéditeur inconnu",
  fromAddress: m.from?.emailAddress?.address ?? "",
  received: m.receivedDateTime,
  preview: (m.bodyPreview ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
  webLink: m.webLink ?? "",
  isRead: m.isRead ?? true,
});

/** Les 50 dernières newsletters (cache mémoire de 3 minutes ; `force` pour rafraîchir). */
export async function listNewsletters(force = false): Promise<NewsletterSummary[]> {
  const fid = await folderId();
  const c = g.__outlookList;
  if (!force && c && c.folderId === fid && Date.now() - c.at < LIST_TTL_MS) return c.items;
  const data = await graph<{ value: GraphMessage[] }>(
    `/me/mailFolders/${encodeURIComponent(fid)}/messages?$select=id,subject,from,receivedDateTime,bodyPreview,webLink,isRead&$orderby=receivedDateTime desc&$top=50`,
  );
  const items = data.value.map(summarize);
  g.__outlookList = { at: Date.now(), folderId: fid, items };
  return items;
}

/** Dernière liste connue sans appel réseau (pour la recherche). */
export const cachedNewsletters = (): NewsletterSummary[] => g.__outlookList?.items ?? [];

export interface Newsletter extends NewsletterSummary {
  html: string;
}

/** Un message du dossier Newsletters, avec son HTML NETTOYÉ. Refuse tout message d'un autre dossier. */
export async function getNewsletter(id: string): Promise<Newsletter> {
  if (!/^[A-Za-z0-9_=+\-/]{10,400}$/.test(id)) throw new OutlookError("Identifiant de message invalide.");
  const fid = await folderId();
  const m = await graph<GraphMessage>(
    `/me/mailFolders/${encodeURIComponent(fid)}/messages/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime,bodyPreview,webLink,isRead,parentFolderId,body`,
  );
  if (m.parentFolderId && m.parentFolderId !== fid) throw new OutlookError("Ce message n'est pas dans le dossier Newsletters.");
  const raw = m.body?.content ?? "";
  const html = m.body?.contentType === "text" ? `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(raw)}</pre>` : sanitizeEmail(raw);
  return { ...summarize(m), html };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Nettoyage du HTML d'un e-mail : supprime scripts, formulaires, iframes, objets, gestionnaires
 * d'événements et liens javascript:. Les styles sont gardés (le rendu se fait dans un cadre isolé
 * sans script, dont la politique de sécurité bloque tout chargement externe sauf images autorisées).
 */
export function sanitizeEmail(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img", "style", "center", "font", "span", "div", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
      "colgroup", "col", "caption", "hr", "br", "u", "s", "sup", "sub", "small", "big", "h1", "h2", "h3", "h4", "h5", "h6",
    ],
    // <style> est nécessaire au rendu des newsletters ; il est sans danger dans le cadre isolé (CSP).
    allowVulnerableTags: true,
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "border", "dir", "class", "id", "title", "role", "lang"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      td: ["colspan", "rowspan", "nowrap", "background"],
      th: ["colspan", "rowspan", "nowrap"],
      table: ["cellpadding", "cellspacing", "background", "role"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
    },
  });
}

