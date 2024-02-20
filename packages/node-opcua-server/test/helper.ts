
import { MonitoredItemNotification } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { Subscription } from "../source";

interface M2 {
    simulateMonitoredItemAddingNotification: () => void;
    queue: any[];
}

export function add_mock_monitored_item(subscription: Subscription) {
    // pretend we have a monitored item
    const monitoredItem = {
        queue: <any[]>[],

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
    (monitoredItem as any).__defineGetter__("hasMonitoredItemNotifications", function (this: any) {
        return this.queue.length > 0;
    });

    (subscription as any).monitoredItems[1] = monitoredItem;

    let counter = 1;

    const monitoredItem_ = monitoredItem as any as M2;

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

