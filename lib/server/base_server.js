
var async = require("async");
var assert = require('better-assert');
var debugLog = require("../utils").make_debugLog(__filename);
var _ = require("underscore");
var EventEmmitter = require("events").EventEmitter;
var util = require("util");

function OPCUABaseServer(options) {
    var self = this;
    self.endpoints = [];
    self.options = options;

}
util.inherits(OPCUABaseServer,EventEmmitter);

/**
 * start all registered endpoint, in parallel, and call done when all endpoints are listening
 * @param {callback} done
 */
OPCUABaseServer.prototype.start = function(done) {
    assert(_.isFunction(done));
    assert(_.isArray(this.endpoints));

    var tasks = [];
    this.endpoints.forEach(function (endpoint) {
        tasks.push(function (callback) { endpoint.start(callback);  });
    });
    async.series(tasks, done);
};


/**
 * shutdown all server endpoints
 * @param  {callback} done
 */
OPCUABaseServer.prototype.shutdown = function(done) {

    assert(_.isFunction(done));

    var tasks = [];
    this.endpoints.forEach(function (endpoint) {
        tasks.push(function (callback) {
            debugLog(" shutting down endpoint " + endpoint.endpointDescription().endpointUrl);
            endpoint.shutdown(callback);
        });
    });
    async.parallel(tasks, function(err) {
        done(err);
        debugLog("shutdown completed");
    });
};
exports.OPCUABaseServer = OPCUABaseServer;



