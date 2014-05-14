/**
 * @module opcua.server
 * @type {async|exports}
 */

var async = require("async");
var assert = require('better-assert');
var debugLog = require("../misc/utils").make_debugLog(__filename);
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var s = require("../datamodel/structures");
/**
 * @class OPCUABaseServer
 * @param options
 * @constructor
 */
function OPCUABaseServer(options) {
    var self = this;
    self.endpoints = [];
    self.options = options;

}
util.inherits(OPCUABaseServer,EventEmitter);

/**
 * start all registered endpoint, in parallel, and call done when all endpoints are listening.
 * @method start
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
 * @method shutdown
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




/**
 *  construct a service Fault response
 *
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode,messages) {
    var response = new s.ServiceFault();
    response.responseHeader.serviceResult =statusCode;

    //xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    response.responseHeader.stringTable.push.apply(response.responseHeader.stringTable,messages);
    return response;
}


OPCUABaseServer.prototype.on_request = function(message,channel) {

    assert(message.request);
    assert(message.requestId);
    var request = message.request;

    var self = this;
    debugLog("--------------------------------------------------------".green.bold, request._schema.name);
    var errMessage,response;
    self.emit("request",request);
    try {
        // handler must be named _on_ActionRequest()
        var handler = self["_on_"+request._schema.name];
        if (_.isFunction(handler)){
            handler.apply(self,arguments);
        } else {
            errMessage = "UNSUPPORTED REQUEST !! " + request._schema.name;
            console.log(errMessage);
            debugLog(errMessage.red.bold);
            response = makeServiceFault(StatusCodes.Bad_NotImplemented,[errMessage]);
            channel.send_response("MSG", response, message);
        }

    } catch(err) {

        errMessage = "EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request._schema.name;
        debugLog(errMessage.red.bold);
        //xx endpoint._abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported, errMessage, channel);

        var additional_messages = [];
        additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ");
        additional_messages.push(err.message);
        if (err.stack) {
            additional_messages.push.apply(additional_messages,err.stack.split("\n"));
        }

        response = makeServiceFault(StatusCodes.Bad_InternalError,additional_messages);

        channel.send_response("MSG", response, message);

    }

};
exports.OPCUABaseServer = OPCUABaseServer;



