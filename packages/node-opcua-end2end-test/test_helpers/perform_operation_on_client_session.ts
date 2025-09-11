import {
    ClientMonitoredItem,
    ClientSession,
    ClientSubscription,
    CreateSubscriptionRequestLike,
    CreateSubscriptionResponse,
    IBasicSessionAsync2,
    OPCUAClient,
    resolveNodeId,
    AttributeIds,
    TimestampsToReturn,
    MonitoringMode,
    ReadValueId,
    ReadValueIdOptions,
    EndpointWithUserIdentity
} from "node-opcua-client";



/**
 * @method perform_operation_on_client_session
 *
 * simple wrapper that operates on a freshly created opcua session.
 * The wrapper:
 *   - connects to the server,
 *   - creates a session
 *   - calls your **callback** method (func) with the session object
 *   - closes the session
 *   - disconnects the client
 *   - finally call the final **callback** (done_func)
 * @param client
 * @param endpointUrl  {String}
 * @param {Function} func
 * @param func.session  {Session} the done callback to call when operation is completed
 * @param func.done  {Function} the done callback to call when operation is completed
 * @param [func.done.err]  {Error} an optional error to pass if the function has failed
 * @param {Function} done_func
 * @param [done_func.err]  {Error} an optional error to pass if the function has failed
 */
export async function perform_operation_on_client_session<T>(
    client: OPCUAClient,
    endpointUrl: string | EndpointWithUserIdentity,
    func: (session: ClientSession) => Promise<T>
): Promise<T> {
    return await client.withSessionAsync(endpointUrl, async (session) => {
        return await func(session);
    });
}

export async function perform_operation_on_subscription_with_parameters<T>(
    client: OPCUAClient,
    endpointUrl: string | EndpointWithUserIdentity,
    subscriptionParameters: CreateSubscriptionRequestLike,
    do_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>
): Promise<T> {

    return await perform_operation_on_client_session<T>(
        client,
        endpointUrl,
        async (session) => {

            const subscription = await session.createSubscription2(subscriptionParameters);
            subscription.on("terminated", function () {
                //
            });
            try {
                return await do_func(session, subscription);
            } finally {
                await subscription.terminate();
            }
        });
}

/**
 * @method perform_operation_on_subscription
 *
 *  simple wrapper that operates on a freshly created subscription.
 *
 *  - connects to the server,and create a session
 *  - create a new subscription with a publish interval of 100 ms
 *  - calls your **callback** method (do_func) with the subscription object
 *  - delete the subscription
 *  - close the session and disconnect from the server
 *  - finally call the final **callback** (done_func)
 *
 * @param client {OPCUAClientBase}
 * @param endpointUrl {String}
 * @param {Function} do_func
 * @param do_func.session  {Session} the done callback to call when operation is completed
 * @param do_func.done  {Function} the done callback to call when operation is completed
 *
 * @param {Function} done_func
 * @param {Error} [done_func.err]
 */
// callback function(session, subscriptionId,done)
export async function perform_operation_on_subscription<T>(
    client: OPCUAClient,
    endpointUrl: string | EndpointWithUserIdentity,
    do_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>
): Promise<T> {
    const subscriptionParameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 6000,
        requestedMaxKeepAliveCount: 100,
        maxNotificationsPerPublish: 4,
        publishingEnabled: true,
        priority: 6
    };
    return await perform_operation_on_subscription_with_parameters<T>(client, endpointUrl, subscriptionParameters, do_func);
}

export async function perform_operation_on_subscription_async<T>(
    client: OPCUAClient,
    endpointUrl: string | EndpointWithUserIdentity,
    inner_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>
) {

    const subscriptionParameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 6000,
        requestedMaxKeepAliveCount: 100,
        maxNotificationsPerPublish: 4,
        publishingEnabled: true,
        priority: 6
    };
    return await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
        return await inner_func(session, subscription);
    });
}

export async function perform_operation_on_raw_subscription(
    client: OPCUAClient,
    endpointUrl: string,
    action: (
        session: ClientSession,
        result: {
            subscriptionId: any
        }) => Promise<void>
) {
    const result = {
        id: null,
        subscriptionId: null as any
    };
    await perform_operation_on_client_session(
        client,
        endpointUrl,
        async (session) => {

            const response: CreateSubscriptionResponse = await (session as any).createSubscription(
                {
                    requestedPublishingInterval: 100, // Duration
                    requestedLifetimeCount: 600, // Counter
                    requestedMaxKeepAliveCount: 200, // Counter
                    maxNotificationsPerPublish: 10, // Counter
                    publishingEnabled: true, // Boolean
                    priority: 14 // Byte
                });
            const doDebug = false;
            if (doDebug) {
                console.log("statusCode = ", response.responseHeader.serviceResult.toString());
                console.log(" Subscription created with id ", response.subscriptionId);
                console.log(" revisedPublishingInterval ", response.revisedPublishingInterval);
                console.log(" revisedLifetimeCount ", response.revisedLifetimeCount);
                console.log(" revisedMaxKeepAliveCount ", response.revisedMaxKeepAliveCount);
            }
            result.subscriptionId = response.subscriptionId;

            try {
                await action(session, result);
            } finally {
                await (session as any).deleteSubscriptions({
                    subscriptionIds: [result.subscriptionId]
                });
            }
        });
}

export async function perform_operation_on_monitoredItem<T>(
    client: OPCUAClient,
    endpointUrl: string,
    monitoredItemId: string | ReadValueIdOptions,
    func: (session: ClientSession, subscription: ClientSubscription, monitoredItem: ClientMonitoredItem) => Promise<T>
): Promise<T> {
    let itemToMonitor;
    if (typeof monitoredItemId === "string") {
        itemToMonitor = {
            nodeId: resolveNodeId(monitoredItemId),
            attributeId: AttributeIds.Value
        };
    } else {
        itemToMonitor = monitoredItemId;
    }
    const r: T = await perform_operation_on_subscription<T>(
        client,
        endpointUrl,
        async (session, subscription) => {
            let monitoredItem = await subscription.monitor(itemToMonitor, {
                samplingInterval: 1000,
                discardOldest: true,
                queueSize: 1
            }, TimestampsToReturn.Both, MonitoringMode.Reporting);

            try {
                return await func(session, subscription, monitoredItem);
            } finally {
                monitoredItem.terminate();
            }
        });
    return r;
}
