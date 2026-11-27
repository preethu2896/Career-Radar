/** Informational date only: a quota reset is not a promise of restored job freshness. */
export function blockedCatalogueMessage(now = new Date()) {
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(reset);
  return `The jobs and companies catalogue is temporarily unavailable. Our data provider’s allowance resets on ${date}. Listings will return after restoration checks.`;
}
