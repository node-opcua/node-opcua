import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Byte, UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTLldpManagementAddressTxPort } from "./dt_lldp_management_address_tx_port";
import type { EnumPortIdSubtype } from "./enum_port_id_subtype";
import type { UAFolder } from "./ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LldpPortInformationType i=19009                             |
 * |isAbstract      |false                                                       |
 */
export interface UALldpPortInformation_Base {
    ietfBaseNetworkInterfaceName: UAProperty<UAString, DataType.String>;
    destMacAddress: UAProperty<Byte[], DataType.Byte>;
    portIdSubtype: UAProperty<EnumPortIdSubtype, DataType.Int32>;
    portId: UAProperty<UAString, DataType.String>;
    portDescription?: UAProperty<UAString, DataType.String>;
    managementAddressTxPort?: UAProperty<DTLldpManagementAddressTxPort[], DataType.ExtensionObject>;
    remoteSystemsData?: UAFolder;
}
export interface UALldpPortInformation extends UAObject, UALldpPortInformation_Base {}