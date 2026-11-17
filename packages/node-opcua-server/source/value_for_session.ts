/**
 * @module node-opcua-server
 *
 * What a session receives of a value a node gives without a session: the change notifications
 * (value_changed, semantic_changed, the attribute events) carry no session, so before a
 * subscription hands such a value to the session of an item, it asks the OWNER of the node what a
 * Read gives that session. The owner is the node itself for a node object, the store for a compact
 * view, the engine for a stand-in of a node another thread owns. Nothing here reads the fields of
 * the node (rolePermissions, accessRestrictions, namespace): a view or a stand-in carries none.
 */
import type { ISessionContext } from "node-opcua-address-space";
import type { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import type { NumericRange } from "node-opcua-numeric-range";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";

/** how the owner of a Variable answers what a Read of its Value gives a session: one of these */
export interface ValueReadOwner {
    /**
     * the status a Read of the Value gives `context`, at once, without reading the value: Good or the
     * status a Read returns in place of the value. UAVariable (the node itself) and StoreVariableView
     * (the store) answer this.
     */
    readValueStatus?(context: ISessionContext): StatusCode;
    /**
     * the value as the owner reads it for `context`: a stand-in for a node another thread owns
     * (RemoteObjectNode), whose owner answers later.
     */
    readValueForSession?(context: ISessionContext, callback: (err: Error | null, dataValue?: DataValue) => void): void;
    /**
     * true when every value the node emits was already read for the session of the one item it serves
     * (FrontMonitoredNode: its owner, the store, tells it which values every session may read; it reads
     * the others again in the session of its item).
     */
    readonly emitsSessionValues?: boolean;
}

/** the DataValue a session receives in place of a value it may not read, stamped as a Read stamps it */
export function refusedDataValue(status: StatusCode): DataValue {
    const { timestamp, picoseconds } = getCurrentClock();
    return new DataValue({
        statusCode: status,
        sourceTimestamp: timestamp,
        sourcePicoseconds: picoseconds,
        serverTimestamp: timestamp,
        serverPicoseconds: picoseconds
    });
}

/**
 * the status a Read of the Value of `node` gives `context`, when the owner answers at once; undefined
 * when only a read through the owner can tell (see valueForSession).
 *
 * - an in-process context (no session) is always given the value: Good;
 * - a node whose owner cannot answer is refused (BadUserAccessDenied): a value reaches a session only
 *   once the owner of the node has said that a Read gives it.
 */
export function valueReadStatus(node: ValueReadOwner | null | undefined, context: ISessionContext | null): StatusCode | undefined {
    if (!context?.session) {
        return StatusCodes.Good;
    }
    if (!node) {
        return StatusCodes.BadNodeIdUnknown;
    }
    if (typeof node.readValueForSession === "function") {
        return undefined;
    }
    if (typeof node.readValueStatus === "function") {
        return node.readValueStatus(context);
    }
    if (node.emitsSessionValues === true) {
        return StatusCodes.Good;
    }
    return StatusCodes.BadUserAccessDenied;
}

/**
 * hands `deliver` what a Read of the Value of `node` gives `context`, for a value the node gave with no
 * session: the value itself when the session may read it, a stamped refusal in its place when it may not,
 * the value the owner reads for the session when only the owner can tell (then `deliver` is called later,
 * and only if `isLive()` still holds). `value` is a DataValue, or a function that reads it, called only
 * when the value is handed out: a refused session costs no read. `indexRange` (the range a write touched)
 * is passed on to `deliver` with the value, so that a caller needs no closure per change.
 *
 * Synchronous for a node object and a compact view: the change paths of a subscription stay as fast as
 * before, the value is not read again when only the status is needed.
 */
export function valueForSession(
    node: ValueReadOwner | null | undefined,
    context: ISessionContext | null,
    value: DataValue | (() => DataValue),
    indexRange: NumericRange | null | undefined,
    deliver: (dataValue: DataValue, indexRange?: NumericRange | null) => void,
    isLive: () => boolean
): void {
    const status = valueReadStatus(node, context);
    if (status === undefined) {
        // only the owner can tell: it reads the value for this session, which then receives what a Read gives it
        (node as Required<Pick<ValueReadOwner, "readValueForSession">>).readValueForSession(
            context as ISessionContext,
            (err, dataValue) => {
                // the item may have stopped while the owner answered
                if (err || !dataValue || !isLive()) {
                    return;
                }
                deliver(dataValue, indexRange);
            }
        );
        return;
    }
    if (status.value !== StatusCodes.Good.value) {
        deliver(refusedDataValue(status), indexRange);
        return;
    }
    deliver(typeof value === "function" ? value() : value, indexRange);
}

/** a node whose attributes a Read gives in the context of a session */
export interface AttributeReadOwner {
    readAttribute(context: ISessionContext | null, attributeId: AttributeIds, indexRange?: NumericRange | null): DataValue;
}

/**
 * what a Read of a non-Value attribute of `node` gives `context`, for an attribute value the node emitted
 * with no session: read again by the node in the context of the session (the Browse check of its owner);
 * an in-process context keeps the emitted value.
 */
export function attributeForSession(
    node: AttributeReadOwner | null | undefined,
    context: ISessionContext | null,
    attributeId: AttributeIds,
    emitted: DataValue
): DataValue {
    if (!context?.session) {
        return emitted;
    }
    if (!node) {
        return refusedDataValue(StatusCodes.BadNodeIdUnknown);
    }
    return node.readAttribute(context, attributeId);
}
