/**
 * @module node-opcua-server
 *
 * TransferSubscriptions (OPC 10000-4 5.13.7) for a Subscription of this thread: what ServerEngine and
 * the session workers of the front threads do the same way, the ownership check first.
 */
import { TransferResult } from "node-opcua-service-subscription";
import type { ServerSession } from "./server_session.js";
import type { Subscription } from "./server_subscription.js";
import { type ITransferSessionIdentity, type SessionsCompatibleForTransferOptions } from "./sessions_compatible_for_transfer.js";
/** the identity a Subscription belongs to: its Session's, or the one kept when its Session closed without deleting it */
export declare function ownerIdentityOf(subscription: Subscription): ITransferSessionIdentity | undefined;
/**
 * moves `subscription` to `session`, both of this thread: refused (BadUserAccessDenied) unless the
 * destination Session acts for the same user, BadNothingToDo when it already is that Session's
 */
export declare function transferSubscriptionToSession(subscription: Subscription, session: ServerSession, sendInitialValues: boolean, options: SessionsCompatibleForTransferOptions): Promise<TransferResult>;
//# sourceMappingURL=subscription_transfer.d.ts.map