import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumChassisIdSubtype } from "./enum_chassis_id_subtype";

// ----- this file has been automatically generated - do not edit

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
export interface UALldpLocalSystem extends UAObject, UALldpLocalSystem_Base {}