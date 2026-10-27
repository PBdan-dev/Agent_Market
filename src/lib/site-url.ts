// Adresse publique du site, pour les liens donnés aux orchestrateurs (fichiers, fiches, installation).
// Ordre : SITE_URL si réglé ; sinon l'hôte transmis par le proxy (x-forwarded-host) ; sinon l'adresse
// du codespace GitHub (le proxy de Codespaces présente parfois la requête comme venant de localhost) ;
// sinon l'en-tête Host.
const isLocal = (host: string) => /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);

export function siteOrigin(headers: Headers): string {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const forwarded = headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (forwarded && !isLocal(forwarded)) {
    const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    return `${proto}://${forwarded}`;
  }

  const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
  if (CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return `https://${CODESPACE_NAME}-${process.env.PORT || 3000}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }

  const host = headers.get("host") || "localhost:3000";
  return `${isLocal(host) ? "http" : "https"}://${host}`;
}
