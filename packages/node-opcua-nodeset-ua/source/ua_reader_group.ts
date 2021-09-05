// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAPubSubGroup, UAPubSubGroup_Base } from "./ua_pub_sub_group"
import { UAPubSubDiagnosticsReaderGroup } from "./ua_pub_sub_diagnostics_reader_group"
import { UAReaderGroupTransport } from "./ua_reader_group_transport"
import { UAReaderGroupMessage } from "./ua_reader_group_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ReaderGroupType ns=0;i=17999                      |
 * |isAbstract      |false                                             |
 */
export interface UAReaderGroup_Base extends UAPubSubGroup_Base {
    diagnostics?: UAPubSubDiagnosticsReaderGroup;
    transportSettings?: UAReaderGroupTransport;
    messageSettings?: UAReaderGroupMessage;
    addDataSetReader?: UAMethod;
    removeDataSetReader?: UAMethod;
}
export interface UAReaderGroup extends UAPubSubGroup, UAReaderGroup_Base {
}