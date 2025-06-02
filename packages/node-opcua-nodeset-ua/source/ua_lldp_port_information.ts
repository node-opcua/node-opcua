// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte, UAString } from "node-opcua-basic-types"
import { EnumPortIdSubtype } from "./enum_port_id_subtype"
import { DTLldpManagementAddressTxPort } from "./dt_lldp_management_address_tx_port"
import { UAFolder } from "./ua_folder"
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
export interface UALldpPortInformation extends UAObject, UALldpPortInformation_Base {
}