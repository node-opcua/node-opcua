import { ServerSession } from "./server_session";
import { assert } from "node-opcua-assert";
import { UserIdentityToken, AnonymousIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";

export function sessionsCompatibleForTransfer(sessionSrc: ServerSession, sessionDest: ServerSession): boolean {
  assert(sessionDest);
  assert(sessionSrc);
  if (!sessionSrc.userIdentityToken && !sessionDest.userIdentityToken) {
    return true;
  }
  if (sessionSrc.userIdentityToken instanceof AnonymousIdentityToken) {
    if (!(sessionDest.userIdentityToken instanceof AnonymousIdentityToken)) {
      return false;
    }
    return true;
  } else if (sessionSrc.userIdentityToken instanceof UserNameIdentityToken) {
    if (!(sessionDest.userIdentityToken instanceof UserNameIdentityToken)) {
      return false;
    }
    return sessionSrc.userIdentityToken.userName === sessionDest.userIdentityToken.userName;
  }
  // istanbul ignore else
  else if (sessionSrc.userIdentityToken instanceof X509IdentityToken) {
    if (!(sessionDest.userIdentityToken instanceof X509IdentityToken)) {
      return false;
    }
    return (
      sessionSrc.userIdentityToken.certificateData.toString("hex") === sessionDest.userIdentityToken.certificateData.toString("hex")
    );
  } else {
    throw new Error("Unsupported Identity token");
  }
}
