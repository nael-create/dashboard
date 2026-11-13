import { describe, expect, it } from "vitest";
import { credentialsProblem, decideAccess, isAuthorized, isLocalRequest } from "@/lib/remote-access";

const H = (h: Record<string, string>) => new Headers(h);
const basic = (s: string) => `Basic ${Buffer.from(s, "utf8").toString("base64")}`;
const CREDS = "dashboard:un-mot-de-passe-long";

describe("isLocalRequest", () => {
  it("navigateur du Mac : local", () => {
    expect(isLocalRequest(H({ host: "127.0.0.1:3000" }))).toBe(true);
    expect(isLocalRequest(H({ host: "localhost:3000" }))).toBe(true);
    expect(isLocalRequest(H({ host: "[::1]:3000" }))).toBe(true);
  });
  it("en-têtes ajoutés par Next.js lui-même pour le Mac : toujours local", () => {
    expect(isLocalRequest(H({ host: "127.0.0.1:3000", "x-forwarded-for": "::ffff:127.0.0.1", "x-forwarded-host": "127.0.0.1:3000" }))).toBe(true);
    expect(isLocalRequest(H({ host: "localhost:3000", "x-forwarded-for": "::1", "x-forwarded-host": "localhost:3000" }))).toBe(true);
  });
  it("adresse Tailscale : distant", () => {
    expect(isLocalRequest(H({ host: "mon-mac.tail1234.ts.net", "x-forwarded-for": "100.64.0.2" }))).toBe(false);
  });
  it("Host local mais relayé (Host falsifié à travers le relais) : distant", () => {
    expect(isLocalRequest(H({ host: "localhost", "x-forwarded-for": "100.64.0.2" }))).toBe(false);
    expect(isLocalRequest(H({ host: "localhost", "x-forwarded-for": "fd7a:115c:a1e0::2" }))).toBe(false);
    expect(isLocalRequest(H({ host: "localhost", "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "mon-mac.tail1234.ts.net" }))).toBe(false);
    expect(isLocalRequest(H({ host: "127.0.0.1:3000", "tailscale-user-login": "moi@example.com" }))).toBe(false);
  });
  it("Host absent : distant", () => {
    expect(isLocalRequest(H({}))).toBe(false);
  });
});

describe("credentialsProblem", () => {
  it("refuse l'absence, le mauvais format et un mot de passe trop court", () => {
    expect(credentialsProblem(undefined)).toMatch(/aucun mot de passe/);
    expect(credentialsProblem("sansdeuxpoints")).toMatch(/identifiant:mot-de-passe/);
    expect(credentialsProblem(":motdepasselong123")).toMatch(/identifiant:mot-de-passe/);
    expect(credentialsProblem("moi:court")).toMatch(/12 caractères/);
    expect(credentialsProblem(CREDS)).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("accepte les bons identifiants (y compris accents)", () => {
    expect(isAuthorized(basic(CREDS), CREDS)).toBe(true);
    expect(isAuthorized(basic("moi:éléphant-rose-42"), "moi:éléphant-rose-42")).toBe(true);
  });
  it("refuse le reste", () => {
    expect(isAuthorized(null, CREDS)).toBe(false);
    expect(isAuthorized(basic("dashboard:mauvais-mot-de-passe"), CREDS)).toBe(false);
    expect(isAuthorized("Bearer xyz", CREDS)).toBe(false);
    expect(isAuthorized("Basic %%%", CREDS)).toBe(false);
  });
});

describe("decideAccess", () => {
  const remote = { host: "mon-mac.tail1234.ts.net", "x-forwarded-for": "100.64.0.2" };
  it("local : toujours autorisé, même sans mot de passe configuré", () => {
    expect(decideAccess(H({ host: "127.0.0.1:3000" }), undefined)).toEqual({ allow: true });
    expect(decideAccess(H({ host: "127.0.0.1:3000" }), CREDS)).toEqual({ allow: true });
  });
  it("distant sans mot de passe configuré (ou trop faible) : 403", () => {
    expect(decideAccess(H(remote), undefined)).toMatchObject({ allow: false, status: 403 });
    expect(decideAccess(H({ ...remote, authorization: basic("moi:court") }), "moi:court")).toMatchObject({ allow: false, status: 403 });
  });
  it("distant : 401 sans identifiants, autorisé avec", () => {
    expect(decideAccess(H(remote), CREDS)).toMatchObject({ allow: false, status: 401 });
    expect(decideAccess(H({ ...remote, authorization: basic(CREDS) }), CREDS)).toEqual({ allow: true });
  });
});
