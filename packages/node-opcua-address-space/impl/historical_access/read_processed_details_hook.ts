/**
 * The supported way to plug a ReadProcessedDetails implementation into an address space.
 *
 * The aggregate functions live in node-opcua-aggregates, and the address space calls into them
 * when a client issues a ReadProcessed history request, so the two packages need a hook between
 * them. It used to be installed by casting the address space to AddressSpacePrivate and
 * assigning to `_readProcessedDetails` from outside, which made an underscore-prefixed field
 * part of another package's build in all but name.
 */
import type { ContinuationData, IAddressSpace, ISessionContext, UAVariable } from "node-opcua-address-space-base";
import type { QualifiedNameLike } from "node-opcua-data-model";
import type { NumericRange } from "node-opcua-numeric-range";
import type { CallbackT } from "node-opcua-status-code";
import type { HistoryReadResult, ReadProcessedDetails } from "node-opcua-types";
import type { AddressSpacePrivate } from "../address_space_private.js";

/** answers a ReadProcessed history request for one variable */
export type ReadProcessedDetailsFunc = (
    variable: UAVariable,
    context: ISessionContext,
    historyReadDetails: ReadProcessedDetails,
    indexRange: NumericRange | null,
    dataEncoding: QualifiedNameLike | null,
    continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
) => void;

/**
 * Install the handler an address space calls for ReadProcessed history requests.
 *
 * Without one, a ReadProcessed request answers BadHistoryOperationUnsupported.
 */
export function installReadProcessedDetails(addressSpace: IAddressSpace, handler: ReadProcessedDetailsFunc): void {
    (addressSpace as AddressSpacePrivate)._readProcessedDetails = handler;
}
