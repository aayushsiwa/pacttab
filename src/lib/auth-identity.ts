/**
 * Better Auth requires an email for credential accounts. Local PactTab accounts
 * use this non-deliverable value internally; it is never shown, emailed, or used
 * as a group identity.
 */
export function localCredentialEmail(username: string): string {
  return `${username.toLowerCase()}@pacttab.local`;
}
