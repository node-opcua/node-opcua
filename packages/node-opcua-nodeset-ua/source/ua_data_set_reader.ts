import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTDataSetMeta } from "./dt_data_set_meta.js";
import type { DTEndpointDescription } from "./dt_endpoint_description.js";
import type { DTKeyValuePair } from "./dt_key_value_pair.js";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode.js";
import type { UADataSetReaderMessage } from "./ua_data_set_reader_message.js";
import type { UADataSetReaderTransport } from "./ua_data_set_reader_transport.js";
import type { UAPubSubDiagnosticsDataSetReader } from "./ua_pub_sub_diagnostics_data_set_reader.js";
import type { UAPubSubStatus } from "./ua_pub_sub_status.js";
import type { UASubscribedDataSet } from "./ua_subscribed_data_set.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DataSetReaderType i=15306                                   |
 * |isAbstract      |false                                                       |
 */
export interface UADataSetReader_Base {
    publisherId: UAProperty<any, any>;
    writerGroupId: UAProperty<UInt16, DataType.UInt16>;
    dataSetWriterId: UAProperty<UInt16, DataType.UInt16>;
    dataSetMetaData: UAProperty<DTDataSetMeta, DataType.ExtensionObject>;
    dataSetFieldContentMask: UAProperty<UInt32, DataType.UInt32>;
    messageReceiveTimeout: UAProperty<number, DataType.Double>;
    keyFrameCount: UAProperty<UInt32, DataType.UInt32>;
    headerLayoutUri: UAProperty<UAString, DataType.String>;
    securityMode?: UAProperty<EnumMessageSecurityMode, DataType.Int32>;
    securityGroupId?: UAProperty<UAString, DataType.String>;
    securityKeyServices?: UAProperty<DTEndpointDescription[], DataType.ExtensionObject>;
    dataSetReaderProperties: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
    transportSettings?: UADataSetReaderTransport;
    messageSettings?: UADataSetReaderMessage;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsDataSetReader;
    subscribedDataSet: UASubscribedDataSet;
    createTargetVariables?: UAMethod;
    createDataSetMirror?: UAMethod;
}
export interface UADataSetReader extends UAObject, UADataSetReader_Base {}