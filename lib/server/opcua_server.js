/**
 * @module opcua.server
 */


var s = require("./../datamodel/structures");
var StatusCodes = require("./../datamodel/opcua_status_code").StatusCodes;
var assert = require('better-assert');

var async = require('async');
var util = require("util");
var path = require("path");

var debugLog = require("../misc/utils").make_debugLog(__filename);

var ServerEngine = require("./server_engine").ServerEngine;
var browse_service = require("./../services/browse_service");
var read_service = require("./../services/read_service");
var write_service = require("./../services/write_service");
var subscription_service = require("./../services/subscription_service");
var translate_service = require("./../services/translate_browse_paths_to_node_ids_service");

var TimestampsToReturn = read_service.TimestampsToReturn;

var ActivateSessionResponse = require("./../services/session_service").ActivateSessionResponse;
var CreateSessionResponse = require("./../services/session_service").CreateSessionResponse;

var _ = require("underscore");
var NodeId = require("./../datamodel/nodeid").NodeId;
var NodeIdType = require("./../datamodel/nodeid").NodeIdType;
var crypto = require("crypto");
var DataValue = require("./../datamodel/datavalue").DataValue;
var DataType = require("./../datamodel/variant").DataType;
var MonitoredItem = require("./monitored_item").MonitoredItem;
var dump = require("./../misc/utils").dump;


var OPCUAServerEndPoint = require("./server_endpoint").OPCUAServerEndPoint;

var OPCUABaseServer = require("./base_server").OPCUABaseServer;

/**
 * @class OPCUAServer
 * @extends  OPCUABaseServer
 * @uses ServerEngine
 * @param options
 * @constructor
 */
function OPCUAServer(options) {

    options = options || {};

    OPCUABaseServer.apply(this, arguments);

    var self = this;

    self.options = options;

    self.engine = new ServerEngine();

    self.nonce = crypto.randomBytes(32);

    self.protocolVersion = 1;
    self.connected_client_count = 0;

    var port = options.port || 26543;

    // add the tcp/ip endpoint with no security
    var endpoint = new OPCUAServerEndPoint(this, port, {
        defaultSecureTokenLifetime: options.defaultSecureTokenLifetime || 60000
    });
    self.endpoints.push(endpoint);

    endpoint.on("message", function (message, channel) {

        self.on_request(message, channel);
    });

    self.serverType = s.ApplicationType.SERVER;
}
util.inherits(OPCUAServer, OPCUABaseServer);

/**
 * @property buildInfo {BuildInfo]
 */
OPCUAServer.prototype.__defineGetter__("buildInfo", function () {
    return this.engine.buildInfo;
});

/**
 * create and register a new session
 * @method createSession
 * @return {ServerSession}
 */
OPCUAServer.prototype.createSession = function () {
    var self = this;
    return self.engine.createSession();
};

/**
 * retrieve a session by authentication token
 * @method getSession
 *
 * @param authenticationToken
 */
OPCUAServer.prototype.getSession = function (authenticationToken) {
    var self = this;
    return self.engine.getSession(authenticationToken);
};

/**
 * @property initialized {Boolean] -  true if the server has been initialized
 *
 */
OPCUAServer.prototype.__defineGetter__("initialized", function () {
    var self = this;
    return self.engine.address_space !== null;
});


/**
 * Initialize the server by installing default node set.
 *
 * @method initialize
 * @async
 *
 * This is a asynchronous function that requires a callback function.
 * The callback function typically completes the creation of custom node
 * and instruct the server to listen to its endpoints.
 *
 * @param {callback} done
 */
OPCUAServer.prototype.initialize = function (done) {

    var self = this;
    assert(!self.initialized);// already initialized ?
    self.engine.initialize(self.options, function () {
        self.emit("post_initialize");
        done();
    });
};


/**
 * Initiate the server by starting all its endpoints
 * @method start
 * @async
 * @param done {Callback}
 */
OPCUAServer.prototype.start = function (done) {

    var self = this;
    var tasks = [];
    if (!self.initialized) {
        tasks.push(function (callback) {
            self.initialize(callback);
        });
    }
    tasks.push(function (callback) {
        OPCUABaseServer.prototype.start.call(self, callback);
    });
    var q = async.series(tasks, done);


};

/**
 * shutdown all server endpoints
 * @method shutdown
 * @async
 * @param  {Callback} done
 */
OPCUAServer.prototype.shutdown = function (done) {

    var self = this;
    self.engine.shutdown();

    OPCUABaseServer.prototype.shutdown.call(self, done);

};


/**
 * Get the server certificate
 * @method getCertificate
 */
OPCUAServer.prototype.getCertificate = function () {
    if (!this.certificate) {
        // create fake certificate
        var read_certificate = require("./../misc/crypto_utils").read_certificate;

        var folder = path.resolve(__dirname);
        this.certificate = read_certificate(folder + "/../../certificates/cert.pem");
    }
    return this.certificate;
};


OPCUAServer.prototype.getSignedCertificate = function () {

    var self = this;
    return new s.SignedSoftwareCertificate({
        certificateData: self.getCertificate(),
        signature: new Buffer("HelloWorld")
    });
};

// session services
OPCUAServer.prototype._on_CreateSessionRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    assert(request._schema.name === "CreateSessionRequest");

    // todo: check that we haven't exceed the maximum number of allowed session
    //       returns BadTooManySessions otherwise

    // todo: check clientnonce
    //       return BadNonceInvalid if clientNonce is invalid or null


    var session = server.createSession();
    assert(session);

    // serverNonce:
    // A random number that should never be used in any other request.
    // This number shall have a minimum length of 32 bytes.
    // The Client shall use this value to prove possession of its application instance
    // Certificate in the ActivateSession request.
    // This value may also be used to prove possession of the userIdentityToken it
    // specified in the ActivateSession request.
    //
    // ( this serverNonce will only be used up to the _on_ActivateSessionRequest
    //   where a new nonce will be created)
    session.nonce = crypto.randomBytes(32);


    var response = new CreateSessionResponse({
        // A identifier which uniquely identifies the session.
        sessionId: session.nodeId,

        // The token used to authenticate the client in subsequent requests.
        authenticationToken: session.authenticationToken,

        revisedSessionTimeout: request.requestedSessionTimeout,

        serverNonce: session.nonce,

        serverCertificate: server.getCertificate(),

        //The endpoints provided by the server.
        serverEndpoints: server._get_endpoints(),

        serverSoftwareCertificates: null,
        serverSignature: null,
        /*
         // SignedSoftwareCertificate: The software certificates owned by the server.
         serverSoftwareCertificates: [
         server.getSignedCertificate()
         ],

         // SignatureData : A signature created with the server certificate.
         //
         // This is a signature generated with the private key associated with the
         // server Certificate. This parameter is calculated by appending the client Nonce to the
         // client Certificate and signing the resulting sequence of bytes.
         // The Signature Algorithm shall be the asymmetric Signature algorithm specified in the
         // Security Policy for the Endpoint
         serverSignature: null,
         */
        // The maximum message size accepted by the server
        maxRequestMessageSize: 0x4000000

    });
    assert(response.authenticationToken);
    channel.send_response("MSG", response, message);
};

/*
 // TO DO : implement this:
 //
 // When the ActivateSession Service is called for the first time then the Server shall reject the request
 // if the SecureChannel is not same as the one associated with the CreateSession request.
 // Subsequent calls to ActivateSession may be associated with different SecureChannels. If this is the
 // case then the Server shall verify that the Certificate the Client used to create the new
 // SecureChannel is the same as the Certificate used to create the original SecureChannel. In addition,
 // the Server shall verify that the Client supplied a UserIdentityToken that is identical to the token
 // currently associated with the Session. Once the Server accepts the new SecureChannel it shall
 // reject requests sent via the old SecureChannel.
 */
/**
 *
 * @param message
 * @param channel
 * @private
 *
 *
 */
OPCUAServer.prototype._on_ActivateSessionRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    assert(request._schema.name === "ActivateSessionRequest");

    // get session from authenticationToken
    var authenticationToken = request.requestHeader.authenticationToken;

    var session = server.getSession(authenticationToken);

    var response;
    if (!session) {
        console.log(" Bad Session in  _on_ActivateSessionRequest".yellow.bold, authenticationToken.value.toString("hex"));
        //xx response = new s.ServiceFault({
        response = new ActivateSessionResponse({ responseHeader: { serviceResult: StatusCodes.BadSessionNotActivated }});
    } else {

        //xx console.log("XXXXXXX _on_ActivateSessionRequest NONCE ",session.nonce.toString("hex").cyan);

        // extract : OPC UA part 4 - 5.6.3

        // Once used, a serverNonce cannot be used again. For that reason, the Server returns a new
        // serverNonce each time the ActivateSession Service is called.
        session.nonce = crypto.randomBytes(32);

        response = new ActivateSessionResponse({ serverNonce: session.nonce });
    }
    channel.send_response("MSG", response, message);
};


OPCUAServer.prototype._apply_on_SessionObject = function (message, channel, action_to_perform) {

    assert(_.isFunction(action_to_perform));

    if (!message.session) {

        var errMessage = "INVALID SESSION  !! ";
        debugLog(errMessage.red.bold);

        var response = new subscription_service.CreateMonitoredItemsResponse({
            responseHeader: { serviceResult: StatusCodes.BadSubscriptionIdInvalid  }
        });
        //xx var response = OPCUABaseServer.makeServiceFault(StatusCodes.BadSessionNotActivated,[errMessage]);
        channel.send_response("MSG", response, message);
        return;
    }
    action_to_perform(message.session, message, channel);

};

OPCUAServer.prototype._on_CloseSessionRequest = function (message, channel) {

    var server = this;

    this._apply_on_SessionObject(message, channel, function (session, message, channel) {
        var response;
        var request = message.request;
        assert(request.hasOwnProperty("deleteSubscriptions"));

        assert(request._schema.name === "CloseSessionRequest");
        assert(server);
        assert(server.engine.closeSession);

        //xx assert(_.isEqual(session.authenticationToken,request.requestHeader.authenticationToken));

        var deleteSubscriptions = request.deleteSubscriptions || false;

        server.engine.closeSession(request.requestHeader.authenticationToken, deleteSubscriptions);

        response = new s.CloseSessionResponse({});
        channel.send_response("MSG", response, message);
    });


};

// browse services
OPCUAServer.prototype._on_BrowseRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    var engine = server.engine;
    assert(request._schema.name === "BrowseRequest");

    var results = [];
    if (request.nodesToBrowse.length > 0) {

        assert(request.nodesToBrowse[0]._schema.name === "BrowseDescription");
        results = engine.browse(request.nodesToBrowse);
        assert(results[0]._schema.name == "BrowseResult");

    }

    var response = new browse_service.BrowseResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response, message);
};


function w(str, width) {
    return (str + "                                               ").substr(0, width);
}
function nodeToReadToString(nodeToRead) {
    return " nodeid: ".yellow + w(nodeToRead.nodeId.displayText(), 30) + " attributeId: " + w(read_service.AttributeNameById[nodeToRead.attributeId], 20);
}

function dumpDataValues(dataValues, nodesToRead) {

    if (!nodesToRead) {
        dataValues.forEach(function (dataValue) {
            console.log(" statusCode : " + w(dataValue.statusCode.toString(), 30) + " dataValue: ".cyan + (dataValue.value === null ? "<null>" : dataValue.value.toString()));
        });

    } else {
        _.zip(dataValues, nodesToRead).forEach(function (pair) {
            var dataValue = pair[0];
            var nodeToRead = pair[1];
            console.log(nodeToReadToString(nodeToRead) + " => statusCode : " + dataValue.statusCode.toString() + " dataValue: ".cyan + (dataValue.value === null ? "<null>" : dataValue.value.toString()));
        });
    }

}

// read services
OPCUAServer.prototype._on_ReadRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    var engine = server.engine;
    assert(request._schema.name === "ReadRequest");

    var results = [];
    var response;

    var timestampsToReturn = request.timestampsToReturn;

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
        response = new read_service.ReadResponse({
            responseHeader: { serviceResult: StatusCodes.BadTimestampsToReturnInvalid}
        });
    } else if (request.maxAge < 0) {
        response = new read_service.ReadResponse({
            responseHeader: { serviceResult: StatusCodes.BadMaxAgeInvalid}
        });
    } else if (request.nodesToRead.length > 0) {

        assert(request.nodesToRead[0]._schema.name === "ReadValueId");
        assert(request.timestampsToReturn);

        results = engine.read(request);
        assert(results[0]._schema.name === "DataValue");
        assert(results.length === request.nodesToRead.length);

        dumpDataValues(results, request.nodesToRead);

        response = new read_service.ReadResponse({
            results: results,
            diagnosticInfos: null
        });

    } else {
        // ! BadNothingToDo
        response = new read_service.ReadResponse({
            responseHeader: { serviceResult: StatusCodes.BadNothingToDo}
        });
    }


    channel.send_response("MSG", response, message);
};

// write services
OPCUAServer.prototype._on_WriteRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    var engine = server.engine;
    assert(request._schema.name === "WriteRequest");
    assert(_.isArray(request.nodesToWrite));

    var results = [];

    if (request.nodesToWrite.length > 0) {

        assert(request.nodesToWrite[0]._schema.name === "WriteValue");
        results = engine.write(request.nodesToWrite);
        assert(_.isArray(results));
        assert(results.length === request.nodesToWrite.length);

    }

    var response = new write_service.WriteResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response, message);
};


// subscription services
OPCUAServer.prototype._on_CreateSubscriptionRequest = function (message, channel) {
    var server = this;
    this._apply_on_SessionObject(message, channel, function (session, message, channel) {

        var request = message.request;
        assert(request._schema.name === "CreateSubscriptionRequest");
        assert(_.isFinite(request.requestedPublishingInterval));


        var subscription = session.createSubscription(request);

        var response = new subscription_service.CreateSubscriptionResponse({
            subscriptionId: subscription.id,
            revisedPublishingInterval: subscription.publishingInterval,
            revisedLifetimeCount: subscription.maxLifeTimeCount,
            revisedMaxKeepAliveCount: subscription.maxKeepAliveCount
        });
        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_DeleteSubscriptionsRequest = function (message, channel) {
    var server = this;
    this._apply_on_SessionObject(message, channel, function (session, message, channel) {
        var request = message.request;
        assert(request._schema.name === "DeleteSubscriptionsRequest");
        var results = request.subscriptionIds.map(function (subscriptionId) {
            return session.deleteSubscription(subscriptionId);
        });
        var response = new subscription_service.DeleteSubscriptionsResponse({
            results: results
        });
        channel.send_response("MSG", response, message);
    });
};


function readValue2(self, oldValue, node, itemToMonitor) {

    assert(self instanceof MonitoredItem);

    var dataValue = node.readAttribute(itemToMonitor.attributeId);

    if (dataValue.statusCode === StatusCodes.Good) {
        if (!_.isEqual(dataValue.value, oldValue)) {
            self.recordValue(dataValue.value);
        }
    } else {
        debugLog("readValue2 Error" + JSON.stringify(dataValue.statusCode));
    }
}

function build_scanning_node_function(engine, itemToMonitor, monitoredItem) {

    var ReadValueId = require("./../services/read_service").ReadValueId;
    assert(itemToMonitor instanceof ReadValueId);

    assert(engine.status === "initialized" && "engine must be initialized");
    var node = engine.findObject(itemToMonitor.nodeId);

    if (!node) {

        console.log(" INVALID NODE ID  , ", itemToMonitor.nodeId.toString());
        dump(itemToMonitor);
        return function () {
            return new DataValue({
                statusCode: StatusCodes.BadNodeIdUnknown,
                value: { dataType: DataType.Null, value: 0 }
            });
        };
    }

    function readFunc(oldValue) {
        return readValue2(this, oldValue, node, itemToMonitor);
    }

    return readFunc;

}

OPCUAServer.prototype.prepare = function (message) {

    var server = this;
    var request = message.request;

    // --- check that session is correct
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);

    message.session = session;

};


OPCUAServer.prototype._on_CreateMonitoredItemsRequest = function (message, channel) {

    var server = this;
    var engine = server.engine;

    this._apply_on_SessionObject(message, channel, function (session, message, channel) {

        var request = message.request;

        assert(request._schema.name === "CreateMonitoredItemsRequest");

        var subscription = session.getSubscription(request.subscriptionId);
        var response;
        if (!subscription) {
            response = new subscription_service.CreateMonitoredItemsResponse({
                responseHeader: { serviceResult: StatusCodes.BadSubscriptionIdInvalid  }
            });

        } else {

            var timestampsToReturn = request.timestampsToReturn;

            var results = request.itemsToCreate.map(function (monitoredItemCreateRequest) {

                var itemToMonitor = monitoredItemCreateRequest.itemToMonitor;
                //xx var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
                //xx var requestedParameters = monitoredItemCreateRequest.requestedParameters;

                var monitoredItemCreateResult = subscription.createMonitoredItem(timestampsToReturn, monitoredItemCreateRequest);

                var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

                var readNodeFunc = build_scanning_node_function(engine, itemToMonitor);

                monitoredItem.on("samplingEvent", readNodeFunc);
                return monitoredItemCreateResult;
            });

            response = new subscription_service.CreateMonitoredItemsResponse({
                responseHeader: {},
                results: results
                //,diagnosticInfos: []
            });
        }
        channel.send_response("MSG", response, message);

    });

};

OPCUAServer.prototype._on_PublishRequest = function (message, channel) {

    this._apply_on_SessionObject(message, channel, function (session, message, channel) {

        var request = message.request;
        assert(request._schema.name === "PublishRequest");

        assert(session);
        assert(session.publishEngine); // server.publishEngine doesn't exists, OPCUAServer has probably shut down already
        session.publishEngine._on_PublishRequest(request, channel);
        session.publishEngine.once("publishResponse", function (request, response) {
            channel.send_response("MSG", response, message);
        });
    });
    // channel.send_response("MSG", response, request);
};

OPCUAServer.prototype._on_SetPublishingModeRequest = function (message, channel) {
    this._apply_on_SessionObject(message, channel, function (session, message, channel) {
        var request = message.request;
        assert(request._schema.name === "SetPublishingModeRequest");
        var response;

        response = new subscription_service.SetPublishingModeResponse({
            results: [],
            diagnosticInfos: null
        });

        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_DeleteMonitoredItemsRequest = function (message, channel) {

    this._apply_on_SessionObject(message, channel, function (session, message, channel) {
        var request = message.request;
        assert(request._schema.name === "DeleteMonitoredItemsRequest");
        var subscriptionId = request.subscriptionId;
        assert(subscriptionId !== null);

        var subscription = session.getSubscription(subscriptionId);
        var response;
        if (!subscription) {
            console.log("Cannot find subscription ", subscriptionId);
            response = new subscription_service.DeleteMonitoredItemsResponse({
                responseHeader: { serviceResult: StatusCodes.BadSubscriptionIdInvalid  }
            });
        } else {

            var results = request.monitoredItemIds.map(function (monitoredItemId) {
                return subscription.removeMonitoredItem(monitoredItemId);
            });

            response = new subscription_service.DeleteMonitoredItemsResponse({
                results: results,
                diagnosticInfos: null
            });
        }
        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_RepublishRequest = function (message, channel) {

    this._apply_on_SessionObject(message, channel, function (session, message, channel) {

        var request = message.request;
        assert(request._schema.name === "RepublishRequest");

        var response;

        var subscription = session.getSubscription(request.subscriptionId);

        if (!subscription) {
            response = new subscription_service.RepublishResponse({
                responseHeader: {
                    serviceResult: StatusCodes.BadSubscriptionIdInvalid
                }
            });

        } else {
            response = new subscription_service.RepublishResponse({
                notificationMessage: {
                }
            });
        }
        channel.send_response("MSG", response, message);
    });
};

// _on_TranslateBrowsePathsToNodeIds service
OPCUAServer.prototype._on_TranslateBrowsePathsToNodeIdsRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    var engine = server.engine;
    assert(request._schema.name === "TranslateBrowsePathsToNodeIdsRequest");

    var browsePathResults = request.browsePath.map(function (browsePath) {
        return engine.browsePath(browsePath);
    });
    var response = new translate_service.TranslateBrowsePathsToNodeIdsResponse({
        results: browsePathResults,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response, message);
};

OPCUAServer.prototype._get_endpoints = function () {
    return this.endpoints.map(function (endpoint) {
        return endpoint.endpointDescription();
    });
};
/**
 * @method _on_GetEndpointsRequest
 * @param message
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_GetEndpointsRequest = function (message, channel) {

    var server = this;
    var request = message.request;

    assert(request._schema.name === "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});

    response.endpoints = server._get_endpoints();

    channel.send_response("MSG", response, message);

};


/**
 * @method registerServer
 * @async
 * @param discovery_server_endpointUrl
 * @param callback
 */
OPCUAServer.prototype.registerServer = function (discovery_server_endpointUrl, callback) {


    var OPCUAClientBase = require("./../client/client_base").OPCUAClientBase;

    var RegisterServerRequest = require("./../services/register_server_service").RegisterServerRequest;
    var RegisterServerResponse = require("./../services/register_server_service").RegisterServerResponse;

    var self = this;
    assert(self.serverType, " must have a valid server Type");

    var client = new OPCUAClientBase();

    function disconnect(callback) {
        client.disconnect(callback);
    }

    client.connect(discovery_server_endpointUrl, function (err) {
        if (!err) {

            var request = new RegisterServerRequest({
                server: {
                    serverUri: "request.serverUri",
                    productUri: "request.productUri",
                    serverNames: [
                        { locale: "en", text: "MyServerName"}
                    ],
                    serverType: self.serverType,
                    gatewayServerUri: null,
                    discoveryUrls: [
                    ],
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });
            assert(request.requestHeader);
            client.performMessageTransaction(request, function (err, response) {
                // RegisterServerResponse
                assert(response instanceof RegisterServerResponse);
                disconnect(callback);
            });
        } else {
            console.log(" cannot register server to discovery server " + discovery_server_endpointUrl);
            console.log("   " + err.message);
            console.log(" make sure discovery server is up and running.");
            disconnect(callback);

        }
    });
};


exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;



