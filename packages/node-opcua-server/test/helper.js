"use strict";

const should = require("should");
const sinon = require("sinon");

const { MonitoredItemNotification } = require("node-opcua-service-subscription");
const { StatusCodes } = require("node-opcua-status-code");

function add_mock_monitored_item(subscription) {
    // pretend we have a monitored item
    const monitoredItem = {
        queue: [],

        extractMonitoredItemNotifications() {
            const tmp = this.queue;
            this.queue = [];
            return tmp;
        },

        terminate() {
        },

        dispose() {

        },
        async resendInitialValues() {
            this.simulateMonitoredItemAddingNotification();
        }
    };
    monitoredItem.__defineGetter__("hasMonitoredItemNotifications", function () {
        return this.queue.length > 0;
    });

    subscription.monitoredItems[1] = monitoredItem;

    let counter = 1;

    monitoredItem.simulateMonitoredItemAddingNotification = function simulateMonitoredItemAddingNotification() {

        monitoredItem.queue.push(new MonitoredItemNotification({
            clientHandle: 1,
            value: {
                statusCode: StatusCodes.Good,
                value: {
                    dataType: "Int32",
                    value: counter++
                }
            }
        }));
    };


    setImmediate(() => {
        // initial value !
        monitoredItem.simulateMonitoredItemAddingNotification();
    });

    return monitoredItem;
}


exports.add_mock_monitored_item = add_mock_monitored_item;