/**
 * @module node-opcua-role-set-client
 *
 * Client-side helper to detect whether the current Session must change its
 * password (OPC 10000-18 §5.2.8).
 *
 * The server returns `Good_PasswordChangeRequired` from ActivateSession and the
 * client records it on the session; this reads that outcome — so a Client can
 * react **without any access to the server or its userManager**.
 */
import { StatusCodes } from "node-opcua-status-code";

/** The subset of a session exposing the last ActivateSession StatusCode. */
export interface ISessionWithActivationStatus {
    lastActivateSessionStatusCode?: { value: number };
}

/**
 * Returns `true` when the last ActivateSession reported
 * `Good_PasswordChangeRequired`, i.e. the user must call ChangePassword before
 * the configured Roles are granted.
 */
export function sessionRequiresPasswordChange(session: ISessionWithActivationStatus): boolean {
    return session.lastActivateSessionStatusCode?.value === StatusCodes.GoodPasswordChangeRequired.value;
}
