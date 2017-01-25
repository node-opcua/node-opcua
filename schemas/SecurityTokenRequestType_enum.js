import { registerEnumeration } from "lib/misc/factories";

const EnumSecurityTokenRequestType_Schema = {
    name: "SecurityTokenRequestType",
    enumValues: {
        ISSUE: 0, //  creates a new SecurityToken for a new ClientSecureChannelLayer
        RENEW: 1  //  creates a new SecurityToken for an existing ClientSecureChannelLayer .
    }
};
export const SecurityTokenRequestType = registerEnumeration(EnumSecurityTokenRequestType_Schema);