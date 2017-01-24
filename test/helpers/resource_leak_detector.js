require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");

var opcua = require("index.js");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
import MonitoredItem from "lib/server/MonitoredItem";
import Subscription from "lib/server/Subscription";
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

    var self = this;
    if (self.clearIntervalCallCount !== this.setIntervalCallCount) {
        errorMessages.push(" setInterval doesn't match number of clearInterval calls : " + this.setIntervalCallCount + " " + this.clearIntervalCallCount);
    }
    if (self.setTimeoutCallPendingCount !== 0) {
        errorMessages.push(" setTimeoutCallPendingCount is not zero: some timer are still pending " + this.setTimeoutCallPendingCount);

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
        var self = this;
        if (trace) {
            console.log(" starting resourceLeakDetector");
        }
        assert(!self.setInterval_old,   " resourceLeakDetector.stop hasn't been called !");
        assert(!self.clearInterval_old, " resourceLeakDetector.stop hasn't been called !");
        assert(!self.setTimeout_old,    " resourceLeakDetector.stop hasn't been called !");
        assert(!self.clearTimeout_old,  " resourceLeakDetector.stop hasn't been called !");

        self.setIntervalCallCount = 0;
        self.clearIntervalCallCount = 0;
        self.setInterval_old = global.setInterval;
        self.clearInterval_old = global.clearInterval;


        self.setTimeout_old = global.setTimeout;
        self.clearTimeout_old = global.clearTimeout;
        self.setTimeoutCallPendingCount =0;



        self.map = {};
        verify_registry_counts.call(self,info);

        if (false) {
            global.setTimeout = function(func,delay) {
                // detect invalid delays
                assert(delay !=  undefined);
                assert(_.isFinite(delay));
                self.setTimeoutCallPendingCount ++;
                self.setTimeout_old(function() {
                    self.setTimeoutCallPendingCount --;
                    func();
                },delay);
            };
        }



        global.setInterval = function (func, delay) {

            assert(delay !=  undefined);
            assert(_.isFinite(delay));

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
        var self = this;

        if (trace) {
            console.log(" stop resourceLeakDetector");
        }
        assert(_.isFunction(self.setInterval_old), " did you forget to call resourceLeakDetector.start() ?");

        global.setInterval = self.setInterval_old;
        self.setInterval_old = null;
        global.clearInterval = self.clearInterval_old;
        self.clearInterval_old = null;

        global.setTimeout = self.setTimeout_old;
        self.setTimeout_old = null;

        global.clearTimeout = self.clearTimeout_old;
        self.clearTimeout_old = null;

        verify_registry_counts.call(self,info);
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


