"use strict";
/**
 * @module opcua.server
 * @type {async|exports}
 */

const async = require("async");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const EventEmitter = require("events").EventEmitter;

const util = require("util");

const utils = require("node-opcua-utils");
const display_trace_from_this_projet_only = require("node-opcua-debug").display_trace_from_this_projet_only;
const ServiceFault= require("node-opcua-service-secure-channel").ServiceFault;

function constructFilename(p) {
    const path = require("path");
    const fs = require("fs");
    let filename = path.join(__dirname, "..", p);
    //xx console.log("fi = ",filename);
    if(!fs.existsSync(filename)) {
        // try one level up
        filename = path.join(__dirname, p);
        if(!fs.existsSync(filename)) {
            throw new Error("Cannot find filename " + filename + " ( __dirname = " + __dirname);
        }
    }
    return filename;
}

const debugLog = require("node-opcua-debug").make_debugLog(__filename);

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const endpoints_service = require("node-opcua-service-endpoints");
const GetEndpointsResponse = endpoints_service.GetEndpointsResponse;
const ApplicationType = endpoints_service.ApplicationType;

const OPCUASecureObject = require("node-opcua-common").OPCUASecureObject;


const register_server_service = require("node-opcua-service-register-server");
const FindServersRequest = register_server_service.FindServersRequest;
const FindServersResponse = register_server_service.FindServersResponse;
const LocalizedText = require("node-opcua-data-model").LocalizedText;

const default_server_info = {

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

    const self = this;

    options = options || {};

    EventEmitter.call(this);

    self.endpoints = [];
    self.options = options;

    options.certificateFile = options.certificateFile || constructFilename("certificates/server_selfsigned_cert_2048.pem");
    options.privateKeyFile = options.privateKeyFile || constructFilename("certificates/PKI/own/private/private_key.pem");

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

    const self = this;
    assert(_.isFunction(done));
    assert(_.isArray(this.endpoints));

    const tasks = [];
    this.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {

            endPoint._on_new_channel = function (channel) {
                self.emit("newChannel", channel);
            };
            endPoint.on("newChannel", endPoint._on_new_channel);

            endPoint._on_close_channel = function (channel) {
                self.emit("closeChannel", channel);
            };
            endPoint.on("closeChannel", endPoint._on_close_channel);

            endPoint.start(callback);

        });
    });
    async.series(tasks, done);
};


function cleanupEndpoint(endPoint)  {
    if (endPoint._on_new_channel) {
        assert(_.isFunction(endPoint._on_new_channel));
        endPoint.removeListener("newChannel", endPoint._on_new_channel);
    }
    if (endPoint._on_close_channel) {
        assert(_.isFunction(endPoint._on_close_channel));
        endPoint.removeListener("closeChannel", endPoint._on_close_channel);
    }
}
/**
 * shutdown all server endPoints
 * @method shutdown
 * @async
 * @param  {callback} done
 * @param  {Error|null} done.err
 */
OPCUABaseServer.prototype.shutdown = function (done) {

    assert(_.isFunction(done));
    const self = this;

    const tasks = [];
    self.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {
            cleanupEndpoint(endPoint);
            endPoint.shutdown(callback);
        });
    });
    async.parallel(tasks, function (err) {
        done(err);
        debugLog("shutdown completed");
    });
};



OPCUABaseServer.prototype.simulateCrash = function(callback) {

    assert(_.isFunction(callback));
    const self = this;

    debugLog("OPCUABaseServer#simulateCrash");

    const tasks = [];
    self.endpoints.forEach(function (endPoint) {
        tasks.push(function (callback) {
            console.log(" crashing endpoint ",endPoint.endpointUrl);
            endPoint.suspendConnection(function() {
            });
            endPoint.killClientSockets(callback);
        });
    });
    //xx self.engine.shutdown();
    //xx self.shutdown(callback);
    async.series(tasks, callback);
};

/**
 * construct a service Fault response
 * @method makeServiceFault
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode, messages) {
    const response = new ServiceFault();
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
    const request = message.request;


    // install channel._on_response so we can intercept its call and  emit the "response" event.
    if (!channel._on_response) {
        channel._on_response = function (msg, response, inner_message) {
            self.emit("response", response, channel);
        }
    }


    // prepare request
    this.prepare(message, channel);

    const self = this;
    debugLog("--------------------------------------------------------".green.bold, channel.secureChannelId, request._schema.name);
    let errMessage, response;
    self.emit("request", request, channel);

    try {
        // handler must be named _on_ActionRequest()
        const handler = self["_on_" + request._schema.name];
        if (_.isFunction(handler)) {
            handler.apply(self, arguments);
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

            display_trace_from_this_projet_only(err);

            let additional_messages = [];
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

    let endpoints = [];
    this.endpoints.map(function (endPoint) {
        const ep = endPoint.endpointDescriptions();
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

    const server = this;
    const request = message.request;

    assert(request._schema.name === "GetEndpointsRequest");

    const response = new GetEndpointsResponse({});


    response.endpoints = server._get_endpoints();

    response.endpoints = response.endpoints.filter(function (endpoint) {
        return !endpoint.restricted;
    });

    // apply filters
    if (request.profileUris && request.profileUris.length > 0) {
        response.endpoints = response.endpoints.filter(function (endpoint) {
            return request.profileUris.indexOf(endpoint.transportProfileUri) >= 0;
        });
    }

    // adjust locale on ApplicationName to match requested local or provide 
    // a string with neutral locale (locale === null)
    // TODO: find a better way to handle this
    response.endpoints.forEach(function (endpoint) {
        endpoint.server.applicationName.locale = null;
    });

    channel.send_response("MSG", response, message);

};


OPCUABaseServer.prototype.getDiscoveryUrls = function () {
    const discoveryUrls = this.endpoints.map(function (e) {
        return e._endpoints[0].endpointUrl;
    });
    return discoveryUrls;
    // alternative : return _.uniq(this._get_endpoints().map(function(e){ return e.endpointUrl; }));

};

OPCUABaseServer.prototype.getServers = function (channel) {
    const server = this;
    server.serverInfo.discoveryUrls = server.getDiscoveryUrls(channel);
    const servers = [server.serverInfo];
    return servers;
};


/**
 * @method _on_FindServersRequest
 * @param message
 * @param channel
 * @private
 */
OPCUABaseServer.prototype._on_FindServersRequest = function (message, channel) {

    const server = this;
    // Release 1.02  13  OPC Unified Architecture, Part 4 :
    //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
    //   attacks. A  Server  should minimize the amount of processing required to send the response for this
    //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
    //   short delay before starting processing of a request during high traffic conditions.


    const shortDelay = 2;
    setTimeout(function () {

        const request = message.request;
        assert(request._schema.name === "FindServersRequest");
        assert(request instanceof FindServersRequest);

        let servers = server.getServers(channel);
        // apply filters
        // TODO /
        if (request.serverUris && request.serverUris.length > 0) {
            // A serverUri matches the applicationUri from the ApplicationDescription define
            servers = servers.filter(function (applicationDecription) {
                return request.serverUris.indexOf(applicationDecription.applicationUri) >= 0;
            });
        }

        const response = new FindServersResponse({
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
    let channels = [];
    this.endpoints.map(function (endpoint) {
        const c = _.values(endpoint._channels);
        channels = channels.concat(c);
    });
    return channels;
};


/**
 * set all the end point into a state where they do not accept further connections
 *
 * note:
 *     this method is useful for testing purpose
 *
 * @method suspendEndPoints
 * @param callback {Function}
 */
OPCUABaseServer.prototype.suspendEndPoints = function (callback) {

    const self = this;
    async.forEach(self.endpoints, function (ep, _inner_callback) {
        ep.suspendConnection(_inner_callback);
    }, function () {
        callback();
    });
};
/**
 * set all the end point into a state where they do accept connections
 * note:
 *    this method is useful for testing purpose
 * @method resumeEndPoints
 * @param callback {Function}
 */
OPCUABaseServer.prototype.resumeEndPoints = function (callback) {
    const self = this;
    async.forEach(self.endpoints, function (ep, _inner_callback) {
        ep.restoreConnection(_inner_callback);
    }, callback);
};

exports.OPCUABaseServer = OPCUABaseServer;



