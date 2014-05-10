/**
 * @module opcua.client
 */
var util = require("util");
var _ = require("underscore");
var assert= require('better-assert');

var s = require("./structures");
var resolveNodeId = require("./nodeid").resolveNodeId;

var DataValue = require("../lib/datavalue").DataValue;

var OPCUAClientBase = require("../lib/client/client_base").OPCUAClientBase;

var NodeId = require("../lib/nodeid").NodeId;


/**
 * @class  OPCUASession
 * @param client {OPCUAClient}
 * @constructor
 */
var OPCUASession = function(client) {
    assert(client instanceof OPCUAClient);
    this._client = client;
};


var browse_service = require("./browse_service");

function coerceBrowseDescription(data) {
    if (typeof data === 'string' || data instanceof NodeId) {
        return coerceBrowseDescription({
            nodeId: resolveNodeId(data),
            includeSubtypes: true,
            browseDirection: browse_service.BrowseDirection.Both,
            resultMask: 63
        })
    } else {
        data.nodeId = resolveNodeId(data.nodeId );
        //xx data.referenceTypeId = data.referenceTypeId ? resolveNodeId(data.referenceTypeId) : null;
        return new browse_service.BrowseDescription(data);
    }
}

/**
 * browse
 * @method browse
 * @async
 *
 * @example:
 *
 * form1:
 *
 *    ``` javascript
 *    session.browse("RootFolder",function(err,results,diagnostics) {} );
 *    ```
 *
 * form2:
 *
 *    ``` javascript
 *    var browseDescription = {
 *       nodeId: "ObjectsFolder",
 *       referenceTypeId: "Organizes",
 *       browseDirection: BrowseDirection.Inverse
 *    }
 *    session.browse(browseDescription,function(err,results,diagnostics) {} );
 *    ```
 *
 * form3:
 *
 *    ``` javascript
 *    session.browse([ "RootFolder", "ObjectsFolder"],function(err,results,diagnostics) {
 *       assert(results.length === 2);
 *    });
 *    ```
 *
 * @param nodes
 * @param callback
 */
OPCUASession.prototype.browse = function(nodes,callback) {

    assert(_.isFunction(callback));

    if (!_.isArray(nodes)) { nodes = [nodes]; }

    var nodesToBrowse = nodes.map(coerceBrowseDescription);

    var request = new browse_service.BrowseRequest({ nodesToBrowse:nodesToBrowse });

    this.performMessageTransaction(request,function(err,response){
        if(err) {
            callback(err,null,response);
        } else {
            assert(response instanceof browse_service.BrowseResponse);
            // console.log(JSON.stringify(response.results,null," ").yellow.bold);
            callback(null,response.results,response.diagnosticInfos);
        }
    });

};


var read_service = require("./read_service");
/**
 * @method readVariableValue
 * @async
 * @example:
 *
 *     session.readVariableValue("ns=2;s=Furnace_1.Temperature",function(err,dataValues,diagnostics) {} );
 *
 * @param nodes
 * @param callback
 */
OPCUASession.prototype.readVariableValue = function(nodes,callback) {

    assert(_.isFunction(callback));
    if (!_.isArray(nodes)) { nodes = [nodes]; }


    var nodesToRead = [];

    nodes.forEach(function(node) {
        nodesToRead.push( {
            nodeId: resolveNodeId(node),
            attributeId: read_service.AttributeIds.Value,
            indexRange: null,
            dataEncoding: { namespaceIndex:0 , name: null}
        });
    });

    var request = new read_service.ReadRequest({ nodesToRead: nodesToRead });

    assert( nodes.length === request.nodesToRead.length);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof read_service.ReadResponse);
            assert( nodes.length === response.results.length);
            callback(null,response.results,response.diagnosticInfos);
        }
    });

};


var write_service = require("./write_service");

/**
 * @async
 * @method write
 * @param nodesToWrite {Array.<WriteValue>}  - the array of value to write. One or more elements.
 *
 * @param {Function} callback -   the callback function
 * @param callback.err {object|null} the error if write has failed or null if OK
 * @param callback.statusCodes {StatusCode[]} - an array of status code of each write
 * @param callback.diagnosticInfos {DiagnosticInfo[]} the diagnostic infos.
 */
OPCUASession.prototype.write = function(nodesToWrite,callback) {

    assert(_.isFunction(callback));
    assert(_.isArray(nodesToWrite));
    assert(nodesToWrite.length>0);

    var request = new write_service.WriteRequest({ nodesToWrite: nodesToWrite });

    assert(request.nodesToWrite[0] instanceof write_service.WriteValue);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof write_service.WriteResponse);
            assert( nodesToWrite.length === response.results.length);
            callback(null,response.results,response.diagnosticInfos);
        }
    });
};


/**
 *
 * @async
 * @method writeSingleNode
 * @param nodeId  {NodeId}  - the node id of the node to write
 * @param value   {Variant} - the value to write
 * @param callback
 * @param callback.err {object|null} the error if write has failed or null if OK
 * @param callback.statusCode {StatusCode} - the status code of the write
 * @param callback.diagnosticInfo {DiagnosticInfo} the diagnostic info.
 */
OPCUASession.prototype.writeSingleNode = function(nodeId,value,callback) {

    assert(_.isFunction(callback));

    var nodesToWrite = [];

    nodesToWrite.push( {
        nodeId: resolveNodeId(nodeId),
        attributeId: read_service.AttributeIds.Value,
        indexRange: null,
        value: new DataValue({ value: value})
    });
    this.write(nodesToWrite,function(err,statusCodes,diagnosticInfos){
        if (err) {
            callback(err);
        } else {
            assert(statusCodes.length===1);
            var diagnosticInfo = diagnosticInfos ? diagnosticInfos[0] : null;
            callback(null,statusCodes[0],diagnosticInfo);
        }
    });
};



/**
 * @method readAllAttributes
 *
 * @example:
 *
 *    ``` javascript
 *    session.readAllAttributes("ns=2;s=Furnace_1.Temperature",function(err,dataValues,diagnostics) {} );
 *    ```
 *
 * @async
 * @param nodes  {NodeId[]} - an array of nodeId to read
 * @param callback  {Function} - the callback function
 */
OPCUASession.prototype.readAllAttributes = function(nodes,callback) {

    assert(_.isFunction(callback));
    if (!_.isArray(nodes)) { nodes = [nodes]; }


    var nodesToRead = [];

    nodes.forEach(function(node) {
        Object.keys(read_service.AttributeIds).forEach(function(key){
            var attributeId =read_service.AttributeIds[key];
            nodesToRead.push( {
                nodeId: resolveNodeId(node),
                attributeId: attributeId,
                indexRange: null,
                dataEncoding: { namespaceIndex:0 , name: null}
            });
        })
    });

    var request = new read_service.ReadRequest({ nodesToRead: nodesToRead });


    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof read_service.ReadResponse);
            callback(null,nodesToRead,response.results,response.diagnosticInfos);
        }
    });

};


var subscription_service = require("./subscription_service");
/**
 * @method createSubscription
 * @async
 *
 * @example:
 *
 *    ``` javascript
 *    session.createSubscription(request,function(err,response) {} );
 *    ```
 *
 * @param options  {CreateSubscriptionRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.createSubscription = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.CreateSubscriptionRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.CreateSubscriptionResponse);
            callback(null,response);
        }
    });

};
/**
 * @method deleteSubscriptions
 * @async
 * @example:
 *
 *     session.deleteSubscriptions(request,function(err,response) {} );
 *
 * @param options {DeleteSubscriptionsRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.deleteSubscriptions = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.DeleteSubscriptionsRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.DeleteSubscriptionsResponse);
            callback(null,response);
        }
    });

};
/**
 *
 * @method createMonitoredItems
 * @async
 * @param options  {CreateMonitoredItemsRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.createMonitoredItems = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.CreateMonitoredItemsRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            callback(null,response);
        }
    });

};


/**
 *
 * @method publish
 * @async
 * @param options  {PublishRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.publish = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.PublishRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.PublishResponse);
            callback(null,response);
        }
    });
};


/**
 *
 * @method republish
 * @async
 * @param options  {RepublishRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.republish = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.RepublishRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.RepublishResponse);
            callback(null,response);
        }
    });
};


/**
 *
 * @method deleteMonitoredItems
 * @async
 * @param options  {DeleteMonitoredItemsRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.deleteMonitoredItems = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.DeleteMonitoredItemsRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.DeleteMonitoredItemsResponse);
            callback(null,response);
        }
    });
};

/**
 *
 * @method setPublishingMode
 * @async
 * @param options  {SetPublishingModeRequest}
 * @param callback {Function}
 */
OPCUASession.prototype.setPublishingMode = function(options,callback) {

    assert(_.isFunction(callback));

    var request = new subscription_service.SetPublishingModeRequest(options);

    this.performMessageTransaction(request, function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof subscription_service.SetPublishingModeResponse);
            callback(null,response);
        }
    });
};

/**
 *
 * @method translateBrowsePath
 * @async
 * @param options  {BrowsePath[]}
 * @param callback {Function}
 */
OPCUASession.prototype.translateBrowsePath = function(browsePath,callback) {
    assert(_.isFunction(callback));

    var constructBrowsePath = require("../lib/common/address_space").constructBrowsePath;
    if (typeof browsePath === "string") {
        browsePath = constructBrowsePath("/",browsePath);
    }
    var translate_service = require("../lib/translate_browse_paths_to_node_ids_service");

    var request = new translate_service.TranslateBrowsePathsToNodeIdsRequest({
        browsePath: [browsePath]
    });
    this.performMessageTransaction(request, function(err,response) {
        if(err) {
            callback(err,response);
        } else {
            assert(response instanceof translate_service.TranslateBrowsePathsToNodeIdsResponse);
            callback(null,response.results[0]);
        }
    });

};

OPCUASession.prototype.performMessageTransaction = function(request,callback) {

    assert(_.isFunction(callback));
    assert(this._client);
    assert(this._client._secureChannel);

    request.requestHeader.authenticationToken = this.authenticationToken;
    this._client._secureChannel.performMessageTransaction(request,callback);
};

/**
 *
 * @method close
 * @async
 * @param callback {Function}
 */
OPCUASession.prototype.close = function(callback) {
    assert(_.isFunction(callback));
    assert(this._client);
    this._client.closeSession(this,callback);
};


/**
 * @class OPCUAClient
 * @extends OPCUAClientBase
 * @constructor
 */
function OPCUAClient(){
    OPCUAClientBase.apply(this,arguments);
}
util.inherits(OPCUAClient,OPCUAClientBase);



OPCUAClient.prototype._nextSessionName = function() {
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return 'Session' + this.___sessionName_counter;
};


OPCUAClient.prototype._createSession = function(callback) {

    assert(typeof(callback) === "function");
    assert(this._secureChannel);

    var endpoint = this.findEndpoint(this._secureChannel.endpoint_url);

    if (!endpoint) {
        callback(new Error( " End point must exist " + this._secureChannel.endpoint_url));
        return;
    }

    this.serverUri = endpoint.server.applicationUri;

    this.endpoint_url =this._secureChannel.endpoint_url;
    this.endpoint_url = "opc.tcp://localhost:51210/UA/SampleServer";

    var applicationDescription = new s.ApplicationDescription({
        applicationUri: "urn:localhost:application:",
        productUri: "http://localhost/application",
        applicationName: { text: "MyApplication"},
        applicationType: s.ApplicationType.CLIENT,
        gatewayServerUri: undefined,
        discoveryProfileUri: undefined,
        discoveryUrls: []
    });

    assert(this.serverUri," must have a valid server URI");
    assert(this.endpoint_url," must have a valid server endpoint_url");

    var request = new s.CreateSessionRequest({
              clientDescription: applicationDescription,
                      serverUri: this.serverUri,
                    endpointUrl: this.endpoint_url,
                    sessionName: this._nextSessionName(),
                    clientNonce: this._clientNonce,
              clientCertificate: null, //xx this._certificate,
        requestedSessionTimeout: 300000,
         maxResponseMessageSize: 800000
    });

    // console.log(JSON.stringify(request,null," "));

    var self  = this;
    self._secureChannel.performMessageTransaction(request,function(err,response){

        var session = null;
        if (!err) {
            assert( response instanceof s.CreateSessionResponse);

            // todo: verify SignedSoftwareCertificates and  response.serverSignature

            session = new OPCUASession(self);
            session.name                = request.sessionName;

            session.sessionId           = response.sessionId;
            session.authenticationToken = response.authenticationToken;
            session.timeout             = response.revisedSessionTimeout;
            session.serverNonce         = response.serverNonce;
            session.serverCertificate   = response.serverCertificate;
            session.serverSignature     = response.serverSignature;
        }
        callback(err,session);

    });

};


// see OPCUA Part 4 - $7.35
OPCUAClient.prototype._activateSession = function(session,callback) {
    assert(typeof(callback) === "function");

    if (!this._secureChannel) {
        callback(new Error(" No secure channel"));
    }

    var request = new s.ActivateSessionRequest({
        clientSignature: { algorithm: null, signature: null },

        clientSoftwareCertificates: [
        ],

        localeIds: [
        ],

        userIdentityToken: this.userIdentityToken,

        userTokenSignature: {
            algorithm: null,
            signature: null
        }

    });

    session.performMessageTransaction(request, function(err,response){

        if (!err) {

            assert( response instanceof s.ActivateSessionResponse);

            session.serverNonce = response.serverNonce;

            //var results = response.results;

            callback(null,session);

        } else {

            callback(err,null);
        }
    });
};

/**
 * create and activate a new session
 * @method createSession
 * @param userIdentityToken
 * @param callback {Function}
 * @param callback.err     {Error|null}   - the Error if the async method has failed
 * @param callback.session {OPCUASession} - the created session object.
 *
 */
OPCUAClient.prototype.createSession = function(userIdentityToken,callback) {

    var self = this;
    if (_.isFunction(userIdentityToken)) {
        callback = userIdentityToken;
        userIdentityToken = new s.AnonymousIdentityToken({policyId: "0"})
    };

    self.userIdentityToken = userIdentityToken;

    assert(_.isFunction(callback));

    self._createSession(function(err,session){
        if(err) {
            callback(err);
        } else {
            self._activateSession(session,function(err){
                assert(!_.contains(self._sessions,session));
                if (!err) {
                    self._sessions.push(session);
                    assert(_.contains(self._sessions,session));
                }
                callback(err,session);
            });
        }
    });

};

OPCUAClient.prototype._closeSession= function(session,callback) {

    assert(_.isFunction(callback));
    assert(session);
    assert(_.contains(this._sessions,session));
    assert(this._secureChannel);

    var request = new s.CloseSessionRequest({
        deleteSubscriptions: true
    });

    var self  = this;
    session.performMessageTransaction(request, function(err,response){

        if(err) {
            console.log(" received : ",err,response);
            self._secureChannel.close(function(){
                callback(err,null);
            });
        } else {
            //xx s.CloseSessionResponse
            self._secureChannel.close(callback);
        }
    });
};

/**
 *
 * @method closeSession
 * @async
 * @param session  {OPCUASession} -
 * @param callback {Function} - the callback
 */
OPCUAClient.prototype.closeSession = function(session,callback) {
    assert(_.isFunction(callback));
    assert(session);
    assert(_.contains(this._sessions,session));

    var self = this;
    //todo : send close session on secure channel
    self._closeSession(session,function(err){
        var index = self._sessions.indexOf(session);
        if (index >=0 ) {
            self._sessions.splice(index, 1);
        }
        callback(err);
    });
};



exports.OPCUAClient = OPCUAClient;
exports.OPCUASession = OPCUASession;

