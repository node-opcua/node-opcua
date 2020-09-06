function getFakePublishEngine_bad() {
    return {
        pendingPublishRequestCount: 0,
        send_notification_message: function() {
        },
        send_keep_alive_response: function() {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this.pendingPublishRequestCount -= 1;
            return true;
        },
        on_close_subscription: function(/*subscription*/) {

        },
        cancelPendingPublishRequestBeforeChannelChange: function() {

        }

    };
}
function getFakePublishEngine() {
    return {
        pendingPublishRequestCount: 0,
        _send_response(subscription, response) {
            if (this.pendingPublishRequestCount <= 0) {
                throw new Error("Invalid send");
            }
            this.pendingPublishRequestCount--;
        },
        send_keep_alive_response(subscriptionId, _get_future_sequence_number) {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this._send_response(null,)
            return true;
        },
        on_close_subscription(subscription) { },
        _on_tick() { }
    };

}
module.exports = { getFakePublishEngine };

