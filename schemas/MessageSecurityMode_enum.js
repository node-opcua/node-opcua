import { registerEnumeration } from "lib/misc/factories";

// see part 4 $7.14
const MessageSecurityMode_Schema = {
    name: "MessageSecurityMode",
    enumValues: {
        INVALID: 0, // The MessageSecurityMode is invalid
        NONE: 1, // No security is applied.
        SIGN: 2, // All messages are signed but not encrypted.
        SIGNANDENCRYPT: 3  // All messages are signed and encrypted.
    }
};
export {MessageSecurityMode_Schema};
export const MessageSecurityMode = registerEnumeration(MessageSecurityMode_Schema);
