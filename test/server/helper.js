"use strict";
require("requirish")._(module);
var should = require("should");
var sinon = require("sinon");

var subscription_service = require("lib/services/subscription_service");
var SubscriptionState = require("lib/server/subscription").SubscriptionState;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;


function add_mock_monitored_item(subscription) {
    // pretend we have a monitored item
    var monitoredItem = {
        queue:[],
        extractMonitoredItemNotifications: function() {
            var tmp = this.queue;
            this.queue = [];
            return tmp;
        },
        terminate: function(){
        }
    };
    monitoredItem.__defineGetter__("hasMonitoredItemNotifications",function() {
        return this.queue.length >0;
    });

    subscription.monitoredItems[1] = monitoredItem;

    var counter =1;

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