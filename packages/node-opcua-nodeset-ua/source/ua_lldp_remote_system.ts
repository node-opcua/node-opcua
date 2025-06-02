// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { EnumChassisIdSubtype } from "./enum_chassis_id_subtype"
import { EnumPortIdSubtype } from "./enum_port_id_subtype"
import { DTLldpManagementAddress } from "./dt_lldp_management_address"
import { DTLldpTlv } from "./dt_lldp_tlv"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LldpRemoteSystemType i=19033                                |
 * |isAbstract      |false                                                       |
 */
export interface UALldpRemoteSystem_Base {
    timeMark: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteIndex: UABaseDataVariable<UInt32, DataType.UInt32>;
    chassisIdSubtype: UABaseDataVariable<EnumChassisIdSubtype, DataType.Int32>;
    chassisId: UABaseDataVariable<UAString, DataType.String>;
    portIdSubtype: UABaseDataVariable<EnumPortIdSubtype, DataType.Int32>;
    portId: UABaseDataVariable<UAString, DataType.String>;
    portDescription?: UABaseDataVariable<UAString, DataType.String>;
    systemName?: UABaseDataVariable<UAString, DataType.String>;
    systemDescription?: UABaseDataVariable<UAString, DataType.String>;
    systemCapabilitiesSupported?: UABaseDataVariable<UInt32, DataType.UInt32>;
    systemCapabilitiesEnabled?: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteChanges?: UABaseDataVariable<boolean, DataType.Boolean>;
    remoteTooManyNeighbors?: UABaseDataVariable<boolean, DataType.Boolean>;
    managementAddress?: UABaseDataVariable<DTLldpManagementAddress[], DataType.ExtensionObject>;
    remoteUnknownTlv?: UABaseDataVariable<DTLldpTlv[], DataType.ExtensionObject>;
}
export interface UALldpRemoteSystem extends UAObject, UALldpRemoteSystem_Base {
}