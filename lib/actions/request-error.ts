import { unstable_isUnrecognizedActionError } from "next/navigation";

// What to tell the user when calling a server action throws instead of
// returning a result. Usually the internet dropped. After a new version of
// the POS is deployed, a page that was already open calls actions the server
// no longer knows; only a refresh fixes that, so say so.

export const OFFLINE_MESSAGE = "Could not reach the server. Check the internet connection and try again.";
export const REFRESH_MESSAGE = "The POS was updated. Refresh the page (press F5) and try again.";

export function requestErrorMessage(error: unknown, offlineMessage: string = OFFLINE_MESSAGE): string {
  return unstable_isUnrecognizedActionError(error) ? REFRESH_MESSAGE : offlineMessage;
}
