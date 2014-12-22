/**
 * @module opcua.server
 * @type {async|exports}
 */

var async = require("async");
var assert = require('better-assert');
var debugLog = require("../misc/utils").make_debugLog(__filename);
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var fs = require("fs");

var util = require("util");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var s = require("../datamodel/structures");
var OPCUASecureObject = require("../misc/opcua_secure_object").OPCUASecureObject;

/**
 * @class OPCUABaseServer
 * @param options
 * @constructor
 */
function OPCUABaseServer(options) {
    var self = this;

    options = options || {};

    EventEmitter.call(this);

    self.endpoints = [];
    self.options = options;


    var folder = path.resolve(__dirname);
    var default_certificate_file =path.join(folder,"../../certificates/cert.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    var default_private_key_file =path.join(folder,"../../certificates/key.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    OPCUASecureObject.call(this,options);

}
util.inherits(OPCUABaseServer, EventEmitter);
OPCUABaseServer.prototype.getPrivateKey = OPCUASecureObject.prototype.getPrivateKey;
OPCUABaseServer.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;

/**
 * start all registered endPoint, in parallel, and call done when all endPoints are listening.
 * @method start
 * @async
 * @param {callback} done
 */
OPCUABaseServer.prototype.start = function(done) {
    assert(_.isFunction(done));
    assert(_.isArray(this.endpoints));

    var tasks = [];
    this.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) { endPoint.start(callback);  });
    });
    async.series(tasks, done);
};


/**
 * shutdown all server endPoints
 * @method shutdown
 * @async
 * @param  {callback} done
 * @param  {Error|null} done.err
 */
OPCUABaseServer.prototype.shutdown = function (done) {

    assert(_.isFunction(done));

    var tasks = [];
    this.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {
            endPoint.shutdown(callback);
        });
    });
    async.parallel(tasks, function(err) {
        done(err);
        debugLog("shutdown completed");
    });
};


///**
// * @method getCertificate256
// * @return {Buffer}
// */
//OPCUABaseServer.prototype.getCertificate256 = function() {
//    return null;
//};
//
///**
// * @method getPrivateKey256
// * @return {Buffer}
// */
//OPCUABaseServer.prototype.getPrivateKey256 = function() {
//    return null;
//};




/**
 * construct a service Fault response
 * @method makeServiceFault
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

OPCUABaseServer.makeServiceFault = makeServiceFault;

OPCUABaseServer.prototype.prepare    = function(message) {

};

OPCUABaseServer.prototype.on_request = function(message,channel) {

    assert(message.request);
    assert(message.requestId);
    var request = message.request;

    // prepare request
    this.prepare(message);

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
            response = makeServiceFault(StatusCodes.BadNotImplemented,[errMessage]);
            channel.send_response("MSG", response, message);
        }

    } catch(err) {
        console.log(err.stack);

        errMessage = "EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request._schema.name;
        console.log(errMessage.red.bold);

        var display_trace_from_this_projet_only = require("../misc/utils").display_trace_from_this_projet_only;
        display_trace_from_this_projet_only(err);

        var additional_messages = [];
        additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ");
        additional_messages.push(err.message);
        if (err.stack) {
            additional_messages.push.apply(additional_messages,err.stack.split("\n"));
        }

        response = makeServiceFault(StatusCodes.BadInternalError,additional_messages);

        channel.send_response("MSG", response, message);

    }

};

OPCUABaseServer.prototype._get_endpoints = function () {

    var endpoints = [];
    this.endpoints.map(function (endPoint) {
        var ep = endPoint.endpointDescriptions();
        endpoints  = endpoints.concat(ep);
    });
    return endpoints;
};


/**
 * @method _on_GetEndpointsRequest
 * @param message
 * @param channel
 * @private
 */
OPCUABaseServer.prototype._on_GetEndpointsRequest = function (message, channel) {

    var server = this;
    var request = message.request;

    assert(request._schema.name === "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});

    response.endpoints = server._get_endpoints();

    channel.send_response("MSG", response, message);

};

exports.OPCUABaseServer = OPCUABaseServer;



