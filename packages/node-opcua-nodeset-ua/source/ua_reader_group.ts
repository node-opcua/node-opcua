import type { UAMethod } from "node-opcua-address-space-base";

import type { UAPubSubDiagnosticsReaderGroup } from "./ua_pub_sub_diagnostics_reader_group.js";
import type { UAPubSubGroup, UAPubSubGroup_Base } from "./ua_pub_sub_group.js";
import type { UAReaderGroupMessage } from "./ua_reader_group_message.js";
import type { UAReaderGroupTransport } from "./ua_reader_group_transport.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ReaderGroupType i=17999                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAReaderGroup_Base extends UAPubSubGroup_Base {
   // PlaceHolder for $DataSetReaderName$
    diagnostics?: UAPubSubDiagnosticsReaderGroup;
    transportSettings?: UAReaderGroupTransport;
    messageSettings?: UAReaderGroupMessage;
    addDataSetReader?: UAMethod;
    removeDataSetReader?: UAMethod;
}
export interface UAReaderGroup extends UAPubSubGroup, UAReaderGroup_Base {}