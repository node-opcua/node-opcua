require("requirish")._(module);
var assert = require("better-assert");

var opcua = require("index.js");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;
var Subscription = require("lib/server/subscription").Subscription;

var colors = require("colors");

// var trace = true;
var trace = false;
function get_stack() {
    var stack = (new Error()).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}
exports.resourceLeakDetector = {

    start: function () {

        if (trace) {
            console.log(" starting resourceLeakDetector");
        }
        assert(!this.setInterval_old, " resourceLeakDetector.stop hasn't been called !");
        this.setIntervalCallCount = 0;
        this.clearIntervalCallCount = 0;
        this.setInterval_old = GLOBAL.setInterval;
        this.clearInterval_old = GLOBAL.clearInterval;

        var self = this;
        GLOBAL.setInterval = function (func, delay) {

            if (trace) {
                console.log("setInterval \n", get_stack().red, "\n");
            }

            assert(delay > 10);
            self.setIntervalCallCount += 1;
            return self.setInterval_old(func, delay);
        };
        GLOBAL.clearInterval = function (id) {
            if (trace) {
                console.log("clearInterval ", get_stack().green);
            }
            self.clearIntervalCallCount += 1;
            return self.clearInterval_old(id);
        };

        this._running_server_count = OPCUAServer.getRunningServerCount();
        assert(this._running_server_count === 0);
        assert(MonitoredItem.getRunningMonitoredItemCount() === 0);
    },
    stop: function () {
        if (trace) {
            console.log(" stop resourceLeakDetector");
        }
        assert(this.setInterval_old !== null);
        GLOBAL.setInterval = this.setInterval_old;
        this.setInterval_old = null;
        GLOBAL.clearInterval = this.clearInterval_old;
        this.clearInterval_old = null;


        var errorMessages = [];
        if (this.clearIntervalCallCount !== this.setIntervalCallCount) {
            errorMessages.push(" setInterval doesn't match number of clearInterval calls : " + this.setIntervalCallCount + " " + this.clearIntervalCallCount);
        }

        if (MonitoredItem.getRunningMonitoredItemCount() !== 0) {
            errorMessages.push(" some MonitoredItem have not been properly terminated: "
                + MonitoredItem.getRunningMonitoredItemCount());
        }

        if (Subscription.getRunningSubscriptionsCount() !== 0) {
            errorMessages.push(" some Subscription have not been properly terminated: "
                + Subscription.getRunningSubscriptionsCount());
        }
        if (OPCUAServer.getRunningServerCount() !== 0) {
            errorMessages.push(" some OPCUAServer have not been properly terminated: "
                + OPCUAServer.getRunningServerCount());
        }
        if (errorMessages.length) {

            console.log(errorMessages.join("\n"));
            throw new Error("LEAKS !!!");
        }
    }
};

