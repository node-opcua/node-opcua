// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { EnumChassisIdSubtype } from "./enum_chassis_id_subtype"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LldpLocalSystemType i=19002                                 |
 * |isAbstract      |false                                                       |
 */
export interface UALldpLocalSystem_Base {
    chassisIdSubtype: UAProperty<EnumChassisIdSubtype, DataType.Int32>;
    chassisId: UAProperty<UAString, DataType.String>;
    systemName: UAProperty<UAString, DataType.String>;
    systemDescription: UAProperty<UAString, DataType.String>;
    systemCapabilitiesSupported?: UAProperty<UInt32, DataType.UInt32>;
    systemCapabilitiesEnabled?: UAProperty<UInt32, DataType.UInt32>;
}
export interface UALldpLocalSystem extends UAObject, UALldpLocalSystem_Base {
}