// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UASelectionList } from "./ua_selection_list"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { UANetworkAddress } from "./ua_network_address"
import { UAConnectionTransport } from "./ua_connection_transport"
import { UAPubSubStatus } from "./ua_pub_sub_status"
import { UAPubSubDiagnosticsConnection } from "./ua_pub_sub_diagnostics_connection"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubConnectionType ns=0;i=14209                 |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubConnection_Base {
    publisherId: UAProperty<any, any>;
    transportProfileUri: UASelectionList<UAString, /*z*/DataType.String>;
    connectionProperties: UAProperty<DTKeyValuePair[], /*z*/DataType.ExtensionObject>;
    address: UANetworkAddress;
    transportSettings?: UAConnectionTransport;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsConnection;
    addWriterGroup?: UAMethod;
    addReaderGroup?: UAMethod;
    removeGroup?: UAMethod;
}
export interface UAPubSubConnection extends UAObject, UAPubSubConnection_Base {
}