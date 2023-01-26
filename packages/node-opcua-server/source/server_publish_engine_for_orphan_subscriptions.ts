/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import * as chalk from "chalk";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";

import { ServerSidePublishEngine, ServerSidePublishEngineOptions } from "./server_publish_engine";
import { Subscription } from "./server_subscription";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

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
    constructor(options: ServerSidePublishEngineOptions) {
        super(options);
    }

    public add_subscription(subscription: Subscription): Subscription {
        debugLog(chalk.bgCyan.yellow.bold(" adding live subscription with id="), subscription.id, " to orphan");

        // detach subscription from old seession
        subscription.$session = undefined;
        
        super.add_subscription(subscription);
        // also add an event handler to detected when the subscription has ended
        // so we can automatically remove it from the orphan table
        (subscription as any)._expired_func = function (this: Subscription) {
            debugLog(chalk.bgCyan.yellow(" Removing expired subscription with id="), this.id, " from orphan");
            // make sure all monitored item have been deleted
            // Xx subscription.terminate();
            // xx publish_engine.detach_subscription(subscription);
            // Xx subscription.dispose();
        };
        subscription.once("expired", (subscription as any)._expired_func);
        return subscription;
    }

    public detach_subscription(subscription: Subscription): Subscription {
        // un set the event handler
        super.detach_subscription(subscription);
        subscription.removeListener("expired", (subscription as any)._expired_func);
        (subscription as any)._expired_func = null;
        return subscription;
    }
}
