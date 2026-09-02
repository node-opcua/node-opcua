import type { INamespace } from "node-opcua-address-space-base";
import type { NamespaceToImageOptions, ToNodesetRecordsOptions } from "../impl/nodeset_tools/nodeset_to_records.js";
import type { NodesetRecord } from "./loader/nodeset_record.js";

import type { INamespaceAlarmAndCondition } from "./namespace_alarm_and_condition.js";
import type { INamespaceDataAccess } from "./namespace_data_access.js";
import type { INamespaceMachineState } from "./namespace_machine_state.js";

/** a namespace as a record producer: what the image writer, a loader or a diff consumes */
export interface INamespaceRecordExport {
    /**
     * the header record then one record per node, in the order `toNodeset2XML` writes them, ids in
     * the exported file's own namespace table
     */
    toNodesetRecords(options?: ToNodesetRecordsOptions): Iterable<NodesetRecord>;
    /** the precompiled image of the namespace */
    toNodesetImage(options?: NamespaceToImageOptions): Promise<Uint8Array>;
}

export interface Namespace
    extends INamespace,
        INamespaceAlarmAndCondition,
        INamespaceDataAccess,
        INamespaceMachineState,
        INamespaceRecordExport {}
