/**
 * @module node-opcua-server
 *
 * The Server methods about one Subscription of the calling session (OPC 10000-5 9.1):
 * GetMonitoredItems, ResendData, SetSubscriptionDurable. They run where the Subscription is: in
 * the ServerEngine, or in the session worker that hosts it when front threads serve the server.
 */
import type { ISessionContext } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import type { UInt32 } from "node-opcua-basic-types";
import { MethodIds } from "node-opcua-constants";
import { CallMethodResult } from "node-opcua-service-call";
import { type CallbackT, type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { CallMethodResultOptions } from "node-opcua-types";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";
import type { ServerSession } from "./server_session.js";
import type { Subscription } from "./server_subscription.js";

/** what these methods need of the thread they run in: a Subscription of another session is not theirs */
export interface SubscriptionFinder {
    findSubscription(subscriptionId: number): Subscription | null;
}

export type SubscriptionMethod = (
    this: SubscriptionFinder,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) => void;

export function setSubscriptionDurable(
    this: SubscriptionFinder,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    // see https://reference.opcfoundation.org/v104/Core/docs/Part5/9.3/
    // https://reference.opcfoundation.org/v104/Core/docs/Part4/6.8/
    assert(typeof callback === "function");

    const data = _getSubscription.call(this, inputArguments, context);
    if (data.statusCode) return callback(null, { statusCode: data.statusCode });
    const { subscription } = data;

    const lifetimeInHours = inputArguments[1].value as UInt32;
    if (subscription.monitoredItemCount > 0) {
        // This is returned when a Subscription already contains MonitoredItems.
        return callback(null, { statusCode: StatusCodes.BadInvalidState });
    }

    /**
     * MonitoredItems are used to monitor Variable Values for data changes and event notifier
     * Objects for new Events. Subscriptions are used to combine data changes and events of
     * the assigned MonitoredItems to an optimized stream of network messages. A reliable
     * delivery is ensured as long as the lifetime of the Subscription and the queues in the
     * MonitoredItems are long enough for a network interruption between OPC UA Client and
     * Server. All queues that ensure reliable delivery are normally kept in memory and a
     * Server restart would delete them.
     * There are use cases where OPC UA Clients have no permanent network connection to the
     * OPC UA Server or where reliable delivery of data changes and events is necessary
     * even if the OPC UA Server is restarted or the network connection is interrupted
     * for a longer time.
     * To ensure this reliable delivery, the OPC UA Server must store collected data and
     * events in non-volatile memory until the OPC UA Client has confirmed reception.
     * It is possible that there will be data lost if the Server is not shut down gracefully
     * or in case of power failure. But the OPC UA Server should store the queues frequently
     * even if the Server is not shut down.
     * The Method SetSubscriptionDurable defined in OPC 10000-5 is used to set a Subscription
     * into this durable mode and to allow much longer lifetimes and queue sizes than for normal
     * Subscriptions. The Method shall be called before the MonitoredItems are created in the
     * durable Subscription. The Server shall verify that the Method is called within the
     * Session context of the Session that owns the Subscription.
     *
     * A value of 0 for the parameter lifetimeInHours requests the highest lifetime supported by the Server.
     */

    const highestLifetimeInHours = 24 * 100;

    const revisedLifetimeInHours =
        lifetimeInHours === 0 ? highestLifetimeInHours : Math.max(1, Math.min(lifetimeInHours, highestLifetimeInHours));

    // also adjust subscription life time
    const currentLifeTimeInHours = (subscription.lifeTimeCount * subscription.publishingInterval) / (1000 * 60 * 60);
    if (currentLifeTimeInHours < revisedLifetimeInHours) {
        const requestedLifetimeCount = Math.ceil((revisedLifetimeInHours * (1000 * 60 * 60)) / subscription.publishingInterval);

        subscription.modify({
            requestedMaxKeepAliveCount: subscription.maxKeepAliveCount,
            requestedPublishingInterval: subscription.publishingInterval,
            maxNotificationsPerPublish: subscription.maxNotificationsPerPublish,
            priority: subscription.priority,
            requestedLifetimeCount
        });
    }

    const callMethodResult = new CallMethodResult({
        statusCode: StatusCodes.Good,
        outputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: revisedLifetimeInHours }]
    });
    callback(null, callMethodResult);
}

function _getSubscription(
    this: SubscriptionFinder,
    inputArguments: Variant[],
    context: ISessionContext
): { subscription: Subscription; statusCode?: never } | { statusCode: StatusCode; subscription?: never } {
    assert(Array.isArray(inputArguments));
    assert(Object.hasOwn(context, "session"), " expecting a session id in the context object");
    const session = context.session as ServerSession;
    if (!session) {
        return { statusCode: StatusCodes.BadInternalError };
    }
    const subscriptionId = inputArguments[0].value;
    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        // subscription may belongs to a different session  that ours
        if (this.findSubscription(subscriptionId)) {
            // if yes, then access to  Subscription data should be denied
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }
        return { statusCode: StatusCodes.BadSubscriptionIdInvalid };
    }
    return { subscription };
}
export function resendData(
    this: SubscriptionFinder,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
): void {
    assert(typeof callback === "function");

    const data = _getSubscription.call(this, inputArguments, context);
    if (data.statusCode) {
        callback(null, { statusCode: data.statusCode });
        return;
    }
    const { subscription } = data;

    subscription
        .resendInitialValues()
        .then(() => {
            callback(null, { statusCode: StatusCodes.Good });
        })
        .catch((err) => callback(err));
}

export function getMonitoredItemsId(
    this: SubscriptionFinder,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    assert(typeof callback === "function");

    const data = _getSubscription.call(this, inputArguments, context);
    if (data.statusCode) return callback(null, { statusCode: data.statusCode });
    const { subscription } = data;

    const result = subscription.getMonitoredItems();
    assert(result.statusCode);
    assert(result.serverHandles.length === result.clientHandles.length);
    const callMethodResult = new CallMethodResult({
        statusCode: result.statusCode,
        outputArguments: [
            { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.serverHandles },
            { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.clientHandles }
        ]
    });
    callback(null, callMethodResult);
}

/** the methods above, by the numeric MethodId of their node in namespace 0 */
export const subscriptionMethods: ReadonlyMap<number, SubscriptionMethod> = new Map<number, SubscriptionMethod>([
    [MethodIds.Server_GetMonitoredItems, getMonitoredItemsId],
    [MethodIds.Server_ResendData, resendData],
    [MethodIds.Server_SetSubscriptionDurable, setSubscriptionDurable]
]);
