import { type ClientMonitoredItem, type ClientSession, type ClientSubscription, type CreateSubscriptionRequestLike, type EndpointWithUserIdentity, type OPCUAClient, type ReadValueIdOptions, type SubscriptionId } from "node-opcua-client";
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
export declare function perform_operation_on_client_session<T>(client: OPCUAClient, endpointUrl: string | EndpointWithUserIdentity, func: (session: ClientSession) => Promise<T>): Promise<T>;
export declare function perform_operation_on_subscription_with_parameters<T>(client: OPCUAClient, endpointUrl: string | EndpointWithUserIdentity, subscriptionParameters: CreateSubscriptionRequestLike, do_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>): Promise<T>;
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
export declare function perform_operation_on_subscription<T>(client: OPCUAClient, endpointUrl: string | EndpointWithUserIdentity, do_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>): Promise<T>;
export declare function perform_operation_on_subscription_async<T>(client: OPCUAClient, endpointUrl: string | EndpointWithUserIdentity, inner_func: (session: ClientSession, subscription: ClientSubscription) => Promise<T>): Promise<T>;
export declare function perform_operation_on_raw_subscription(client: OPCUAClient, endpointUrl: string, action: (session: ClientSession, result: {
    subscriptionId: SubscriptionId;
}) => Promise<void>): Promise<void>;
export declare function perform_operation_on_monitoredItem<T>(client: OPCUAClient, endpointUrl: string, monitoredItemId: string | ReadValueIdOptions, func: (session: ClientSession, subscription: ClientSubscription, monitoredItem: ClientMonitoredItem) => Promise<T>): Promise<T>;
//# sourceMappingURL=perform_operation_on_client_session.d.ts.map