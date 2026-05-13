import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { Byte, UAString, UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAPubSubDiagnosticsWriterGroup } from "./ua_pub_sub_diagnostics_writer_group";
import type { UAPubSubGroup, UAPubSubGroup_Base } from "./ua_pub_sub_group";
import type { UAWriterGroupMessage } from "./ua_writer_group_message";
import type { UAWriterGroupTransport } from "./ua_writer_group_transport";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WriterGroupType i=17725                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAWriterGroup_Base extends UAPubSubGroup_Base {
    writerGroupId: UAProperty<UInt16, DataType.UInt16>;
    publishingInterval: UAProperty<number, DataType.Double>;
    keepAliveTime: UAProperty<number, DataType.Double>;
    priority: UAProperty<Byte, DataType.Byte>;
    localeIds: UAProperty<UAString[], DataType.String>;
    headerLayoutUri: UAProperty<UAString, DataType.String>;
    transportSettings?: UAWriterGroupTransport;
    messageSettings?: UAWriterGroupMessage;
   // PlaceHolder for $DataSetWriterName$
    diagnostics?: UAPubSubDiagnosticsWriterGroup;
    addDataSetWriter?: UAMethod;
    removeDataSetWriter?: UAMethod;
}
export interface UAWriterGroup extends UAPubSubGroup, UAWriterGroup_Base {}