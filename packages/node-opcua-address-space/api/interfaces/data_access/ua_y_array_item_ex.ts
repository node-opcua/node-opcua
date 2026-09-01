/**
 * @module node-opcua-address-space
 */
import type { UAVariableT } from "node-opcua-address-space-base";
import type { UAYArrayItem_Base } from "node-opcua-nodeset-ua";
import type { DataType } from "node-opcua-variant";

export interface UAYArrayItemEx<DT extends DataType.Double | DataType.Float>
    extends UAVariableT<number[], DT>,
        UAYArrayItem_Base<number[], DT> {
    // --- helpers ---
}
