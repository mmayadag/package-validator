/**
 * Emails link to the UI, which asks for confirmation before calling the API,
 * so mail scanners that follow links cannot unsubscribe anyone.
 */
export const unsubscribeUrl = (publicUrl: string, token: string): string =>
  `${publicUrl}/?unsubscribe=${encodeURIComponent(token)}`;
