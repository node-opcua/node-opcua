import type { UAString } from "node-opcua-basic-types";
import type { EnumPubSubConnectionEndpointModeEnum } from "node-opcua-nodeset-fx-data/dist/enum_pub_sub_connection_endpoint_mode_enum.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { UAConnectionEndpoint, UAConnectionEndpoint_Base } from "./ua_connection_endpoint.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubConnectionEndpointType i=1005                         |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubConnectionEndpoint_Base extends UAConnectionEndpoint_Base {
    dataSetReaderPath?: UABaseDataVariable<UAString[], DataType.String>;
    dataSetWriterPath?: UABaseDataVariable<UAString[], DataType.String>;
    mode: UABaseDataVariable<EnumPubSubConnectionEndpointModeEnum, DataType.Int32>;
}
export interface UAPubSubConnectionEndpoint extends UAConnectionEndpoint, UAPubSubConnectionEndpoint_Base {}