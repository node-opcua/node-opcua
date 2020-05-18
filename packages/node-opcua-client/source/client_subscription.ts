/**
 * @module node-opcua-client
 */

// tslint:disable:unified-signatures
import { EventEmitter } from "events";

import { DiagnosticInfo } from "node-opcua-data-model";
import { ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    MonitoringParametersOptions,
    NotificationMessage
} from "node-opcua-service-subscription";
import { StatusCode } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";

import { ClientMonitoredItem } from "./client_monitored_item";
import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { ClientMonitoredItemGroup } from "./client_monitored_item_group";
import { ClientSession, MonitoredItemData, SubscriptionId } from "./client_session";

export interface ClientSubscriptionOptions {
    requestedPublishingInterval?: number;
    requestedLifetimeCount?: number;
    requestedMaxKeepAliveCount?: number;
    maxNotificationsPerPublish?: number;
    publishingEnabled?: boolean;
    priority?: number;
}

export type ClientHandle = number;

export interface ClientMonitoredItemBaseMap {
    [key: string]: ClientMonitoredItemBase;
}

export interface ClientSubscription extends EventEmitter {

    subscriptionId: SubscriptionId;
    publishingInterval: number;
    lifetimeCount: number;
    maxKeepAliveCount: number;
    maxNotificationsPerPublish: number;
    publishingEnabled: boolean;
    priority: number;
    monitoredItems: ClientMonitoredItemBaseMap;
    timeoutHint: number;

    session: ClientSession;

    /**
     * true is the subscription is fully active
     */
    isActive: boolean;

    /**
     * add a monitor item to the subscription
     *
     * @method monitor
     * @async
     * @param itemToMonitor                        {ReadValueId}
     * @param itemToMonitor.nodeId                 {NodeId}
     * @param itemToMonitor.attributeId            {AttributeId}
     * @param itemToMonitor.indexRange             {null|NumericRange}
     * @param itemToMonitor.dataEncoding
     * @param requestedParameters                  {MonitoringParameters}
     * @param requestedParameters.clientHandle     {IntegerId}
     * @param requestedParameters.samplingInterval {Duration}
     * @param requestedParameters.filter           {ExtensionObject|null} EventFilter/DataChangeFilter
     * @param requestedParameters.queueSize        {Counter}
     * @param requestedParameters.discardOldest    {Boolean}
     * @param timestampsToReturn                   {TimestampsToReturn} //{TimestampsToReturnId}
     * @param  [done]                              {Function} optional done callback
     * @return {ClientMonitoredItem}
     *
     *
     * Monitoring a simple Value Change
     * ---------------------------------
     *
     * @example:
     *
     *   clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.Value,
     *       indexRange: null,
     *       dataEncoding: { namespaceIndex: 0, name: null }
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *        filter: null,
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     * Monitoring a Value Change With a DataChange  Filter
     * ---------------------------------------------------
     *
     * options.trigger       {DataChangeTrigger} {Status|StatusValue|StatusValueTimestamp}
     * options.deadbandType  {DeadbandType}      {None|Absolute|Percent}
     * options.deadbandValue {Double}
     *
     * @example:
     *
     *   clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.Value,
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *        filter: new DataChangeFilter({
     *             trigger: DataChangeTrigger.StatusValue,
     *             deadbandType: DeadbandType.Absolute,
     *             deadbandValue: 0.1
     *        }),
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     *
     * Monitoring an Event
     * -------------------
     *
     *  If the monitor attributeId is EventNotifier then the filter must be specified
     *
     * @example:
     *
     *  var filter =  new EventFilter({
     *    selectClauses: [
     *             { browsePath: [ {name: 'ActiveState'  }, {name: 'id'}  ]},
     *             { browsePath: [ {name: 'ConditionName'}                ]}
     *    ],
     *    whereClause: []
     *  });
     *
     *  clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.EventNotifier,
     *       indexRange: null,
     *       dataEncoding: { namespaceIndex: 0, name: null }
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *
     *        filter: filter,
     *
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     *
     *
     *
     *
     *
     */
    monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): Promise<ClientMonitoredItemBase>;
    monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        done: (err: Error | null, monitoredItem?: ClientMonitoredItemBase) => void
    ): void;
    monitor(...args: any[]): any;

    /**
     * @method monitorItems
     * @param itemsToMonitor
     * @param requestedParameters
     * @param timestampsToReturn
     * @return a ClientMonitoredItemGroup
     * @async
     */
    monitorItems(
        itemsToMonitor: ReadValueIdOptions[],
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): Promise<ClientMonitoredItemGroup>;

    /**
     * @method monitorItems
     * @param itemsToMonitor
     * @param requestedParameters
     * @param timestampsToReturn
     * @param done
     * @async
     */
    monitorItems(
        itemsToMonitor: ReadValueIdOptions[],
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        done: (err: Error | null, monitoredItemGroup?: ClientMonitoredItemGroup) => void
    ): void;
    monitorItems(...args: any[]): any;

    getMonitoredItems(): Promise<MonitoredItemData>;
    getMonitoredItems(callback: (err: Error | null, result?: MonitoredItemData) => void): void;

    terminate(): Promise<void>;
    terminate(callback: ErrorCallback): void;
    terminate(...args: any[]): any;
}

export declare interface ClientSubscription {

    once(event: string | symbol, listener: (...args: any[]) => void): this;

    on(event: string | symbol, listener: (...args: any[]) => void): this;
    /**
     * notify the observers that the subscription has now started
     * @event started
     */
    on(event: "started", eventHandler: (subscriptionId: number) => void): this;

    /**
     * notify the observers tha the client subscription has terminated
     * @event  terminated
     */
    on(event: "terminated", eventHandler: () => void): this;

    /**
     * notify the observers that a new monitored item has been added to the subscription.
     * @event  item_added
     */
    on(event: "item_added", eventHandler: (monitoredItem: ClientMonitoredItem) => void): this;

    /**
     * notify the observers that a keep alive Publish Response has been received from the server.
     * @event keepalive
     */
    on(event: "keepalive", eventHandler: () => void): this;

    /**
     * notify the observers that an error has occurred
     * @event internal_error
     * @param event
     * @param eventHandler
     */
    on(event: "internal_error", eventHandler: (err: Error) => void): this;

    on(event: "raw_notification", eventHandler: (notificationMessage: NotificationMessage) => void): this;

    /**
     * notify the observers that some notifications has been received from the server in  a PublishResponse
     * each modified monitored Item
     * @event  received_notifications
     */
    on(event: "received_notifications", eventHandler: (notificationMessage: NotificationMessage) => void): this;

    /**
     * notify the observers that the server has send a status changed notification (such as BadTimeout )
     * @event status_changed
     */
    on(event: "status_changed", eventHandler: (status: StatusCode, diagnosticInfo: DiagnosticInfo) => void): this;

    on(event: "error", eventHandler: (err: Error) => void): this;
}

export class ClientSubscription {
    public static create(clientSession: ClientSession, options: ClientSubscriptionOptions): ClientSubscription {
        /* istanbul ignore next*/
        throw new Error("Not Implemented");
    }
}
