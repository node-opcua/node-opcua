import type { UAMethod } from "node-opcua-address-space-base";

import type { UAOpticalReaderDevice, UAOpticalReaderDevice_Base } from "./ua_optical_reader_device";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OpticalVerifierDeviceType i=1011                            |
 * |isAbstract      |false                                                       |
 */
export interface UAOpticalVerifierDevice_Base extends UAOpticalReaderDevice_Base {
    scan?: UAMethod;
}
export interface UAOpticalVerifierDevice extends Omit<UAOpticalReaderDevice, "scan">, UAOpticalVerifierDevice_Base {}