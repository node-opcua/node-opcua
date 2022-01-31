// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAMachineIdentification, UAMachineIdentification_Base } from "node-opcua-nodeset-machinery/source/ua_machine_identification"
import { DTUserProfile } from "./dt_user_profile"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:GlassMachineIdentificationType ns=13;i=1020    |
 * |isAbstract      |false                                             |
 */
export interface UAGlassMachineIdentification_Base extends UAMachineIdentification_Base {
    loggedInProfiles?: UAProperty<DTUserProfile[], /*z*/DataType.ExtensionObject>;
}
export interface UAGlassMachineIdentification extends UAMachineIdentification, UAGlassMachineIdentification_Base {
}