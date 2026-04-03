import type { PublishResponseOptions } from "node-opcua-types";
import type { Subscription } from "../source";
import type { IServerSidePublishEngine } from "../source/i_server_side_publish_engine";

export function getFakePublishEngine_bad() {
    return {
        pendingPublishRequestCount: 0,
        send_notification_message: () => {
            /**  empty */
        },
        send_keep_alive_response: function () {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this.pendingPublishRequestCount -= 1;
            return true;
        },
        on_close_subscription: (/*subscription*/) => {
            /**  empty */
        },
        cancelPendingPublishRequestBeforeChannelChange: () => {
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
        _send_response(_subscription: Subscription | null, _response?: PublishResponseOptions) {
            if (this.pendingPublishRequestCount <= 0) {
                throw new Error("Invalid send");
            }
            this.pendingPublishRequestCount--;
        },
        send_keep_alive_response(_subscriptionId: number, _get_future_sequence_number: unknown) {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this._send_response(null as unknown as Subscription, null as unknown as PublishResponseOptions);
            return true;
        },
        on_close_subscription(_subscription: Subscription) {
            /**  empty */
        },
        _on_tick() {
            /**  empty */
        }
    };
}
