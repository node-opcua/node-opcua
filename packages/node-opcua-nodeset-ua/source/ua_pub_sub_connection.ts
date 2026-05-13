import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { UAConnectionTransport } from "./ua_connection_transport";
import type { UANetworkAddress } from "./ua_network_address";
import type { UAPubSubDiagnosticsConnection } from "./ua_pub_sub_diagnostics_connection";
import type { UAPubSubStatus } from "./ua_pub_sub_status";
import type { UASelectionList } from "./ua_selection_list";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubConnectionType i=14209                                |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubConnection_Base {
    publisherId: UAProperty<any, any>;
    transportProfileUri: UASelectionList<UAString, DataType.String>;
    connectionProperties: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
    address: UANetworkAddress;
    transportSettings?: UAConnectionTransport;
   // PlaceHolder for $WriterGroupName$
   // PlaceHolder for $ReaderGroupName$
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsConnection;
    addWriterGroup?: UAMethod;
    addReaderGroup?: UAMethod;
    removeGroup?: UAMethod;
}
export interface UAPubSubConnection extends UAObject, UAPubSubConnection_Base {}