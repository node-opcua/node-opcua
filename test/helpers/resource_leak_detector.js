require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");

var opcua = require("index.js");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;
var Subscription = require("lib/server/subscription").Subscription;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;

var colors = require("colors");

// var trace = true;
var trace = false;
var doDebug = false;

function get_stack() {
    var stack = (new Error()).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}

function verify_registry_counts(info) {

    var errorMessages = [];

    if (this.clearIntervalCallCount !== this.setIntervalCallCount) {
        errorMessages.push(" setInterval doesn't match number of clearInterval calls : " + this.setIntervalCallCount + " " + this.clearIntervalCallCount);
    }

    if (AddressSpace.registry.count() !== 0) {
        errorMessages.push(" some AddressSpace have not been properly terminated: "
            + AddressSpace.registry.toString());
    }
    if (MonitoredItem.registry.count() !== 0) {
        errorMessages.push(" some MonitoredItems have not been properly terminated: "
            + MonitoredItem.registry.toString());
    }
    if (Subscription.registry.count() !== 0) {
        errorMessages.push(" some Subscription have not been properly terminated: "
            + Subscription.registry.toString());

    }
    if (OPCUAServer.registry.count() !== 0) {
        errorMessages.push(" some OPCUAServer have not been properly terminated: "
            + OPCUAServer.registry.toString());
    }
    //xx if (OPCUAClient.registry.count() !== 0) {
    //xx     errorMessages.push(" some OPCUAClient have not been properly terminated: "
    //xx        + OPCUAClient.registry.toString());
    //xx }

    if (errorMessages.length) {

        if (info) {
            console.log(" TRACE : ", info);
        }
        console.log(errorMessages.join("\n"));
        console.log("----------------------------------------------- more info");
        // console.log(this.map);
        _.forEach(this.map,function(value,key){
            console.log("key =",key);
            console.log(value.stack);//.split("\n"));
        });
        throw new Error("LEAKS !!!" + errorMessages.join("\n"));
    }


}
exports.resourceLeakDetector = {

    start: function (info) {

        // perform some sanity check first
        verify_registry_counts.call(this,info);

        if (trace) {
            console.log(" starting resourceLeakDetector");
        }
        assert(!this.setInterval_old, " resourceLeakDetector.stop hasn't been called !");
        this.setIntervalCallCount = 0;
        this.clearIntervalCallCount = 0;
        this.setInterval_old = global.setInterval;
        this.clearInterval_old = global.clearInterval;
        this.map = {};

        var self = this;
        global.setInterval = function (func, delay) {

            if (trace) {
                console.log("setInterval \n", get_stack().red, "\n");
            }
            self.setIntervalCallCount += 1;

            if (delay <= 10) {
                throw new Error("GLOLBA#setInterval called with a delay = " + delay.toString());
            }

            var key = self.setIntervalCallCount;
            var intervalId = self.setInterval_old(func, delay);
            self.map[key] = {
                intervalId: intervalId,
                stack: get_stack()
            };
            return key;
        };

        global.clearInterval = function (id) {

            if (trace) {
                console.log("clearInterval ", get_stack().green);
            }
            var key = id;
            assert(self.map.hasOwnProperty(key));
            id = self.map[key].intervalId;

            self.clearIntervalCallCount += 1;
            return self.clearInterval_old(id);
        };

        this._running_server_count = OPCUAServer.registry.count();
        assert(this._running_server_count === 0);
        assert(MonitoredItem.registry.count() === 0);
    },

    stop: function (info) {

        if (trace) {
            console.log(" stop resourceLeakDetector");
        }
        assert(_.isFunction(this.setInterval_old), " did you forget to call resourceLeakDetector.start() ?");

        global.setInterval = this.setInterval_old;
        this.setInterval_old = null;
        global.clearInterval = this.clearInterval_old;
        this.clearInterval_old = null;

        verify_registry_counts.call(this,info);
    }
};

exports.installResourceLeakDetector = function (isGlobal, func) {

    var trace = require("lib/misc/utils").trace_from_this_projet_only(new Error());
    if (isGlobal) {
        before(function () {
            exports.resourceLeakDetector.start();
        });
        if (func) {
            func();
        }
        after(function () {
            exports.resourceLeakDetector.stop();
        });

    } else {
        beforeEach(function () {
            exports.resourceLeakDetector.start();
        });
        afterEach(function () {
            exports.resourceLeakDetector.stop(trace);
        });
    }
};


