/**
 * Emails link to the UI, which asks for confirmation before calling the API,
 * so mail scanners that follow links can neither confirm nor unsubscribe anyone.
 */
export const unsubscribeUrl = (publicUrl: string, token: string): string =>
  `${publicUrl}/?unsubscribe=${encodeURIComponent(token)}`;

export const confirmUrl = (publicUrl: string, token: string): string =>
  `${publicUrl}/?confirm=${encodeURIComponent(token)}`;

/**
 * The RFC 8058 one-click unsubscribe endpoint mail providers POST directly,
 * without a page in between. Caddy already proxies `/v1/*` to the API.
 */
export const oneClickUnsubscribeUrl = (publicUrl: string, token: string): string =>
  `${publicUrl}/v1/subscriptions/${encodeURIComponent(token)}/unsubscribe`;
