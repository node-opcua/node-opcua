"use strict";

const should = require("should");
const sinon = require("sinon");

const subscription_service = require("node-opcua-service-subscription");
const SubscriptionState = require("../src/server_subscription").SubscriptionState;
const StatusCodes = require("node-opcua-status-code").StatusCodes;


function add_mock_monitored_item(subscription) {
    // pretend we have a monitored item
    const monitoredItem = {
        queue:[],
        extractMonitoredItemNotifications: function() {
            const tmp = this.queue;
            this.queue = [];
            return tmp;
        },
        terminate: function(){
        },
        dispose: function() {

        }
    };
    monitoredItem.__defineGetter__("hasMonitoredItemNotifications",function() {
        return this.queue.length >0;
    });

    subscription.monitoredItems[1] = monitoredItem;

    let counter =1;

    monitoredItem.simulateMonitoredItemAddingNotification =  function simulateMonitoredItemAddingNotification()  {

        monitoredItem.queue.push(new subscription_service.MonitoredItemNotification({
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
    return monitoredItem;
}







































































































































exports.add_mock_monitored_item = add_mock_monitored_item;