"use strict";
/**
 * @module opcua.server
 * @type {async|exports}
 */
require("requirish")._(module);
var async = require("async");
var assert = require("better-assert");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var path = require("path");

var util = require("util");

var utils = require("lib/misc/utils");
var constructFilename = utils.constructFilename;

var debugLog = utils.make_debugLog(__filename);

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var s = require("lib/datamodel/structures");
var ApplicationType = s.ApplicationType;

var OPCUASecureObject = require("lib/misc/opcua_secure_object").OPCUASecureObject;

var endpoints_service = require("lib/services/get_endpoints_service");
var GetEndpointsResponse = endpoints_service.GetEndpointsResponse;

var register_server_service = require("lib/services/register_server_service");
var FindServersRequest = register_server_service.FindServersRequest;
var FindServersResponse = register_server_service.FindServersResponse;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

var default_server_info = {

    // The globally unique identifier for the application instance. This URI is used as
    // ServerUri in Services if the application is a Server.
    applicationUri: "urn:NodeOPCUA-Server-default",

    // The globally unique identifier for the product.
    productUri: "NodeOPCUA-Server",

    // A localized descriptive name for the application.
    applicationName: {text: "NodeOPCUA", locale: null},
    applicationType: ApplicationType.SERVER,
    gatewayServerUri: "",
    discoveryProfileUri: "",
    discoveryUrls: []
};

/**
 * @class OPCUABaseServer
 * @param options
 * @param options.certificateFile
 * @param options.privateKeyFile
 * @param [options.serverInfo = null]                   the information used in the end point description
 * @param [options.serverInfo.applicationUri = "urn:NodeOPCUA-SimpleDemoServer"] {String}
 * @param [options.serverInfo.productUri = "SimpleDemoServer"]{String}
 * @param [options.serverInfo.applicationName = {text: "applicationName"}]{LocalizedText}
 * @param [options.serverInfo.gatewayServerUri = null]{String}
 * @param [options.serverInfo.discoveryProfileUri= null]{String}
 * @param [options.serverInfo.discoveryUrls = []]{Array<String>}
 * @constructor
 */
function OPCUABaseServer(options) {

    var self = this;

    options = options || {};

    EventEmitter.call(this);

    self.endpoints = [];
    self.options = options;

    var default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    var default_private_key_file = constructFilename("certificates/server_key_2048.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    OPCUASecureObject.call(this, options);

    this.serverInfo = _.clone(default_server_info);
    this.serverInfo = _.extend(this.serverInfo, options.serverInfo);

    self.serverInfo.applicationName = new LocalizedText(self.serverInfo.applicationName);

    this.serverInfo = new endpoints_service.ApplicationDescription(this.serverInfo);


}

util.inherits(OPCUABaseServer, EventEmitter);
OPCUABaseServer.prototype.getPrivateKey = OPCUASecureObject.prototype.getPrivateKey;
OPCUABaseServer.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;
OPCUABaseServer.prototype.getCertificateChain = OPCUASecureObject.prototype.getCertificateChain;


/**
 * The type of server : SERVER, CLIENTANDSERVER, DISCOVERYSERVER
 * @property serverType
 * @type {ApplicationType}
 */
OPCUABaseServer.prototype.__defineGetter__("serverType", function () {
    return this.serverInfo.applicationType;
});


/**
 * start all registered endPoint, in parallel, and call done when all endPoints are listening.
 * @method start
 * @async
 * @param {callback} done
 */
OPCUABaseServer.prototype.start = function (done) {

    var self = this;
    assert(_.isFunction(done));
    assert(_.isArray(this.endpoints));

    var tasks = [];
    this.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {
 
            endPoint._on_new_channel = function(channel) {
                self.emit("newChannel",channel);
            };
            endPoint.on("newChannel",endPoint._on_new_channel);

            endPoint._on_close_channel = function(channel) {
                self.emit("closeChannel",channel);
            };
            endPoint.on("closeChannel",endPoint._on_close_channel);

            endPoint.start(callback);

        });
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
    var self = this;

    var tasks = [];
    this.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {
            endPoint.shutdown(callback);
            if (endPoint._on_new_channel) {
                assert(_.isFunction(endPoint._on_new_channel));
                endPoint.removeListener("newChannel",  endPoint._on_new_channel);
            }
            if (endPoint._on_close_channel) {
                assert(_.isFunction(endPoint._on_close_channel));
                endPoint.removeListener("closeChannel", endPoint._on_close_channel);
            }
        });
    });
    async.parallel(tasks, function (err) {
        done(err);
        debugLog("shutdown completed");
    });
};

/**
 * construct a service Fault response
 * @method makeServiceFault
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode, messages) {
    var response = new s.ServiceFault();
    response.responseHeader.serviceResult = statusCode;
    //xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    assert(_.isArray(messages));
    assert(typeof messages[0] === "string");

    response.responseHeader.stringTable = messages;
    console.log(" messages ".cyan, messages.join("\n"));
    return response;
}

OPCUABaseServer.makeServiceFault = makeServiceFault;

OPCUABaseServer.prototype.prepare = function (/*message,channel*/) {

};

OPCUABaseServer.prototype.on_request = function (message, channel) {

    assert(message.request);
    assert(message.requestId);
    var request = message.request;


    // install channel._on_response so we can intercept its call and  emit the "response" event.
    if (!channel._on_response) {
        channel._on_response = function (msg, response, inner_message) {
            self.emit("response", response,channel);
        }
    }


    // prepare request
    this.prepare(message, channel);

    var self = this;
    debugLog("--------------------------------------------------------".green.bold, channel.secureChannelId, request._schema.name);
    var errMessage, response;
    self.emit("request", request, channel);

    try {
        // handler must be named _on_ActionRequest()
        var handler = self["_on_" + request._schema.name];
        if (_.isFunction(handler)) {

            var t1 = utils.get_clock_tick();
            handler.apply(self, arguments);
            var t2 = utils.get_clock_tick();
            //xx console.log(request._schema.name," => t2-t1",t2-t1);

        } else {
            errMessage = "UNSUPPORTED REQUEST !! " + request._schema.name;
            console.log(errMessage);
            debugLog(errMessage.red.bold);
            response = makeServiceFault(StatusCodes.BadNotImplemented, [errMessage]);
            channel.send_response("MSG", response, message);
        }

    } catch (err) {

        /* istanbul ignore if */
        if (err) {
            errMessage = "EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request._schema.name;
            console.log(errMessage.red.bold);

            console.log(request.toString());

            var display_trace_from_this_projet_only = utils.display_trace_from_this_projet_only;
            display_trace_from_this_projet_only(err);

            var additional_messages = [];
            additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request._schema.name);
            additional_messages.push(err.message);
            if (err.stack) {
                additional_messages = additional_messages.concat(err.stack.split("\n"));
            }

            response = makeServiceFault(StatusCodes.BadInternalError, additional_messages);

            channel.send_response("MSG", response, message);
        }

    }

};

OPCUABaseServer.prototype._get_endpoints = function () {

    var endpoints = [];
    this.endpoints.map(function (endPoint) {
        var ep = endPoint.endpointDescriptions();
        endpoints = endpoints.concat(ep);
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

    var response = new GetEndpointsResponse({});


    response.endpoints = server._get_endpoints();

    // apply filters

    if (request.profileUris && request.profileUris.length > 0) {
        response.endpoints = response.endpoints.filter(function (endpoint) {
            return request.profileUris.indexOf(endpoint.transportProfileUri) >= 0;
        });
    }

    // adjust locale on ApplicationName to match requested local or provide 
    // a string with neutral locale (locale == null)
    // TODO: find a better way to handle this
    response.endpoints.forEach(function (endpoint) {
        endpoint.server.applicationName.locale = null;
    });

    channel.send_response("MSG", response, message);

};


OPCUABaseServer.prototype.getDiscoveryUrls = function () {
    var discoveryUrls = this.endpoints.map(function (e) {
        return e._endpoints[0].endpointUrl;
    });
    return discoveryUrls;
    // alternative : return _.uniq(this._get_endpoints().map(function(e){ return e.endpointUrl; }));

};

OPCUABaseServer.prototype.getServers = function (channel) {
    var server = this;
    server.serverInfo.discoveryUrls = server.getDiscoveryUrls(channel);
    var servers = [server.serverInfo];
    return servers;
};


/**
 * @method _on_FindServersRequest
 * @param message
 * @param channel
 * @private
 */
OPCUABaseServer.prototype._on_FindServersRequest = function (message, channel) {

    var server = this;
    // Release 1.02  13  OPC Unified Architecture, Part 4 :
    //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
    //   attacks. A  Server  should minimize the amount of processing required to send the response for this
    //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
    //   short delay before starting processing of a request during high traffic conditions.

    var shortDelay = 2;
    setTimeout(function () {

        var request = message.request;
        assert(request._schema.name === "FindServersRequest");
        assert(request instanceof FindServersRequest);

        var servers = server.getServers(channel);

        // apply filters
        // TODO /
        if (request.serverUris && request.serverUris.length > 0) {
            // A serverUri matches the applicationUri from the ApplicationDescription define
            servers = servers.filter(function (applicationDecription) {
                return request.serverUris.indexOf(applicationDecription.applicationUri) >= 0;
            });
        }

        var response = new FindServersResponse({
            servers: servers
        });
        channel.send_response("MSG", response, message);

    }, shortDelay);
};


/**
 * returns a array of currently active channels
 * @method getChannels
 * @return {Array<ServerSecureChannelLayer>}
 */
OPCUABaseServer.prototype.getChannels = function () {
    var channels = [];
    this.endpoints.map(function (endpoint) {
        var c = _.values(endpoint._channels);
        channels = channels.concat(c);
    });
    return channels;
};


/**
 * set all the end point into a state where they do not accept further connections
 * @note this method is useful for testing purpose
 *
 * @method suspendEndPoints
 * @param callback {Function}
 */
OPCUABaseServer.prototype.suspendEndPoints = function(callback) {

    var self = this;
    async.forEach(self.endpoints, function (ep, _inner_callback) {
        ep.suspendConnection(_inner_callback);
    }, function () {
        callback();
    });
};
/**
 * set all the end point into a state where they do accept connections
 * @note this method is useful for testing purpose
 * @method resumeEndPoints
 * @param callback {Function}
 */
OPCUABaseServer.prototype.resumeEndPoints = function(callback) {
    var self = this;
    async.forEach(self.endpoints,function(ep,_inner_callback){
        ep.restoreConnection(_inner_callback);
    },callback);
};

exports.OPCUABaseServer = OPCUABaseServer;



