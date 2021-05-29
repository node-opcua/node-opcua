import { SessionContext, WellKnownRoles } from "node-opcua-address-space";
import { MessageSecurityMode } from "node-opcua-secure-channel";

export function hasExpectedUserAccess(context: SessionContext) {
    if (!context ||
        !context.session ||
        !context.session.userIdentityToken) {
        return false;
    }
    return context.currentUserHasRole(WellKnownRoles.SecurityAdmin);
}

export function hasEncryptedChannel(context: SessionContext) {
    return !!(context.session?.channel?.securityMode === MessageSecurityMode.SignAndEncrypt);
}

