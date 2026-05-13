import type { UAProperty } from "node-opcua-address-space-base";
import type { UAMachineIdentification, UAMachineIdentification_Base } from "node-opcua-nodeset-machinery/dist/ua_machine_identification";
import type { DataType } from "node-opcua-variant";

import type { DTUserProfile } from "./dt_user_profile";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GlassMachineIdentificationType i=1020                       |
 * |isAbstract      |false                                                       |
 */
export interface UAGlassMachineIdentification_Base extends UAMachineIdentification_Base {
    loggedInProfiles?: UAProperty<DTUserProfile[], DataType.ExtensionObject>;
}
export interface UAGlassMachineIdentification extends UAMachineIdentification, UAGlassMachineIdentification_Base {}