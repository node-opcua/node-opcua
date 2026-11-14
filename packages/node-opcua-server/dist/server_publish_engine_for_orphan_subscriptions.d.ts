import { ServerSidePublishEngine } from "./server_publish_engine.js";
import type { Subscription } from "./server_subscription.js";
/**
 * the ServerSidePublishEngineForOrphanSubscription is keeping track of
 * live subscription that have been detached from timed out session.
 * It takes care of providing back those subscription to any session that
 * will claim them again with transferSubscription  service
 * It also make sure that subscription are properly disposed when  they expire.
 *
 * @internal
 */
export declare class ServerSidePublishEngineForOrphanSubscription extends ServerSidePublishEngine {
    add_subscription(subscription: Subscription): Subscription;
    detach_subscription(subscription: Subscription): Subscription;
}
//# sourceMappingURL=server_publish_engine_for_orphan_subscriptions.d.ts.map