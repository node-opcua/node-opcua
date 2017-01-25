/**
 * @module opcua.server
 */

import Enum from "lib/misc/enum";

const SubscriptionState = new Enum([
  "CLOSED",   // The Subscription has not yet been created or has terminated.
  "CREATING", // The Subscription is being created
  "NORMAL",   // The Subscription is cyclically checking for Notifications from its MonitoredItems.
  // The keep-alive counter is not used in this state.
  "LATE",     // The publishing timer has expired and there are Notifications available or a keep-alive Message is
  // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
  // request is processed when it is received. The keep-alive counter is not used in this state.
  "KEEPALIVE",// The Subscription is cyclically checking for Notification
  // alive counter to count down to 0 from its maximum.
  "TERMINATED"
]);

export default SubscriptionState;
