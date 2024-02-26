import { PublishResponse, PublishResponseOptions } from "node-opcua-types";
import { Subscription } from "../source";
import { IServerSidePublishEngine } from "../source/i_server_side_publish_engine";

export function getFakePublishEngine_bad() {
    return {
        pendingPublishRequestCount: 0,
        send_notification_message: function () {
            /**  empty */
        },
        send_keep_alive_response: function () {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this.pendingPublishRequestCount -= 1;
            return true;
        },
        on_close_subscription: function (/*subscription*/) {
            /**  empty */
        },
        cancelPendingPublishRequestBeforeChannelChange: function () {
            /**  empty */
        }
    };
}

export interface IServerSidePublishEngine2 extends IServerSidePublishEngine {
    pendingPublishRequestCount: number;
}
export function getFakePublishEngine(): IServerSidePublishEngine2 {
    return {
        pendingPublishRequestCount: 0,
        _send_response(subscription: Subscription | null, response?: PublishResponseOptions) {
            if (this.pendingPublishRequestCount <= 0) {
                throw new Error("Invalid send");
            }
            this.pendingPublishRequestCount--;
        },
        send_keep_alive_response(subscriptionId: number, _get_future_sequence_number: any) {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this._send_response(null as any as Subscription, null as any);
            return true;
        },
        on_close_subscription(subscription: Subscription) {
            /**  empty */
        },
        _on_tick() {
            /**  empty */
        }
    };
}
