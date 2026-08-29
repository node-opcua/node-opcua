/**
 * @module node-opcua-server
 */
import chalk from "chalk";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { ServerSidePublishEngine } from "./server_publish_engine";
import type { Subscription } from "./server_subscription";
import { getTransferSessionIdentity } from "./sessions_compatible_for_transfer";

const debugLog = make_debugLog("server_publish_engine_for_orphan_subscriptions");
const doDebug = checkDebugFlag("server_publish_engine_for_orphan_subscriptions");

interface ISubscriptionWithExpiredFunc {
    _expired_func?: (this: Subscription) => void;
}

/**
 * the ServerSidePublishEngineForOrphanSubscription is keeping track of
 * live subscription that have been detached from timed out session.
 * It takes care of providing back those subscription to any session that
 * will claim them again with transferSubscription  service
 * It also make sure that subscription are properly disposed when  they expire.
 *
 * @internal
 */
export class ServerSidePublishEngineForOrphanSubscription extends ServerSidePublishEngine {
    public add_subscription(subscription: Subscription): Subscription {
        // c8 ignore next
        doDebug && debugLog(chalk.bgCyan.yellow.bold(" adding live subscription with id="), subscription.id, " to orphan");

        // retain the identity of the owning session so that a later TransferSubscriptions request can
        // still be validated against the original owner (OPC UA Part 4 §5.14.7), even though the
        // session itself is about to be detached.
        if (subscription.$session) {
            subscription.$transferSessionIdentity = getTransferSessionIdentity(subscription.$session);
        }

        // detach subscription from old session
        subscription.$session = undefined;

        super.add_subscription(subscription);
        // also add an event handler to detected when the subscription has ended
        // so we can automatically remove it from the orphan table
        const subscriptionEx = subscription as unknown as ISubscriptionWithExpiredFunc;
        subscriptionEx._expired_func = function (this: Subscription) {
            // c8 ignore next
            doDebug && debugLog(chalk.bgCyan.yellow(" Removing expired subscription with id="), this.id, " from orphan");
            // make sure all monitored item have been deleted
            // Xx subscription.terminate();
            // xx publish_engine.detach_subscription(subscription);
            // Xx subscription.dispose();
        };
        subscription.once("expired", subscriptionEx._expired_func);
        return subscription;
    }

    public detach_subscription(subscription: Subscription): Subscription {
        // un set the event handler
        super.detach_subscription(subscription);
        const subscriptionEx = subscription as unknown as ISubscriptionWithExpiredFunc;
        if (subscriptionEx._expired_func) {
            subscription.removeListener("expired", subscriptionEx._expired_func);
        }
        subscriptionEx._expired_func = undefined;
        return subscription;
    }
}
