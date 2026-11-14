/**
 * @module node-opcua-server
 *
 * The Server methods about one Subscription of the calling session (OPC 10000-5 9.1):
 * GetMonitoredItems, ResendData, SetSubscriptionDurable. They run where the Subscription is: in
 * the ServerEngine, or in the session worker that hosts it when front threads serve the server.
 */
import type { ISessionContext } from "node-opcua-address-space";
import { type CallbackT } from "node-opcua-status-code";
import type { CallMethodResultOptions } from "node-opcua-types";
import { type Variant } from "node-opcua-variant";
import type { Subscription } from "./server_subscription.js";
/** what these methods need of the thread they run in: a Subscription of another session is not theirs */
export interface SubscriptionFinder {
    findSubscription(subscriptionId: number): Subscription | null;
}
export type SubscriptionMethod = (this: SubscriptionFinder, inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) => void;
export declare function setSubscriptionDurable(this: SubscriptionFinder, inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>): void;
export declare function resendData(this: SubscriptionFinder, inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>): void;
export declare function getMonitoredItemsId(this: SubscriptionFinder, inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>): void;
/** the methods above, by the numeric MethodId of their node in namespace 0 */
export declare const subscriptionMethods: ReadonlyMap<number, SubscriptionMethod>;
//# sourceMappingURL=subscription_methods.d.ts.map