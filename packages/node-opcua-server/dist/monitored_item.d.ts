/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type AddressSpace, SessionContext, type UAVariable } from "node-opcua-address-space";
import type { ISessionContext, UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import { AttributeIds, NodeClass, type QualifiedNameOptions } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { type PreciseClock } from "node-opcua-date-time";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { ObjectRegistry } from "node-opcua-object-registry";
import { type TimestampsToReturn } from "node-opcua-service-read";
import { MonitoredItemModifyResult, MonitoredItemNotification, MonitoringMode, MonitoringParameters } from "node-opcua-service-subscription";
import { StatusCode } from "node-opcua-status-code";
import { EventFieldList, type MonitoringFilter, type ReadValueIdOptions, type SubscriptionDiagnosticsDataType } from "node-opcua-types";
import type { MonitorableNode } from "./monitorable_node.js";
import type { SamplingFunc } from "./sampling_func.js";
import type { MonitoredItemBase } from "./server_subscription.js";
export type QueueItem = MonitoredItemNotification | EventFieldList;
export interface MonitoredItemOptions extends MonitoringParameters {
    monitoringMode: MonitoringMode;
    /**
     * the monitoredItem Id assigned by the server to this monitoredItem.
     */
    monitoredItemId: number;
    itemToMonitor?: ReadValueIdOptions;
    timestampsToReturn?: TimestampsToReturn;
    /**
     * the MinSupportedSampleRate the server advertises: the floor of the revised sampling
     * interval when 0 is requested. Defaults to MonitoredItem.minimumSamplingInterval.
     */
    minSupportedSampleRate?: number;
    filter: ExtensionObject | null;
    /**
     * if discardOldest === true, older items are removed from the queue when queue overflows
     */
    discardOldest: boolean;
    /**
     * the size of the queue.
     */
    queueSize: number;
    /**
     * the monitored item sampling interval ..
     */
    samplingInterval: number;
    /**
     * the client handle
     */
    clientHandle: number;
}
export interface BaseNode2 extends EventEmitter {
    nodeId: NodeId;
    browseName: QualifiedNameOptions;
    nodeClass: NodeClass;
    dataType: NodeId;
    addressSpace: AddressSpace;
    readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue;
}
export interface IServerSession2 {
    sessionContext: ISessionContext;
}
export interface ISubscription {
    readonly id?: number;
    $session?: IServerSession2;
    subscriptionDiagnostics: SubscriptionDiagnosticsDataType;
    getMonitoredItem(monitoredItemId: number): MonitoredItem | null;
    readonly maxWhereClauseParameters?: number;
    readonly maxSelectClauseParameters?: number;
}
/**
 * a server side monitored item
 *
 * - Once created, the MonitoredItem will raised an "samplingEvent" event every "samplingInterval" millisecond
 *   until {{#crossLink "MonitoredItem/terminate:method"}}{{/crossLink}} is called.
 *
 * - It is up to the  event receiver to call {{#crossLink "MonitoredItem/recordValue:method"}}{{/crossLink}}.
 *
 */
export declare class MonitoredItem extends EventEmitter implements MonitoredItemBase {
    #private;
    get node(): MonitorableNode | null;
    set node(_someNode: UAVariable | UAObject | UAMethod | null);
    static registry: ObjectRegistry;
    static minimumSamplingInterval: number;
    static defaultSamplingInterval: number;
    static maximumSamplingInterval: number;
    samplingInterval: number;
    monitoredItemId: number;
    overflow: boolean;
    oldDataValue: DataValue;
    get monitoringMode(): MonitoringMode;
    timestampsToReturn: TimestampsToReturn;
    itemToMonitor: ReadValueIdOptions & {
        attributeId: AttributeIds;
    };
    filter: MonitoringFilter | null;
    discardOldest: boolean;
    queueSize: number;
    clientHandle: UInt32;
    $subscription?: ISubscription;
    _samplingId?: NodeJS.Timeout | string;
    samplingFunc: SamplingFunc | null;
    private _node;
    queue: QueueItem[];
    private _semantic_version;
    private _is_sampling;
    private _onSampled?;
    private _holdSample;
    private _heldSample?;
    private _on_opcua_event_received_callback;
    private _unsubscribeEvents;
    private _attribute_changed_callback;
    private _value_changed_callback;
    private _semantic_changed_callback;
    private _on_node_disposed_listener;
    private _linkedItems?;
    private _triggeredNotifications?;
    private readonly _minSupportedSampleRate;
    /**
     * true when the Value is delivered on change (value_changed listener, no sampling timer):
     * 0 was requested on a Variable whose MinimumSamplingInterval is 0.
     */
    private _exceptionBased;
    /**
     * the coalescing window of an exception-based item: while it is open, further changes are
     * folded into _pendingDataValue and the latest one is recorded when the window ends.
     */
    private _coalesceTimer;
    private _pendingDataValue;
    constructor(options: MonitoredItemOptions);
    setNode(node: MonitorableNode): void;
    setMonitoringMode(monitoringMode: MonitoringMode): StatusCode;
    terminate(): void;
    dispose(): void;
    get isSampling(): boolean;
    /**
     * true when the Value attribute is delivered on change rather than sampled by a timer:
     * the client requested a samplingInterval of 0 on a Variable whose MinimumSamplingInterval
     * is 0. The revised samplingInterval is then the coalescing window (0 = every change).
     */
    get isExceptionBased(): boolean;
    toJSON(): Record<string, string | number | undefined>;
    toString(): string;
    /**
     * @param dataValue       the whole dataValue
     * @param skipChangeTest  indicates whether recordValue should  not check that dataValue is really
     *                                  different from previous one, ( by checking timestamps but also variant value)
     * @private
     *
     * Notes:
     *  - recordValue can only be called within timer event
     *  - for performance reason, dataValue may be a shared value with the underlying node,
     *    therefore recordValue must clone the dataValue to make sure it retains a snapshot
     *    of the contain at the time recordValue was called.
     *
     * return true if the value has been recorded, false if not.
     *
     * Value will not be recorded :
     *   * if the range do not overlap
     *   * is !skipChangeTest and value is equal to previous value
     *
     */
    recordValue(dataValue: DataValue, skipChangeTest?: boolean, indexRange?: NumericRange): boolean;
    /** the items this one triggers (SetTriggering) */
    get linkedItems(): readonly number[];
    hasLinkItem(linkedMonitoredItemId: number): boolean;
    addLinkItem(linkedMonitoredItemId: number): StatusCode;
    removeLinkItem(linkedMonitoredItemId: number): StatusCode;
    /**
     * @private
     */
    private triggerLinkedItems;
    get hasMonitoredItemNotifications(): boolean;
    /**
     * @private
     */
    private trigger;
    extractMonitoredItemNotifications(bForce?: boolean): QueueItem[];
    modify(timestampsToReturn: TimestampsToReturn | null, monitoringParameters: MonitoringParameters | null): MonitoredItemModifyResult;
    resendInitialValue(): Promise<void>;
    private getSessionContext;
    /**
     * @private
     * @param clock the clock read the sampler shares between the items it samples together (read again when omitted)
     * @param hold  keep a value obtained at once for {@link _record_held_sample} instead of recording it: the
     *              sampler stamps the values of its items with one clock read made once they have all answered
     */
    private _on_sampling_timer;
    /**
     * @internal called by the sampler (node_sampler.ts)
     * records the value held by {@link _on_sampling_timer}. A server timestamp that is the shared clock's (`readAt`,
     * recognised by its Date) was stamped for the sampler: it becomes `answeredAt`, read once the items sampled
     * together had all answered, so it is not earlier than a source timestamp taken while they answered. A server
     * timestamp the value came with is left as it is.
     */
    _record_held_sample(readAt: PreciseClock, answeredAt: PreciseClock): void;
    private _stop_sampling;
    private _on_value_changed;
    /**
     * the value_changed listener of an exception-based item.
     *
     * At most one notification per revised samplingInterval: the first change after a quiet
     * period is recorded at once and opens a window; changes inside the window are folded, the
     * latest one being recorded when the window ends - what a sampling server would deliver
     * at that instant. The DataChangeFilter and the queue logic are applied by recordValue as
     * usual. This also bounds the cost of a fast writer, which the queue alone did not.
     */
    private _on_value_changed_exception_based;
    private _on_coalesce_window_end;
    private _record_pending_value;
    /**
     * ends the coalescing window; a folded value is recorded rather than lost, so that
     * a modify() restarting the item, or a disable, sees the latest value in the queue.
     */
    private _close_coalesce_window;
    private _on_semantic_changed;
    /**
     * OPC 10000-9 5.5.7: the SubscriptionId argument of ConditionRefresh "indicat[es] which Client
     * Subscription shall be refreshed"; the bracket is queued "into the Event stream for every
     * Notifier MonitoredItem in the Subscription" and the Retained Conditions replayed in between
     * are the ones that "meet the Subscriptions content filter criteria" - that Subscription's.
     * 5.5.8 narrows both to the single MonitoredItem ConditionRefresh2 names.
     *
     * So a refresh belongs to exactly one Subscription (or one MonitoredItem), and this says
     * whether it is ours. The comparison is by object identity, not by id: the Subscription the
     * call resolved has to be the very object this MonitoredItem belongs to.
     */
    private _is_refresh_addressed_to_me;
    private _on_opcua_event;
    private _getSession;
    private _start_sampling;
    private __acquireInitialValue;
    private __start_sampling;
    private _set_parameters;
    private _setOverflowBit;
    private _enqueue_notification;
    private _makeDataChangeNotification;
    /**
     * @param dataValue {DataValue} the dataValue to enqueue
     * @private
     */
    /**
     * true: the next value recorded is the baseline the following ones are compared against, and
     * no notification. What an item rebuilt in another thread of the server for TransferSubscriptions
     * with sendInitialValues false needs: its first sample tells nothing new to the client.
     */
    silentInitialValue: boolean;
    _enqueue_value(dataValue: DataValue): void;
    private _makeEventFieldList;
    private _enqueue_event;
    private _empty_queue;
    private _clear_timer;
    private _set_timer;
    private _adjust_queue_to_match_new_queue_size;
    private _adjustSampling;
    private _on_node_disposed;
}
//# sourceMappingURL=monitored_item.d.ts.map