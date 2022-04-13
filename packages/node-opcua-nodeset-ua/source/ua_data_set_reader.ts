// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { UADataSetReaderTransport } from "./ua_data_set_reader_transport"
import { UADataSetReaderMessage } from "./ua_data_set_reader_message"
import { UAPubSubStatus } from "./ua_pub_sub_status"
import { UAPubSubDiagnosticsDataSetReader } from "./ua_pub_sub_diagnostics_data_set_reader"
import { UASubscribedDataSet } from "./ua_subscribed_data_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DataSetReaderType ns=0;i=15306                    |
 * |isAbstract      |false                                             |
 */
export interface UADataSetReader_Base {
    publisherId: UAProperty<any, any>;
    writerGroupId: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetWriterId: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetMetaData: UAProperty<DTDataSetMeta, /*z*/DataType.ExtensionObject>;
    dataSetFieldContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    messageReceiveTimeout: UAProperty<number, /*z*/DataType.Double>;
    keyFrameCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    headerLayoutUri: UAProperty<UAString, /*z*/DataType.String>;
    securityMode?: UAProperty<EnumMessageSecurityMode, /*z*/DataType.Int32>;
    securityGroupId?: UAProperty<UAString, /*z*/DataType.String>;
    securityKeyServices?: UAProperty<DTEndpointDescription[], /*z*/DataType.ExtensionObject>;
    dataSetReaderProperties: UAProperty<DTKeyValuePair[], /*z*/DataType.ExtensionObject>;
    transportSettings?: UADataSetReaderTransport;
    messageSettings?: UADataSetReaderMessage;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsDataSetReader;
    subscribedDataSet: UASubscribedDataSet;
    createTargetVariables?: UAMethod;
    createDataSetMirror?: UAMethod;
}
export interface UADataSetReader extends UAObject, UADataSetReader_Base {
}