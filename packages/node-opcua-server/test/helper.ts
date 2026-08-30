import { MonitoredItemNotification } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import type { MonitoredItem, Subscription } from "../source/index.js";

interface M2 {
    simulateMonitoredItemAddingNotification: () => void;
    queue: unknown[];
}

interface ISubscriptionWithMonitoredItems {
    monitoredItems: Map<number, MonitoredItem>;
}

interface IWithDefineGetter {
    __defineGetter__(name: string, getter: (this: { queue: unknown[] }) => unknown): void;
}

export function add_mock_monitored_item(subscription: Subscription) {
    // pretend we have a monitored item
    const monitoredItem = {
        queue: <unknown[]>[],

        extractMonitoredItemNotifications() {
            const tmp = this.queue;
            this.queue = [];
            return tmp;
        },

        terminate() {
            /**  empty */
        },

        dispose() {
            /**  empty */
        },
        async resendInitialValue() {
            this.simulateMonitoredItemAddingNotification();
        },
        simulateMonitoredItemAddingNotification() {}
    };
    // as unknown as: __defineGetter__ comes from Object.prototype but is absent from the object literal's type
    (monitoredItem as unknown as IWithDefineGetter).__defineGetter__(
        "hasMonitoredItemNotifications",
        function (this: { queue: unknown[] }) {
            return this.queue.length > 0;
        }
    );

    (subscription as unknown as ISubscriptionWithMonitoredItems).monitoredItems.set(1, monitoredItem as unknown as MonitoredItem);

    let counter = 1;

    const monitoredItem_ = monitoredItem as unknown as M2;

    monitoredItem_.simulateMonitoredItemAddingNotification = function simulateMonitoredItemAddingNotification() {
        monitoredItem_.queue.push(
            new MonitoredItemNotification({
                clientHandle: 1,
                value: {
                    statusCode: StatusCodes.Good,
                    value: {
                        dataType: "Int32",
                        value: counter++
                    }
                }
            })
        );
    };

    setImmediate(() => {
        // initial value !
        monitoredItem_.simulateMonitoredItemAddingNotification();
    });

    return monitoredItem;
}
