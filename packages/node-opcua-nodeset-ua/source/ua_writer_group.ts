// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAPubSubGroup, UAPubSubGroup_Base } from "./ua_pub_sub_group"
import { UAWriterGroupTransport } from "./ua_writer_group_transport"
import { UAWriterGroupMessage } from "./ua_writer_group_message"
import { UAPubSubDiagnosticsWriterGroup } from "./ua_pub_sub_diagnostics_writer_group"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |WriterGroupType ns=0;i=17725                      |
 * |isAbstract      |false                                             |
 */
export interface UAWriterGroup_Base extends UAPubSubGroup_Base {
    writerGroupId: UAProperty<UInt16, /*z*/DataType.UInt16>;
    publishingInterval: UAProperty<number, /*z*/DataType.Double>;
    keepAliveTime: UAProperty<number, /*z*/DataType.Double>;
    priority: UAProperty<Byte, /*z*/DataType.Byte>;
    localeIds: UAProperty<UAString[], /*z*/DataType.String>;
    headerLayoutUri: UAProperty<UAString, /*z*/DataType.String>;
    transportSettings?: UAWriterGroupTransport;
    messageSettings?: UAWriterGroupMessage;
    diagnostics?: UAPubSubDiagnosticsWriterGroup;
    addDataSetWriter?: UAMethod;
    removeDataSetWriter?: UAMethod;
}
export interface UAWriterGroup extends UAPubSubGroup, UAWriterGroup_Base {
}