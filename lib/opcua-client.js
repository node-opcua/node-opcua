var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var opcua = require("./nodeopcua");
var read_certificate = require("../lib/crypto_utils").read_certificate;
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert= require('better-assert');

var ClientSecureChannelLayer =require("./client/client_secure_channel_layer").ClientSecureChannelLayer;
var s = require("./structures");
var nodeids = require("./opcua_node_ids").DataType;
var ec = require("./encode_decode");
var resolveNodeId = require("./nodeid").resolveNodeId;

var debugLog  = require("../lib/utils").make_debugLog(__filename);

/**
 *
 * @constructor OPCUAClient
 */
function OPCUAClientBase() {

    EventEmitter.call(this);
    this.protocolVersion = 1;
    this._sessions = [];
    this._clientNonce = crypto.randomBytes(32);

    var folder = path.resolve(__dirname);

    this._certificate = read_certificate( folder + "/../certificates/client_cert.pem");
    this._server_endpoints =[];
    this._secureChannel = null;

}
util.inherits(OPCUAClientBase, EventEmitter);
/**
 * connect OPCUA client to server
 *
 * @param endpoint_url
 * @param callback
 */
OPCUAClientBase.prototype.connect = function(endpoint_url, callback) {

    assert(_.isFunction(callback), "expecting a callback");

    var self = this;

    // prevent illegal call to connect
    if ( this._secureChannel !== null) {
        process.nextTick(function() { callback(new Error("connect already called"),null);});
        return;
    }

    self._connection_callback = callback;

    //todo: make sure endpoint_url exists in the list of endpoints send by the server
    async.series([

        //------------------------------------------------- STEP 2 : OpenSecureChannel
        function(callback) {
            assert( self._secureChannel === null );

            self._secureChannel = new ClientSecureChannelLayer();
            self._secureChannel.on("send_chunk",function(message_chunk)     {
                self.emit("send_chunk",message_chunk); });
            self._secureChannel.on("receive_chunk",function(message_chunk)  {
                self.emit("receive_chunk",message_chunk); });
            self._secureChannel.on("send_request",function(message)         {
                self.emit("send_request",message);  });
            self._secureChannel.on("receive_response",function(message)      {
                self.emit("receive_response",message);  });

            self._secureChannel.protocolVersion = self.protocolVersion;
            self._secureChannel.create(endpoint_url,function(err){

                if (err) {
                    self._secureChannel = null;
                } else {


                }
                callback(err);
            });
        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function(callback) {
            self.getEndPointRequest(function(err,endpoints){
                callback(err);
            });
        }


    ], function(err) {

        if (err) {
            self.disconnect(function() {

                if (self._connection_callback) {
                    setImmediate(self._connection_callback,err); // OK
                    self._connection_callback = null;
                }
            });
            self._secureChannel = null;
        } else {
            if (self._connection_callback) {
                setImmediate(self._connection_callback,err); // OK
                self._connection_callback = null;
            }
        }
    });
};

OPCUAClientBase.prototype.performMessageTransaction = function(request, responseClass,callback) {

    assert(request);
    assert(request.requestHeader);
    assert(typeof(callback) === "function");
    this._secureChannel.performMessageTransaction(request,responseClass,callback);
};

/**
 * return the endpoint information from a URI
 * @param endpointUrl
 */
OPCUAClientBase.prototype.findEndpoint = function(endpointUrl) {

  return  _.find(this._server_endpoints,function(endpoint){return endpoint.endpointUrl === endpointUrl; });

};


OPCUAClientBase.prototype.getEndPointRequest = function(callback) {

    var self = this;
    // OpenSecureChannel
    var request = new s.GetEndpointsRequest(
        {
            endpointUrl: self.endpoint_url,
            localeIds: [],
            requestHeader: {
                auditEntryId:   null
            }
        }
    );

    self._secureChannel.performMessageTransaction(request, s.GetEndpointsResponse,function(err,response){
        if (!err) {
            self._server_endpoints = response.endpoints;
            callback(null,response.endpoints);
        } else {
            self._server_endpoints = [];
            callback(err,null);
        }
    });
};

/**
 * send a FindServers request to a discovery server
 *
 * @param callback
 */
var FindServersRequest = require("./register_server_service").FindServersRequest;
var FindServersResponse = require("./register_server_service").FindServersResponse;
OPCUAClientBase.prototype.findServers = function(callback) {
    // todo : assert that the server we are connected to is  a discovery server
    var self = this;
    var request = new FindServersRequest({
        endpointUrl: this.endpoint_url,
        localeIds:  [],
        serverUris: []
    });
    self.performMessageTransaction(request,FindServersResponse,function(err,response){
        callback(err,response.servers);
    });
};



/**
 * property transactionInProgress
 *
 * @returns {boolean} true if a transaction has already been initiated and if the client
 *                    is waiting for a reply from the server, false if the  client is ready
 *                    to initiate a new transaction with the server.
 */
OPCUAClientBase.prototype.__defineGetter__("transactionInProgress" ,function() {
    return this._secureChannel.transactionInProgress;
});

/**
 * disconnect client from server
 * @param callback
 */
OPCUAClientBase.prototype.disconnect = function(callback) {

    if (this._secureChannel) {
        this._secureChannel.close(callback);
        this._secureChannel = null;
    } else {
        callback();
    }

};
exports.OPCUAClientBase = OPCUAClientBase;



function OPCUAClient(){
    OPCUAClientBase.apply(this,arguments);
}
util.inherits(OPCUAClient,OPCUAClientBase);




var OPCUASession = function(client) {
    assert(client instanceof OPCUAClient);
    this._client = client;
};


var browse_service = require("./browse_service");


/**
 * @example:
 *
 *     session.browse("RootFolder",function(err,results,diagnostics) {} );
 *
 * @param nodes
 * @param callback
 */
OPCUASession.prototype.browse = function(nodes,callback) {


    assert(typeof(callback) === "function");

    if (!_.isArray(nodes)) { nodes = [nodes]; }

    var nodesToBrowse = [];
    nodes.forEach(function(node) {
        nodesToBrowse.push({
            nodeId: resolveNodeId(node),
            includeSubtypes: true,
            browseDirection: browse_service.BrowseDirection.Both,
            resultMask: 63
        });
    });

    var request = new browse_service.BrowseRequest({ nodesToBrowse:nodesToBrowse });

   this.performMessageTransaction(request, browse_service.BrowseResponse,function(err,response){
        if(err) {
            callback(err,null,response);
        } else {
            // console.log(JSON.stringify(response.results,null," ").yellow.bold);
            callback(null,response.results,response.diagnosticInfos);
        }
    });

};


var read_service = require("./read_service");
/**
 * @example:
 *
 *     session.read("ns=2;s=Furnace_1.Temperature",function(err,dataValues,diagnostics) {} );
 *
 * @param nodes
 * @param callback
 */
OPCUASession.prototype.readVariableValue = function(nodes,callback) {

    assert(typeof(callback) === "function");
    if (!_.isArray(nodes)) { nodes = [nodes]; }


    var nodesToRead = [];

    nodes.forEach(function(node) {
        nodesToRead.push( {
            nodeId: resolveNodeId(node),
            attributeId: read_service.AttributeIds.Value,
            indexRange: null,
            dataEncoding: { id:0 , name: null}
        });
    });

    var request = new read_service.ReadRequest({ nodesToRead: nodesToRead });

    assert( nodes.length == request.nodesToRead.length);

    this.performMessageTransaction(request, read_service.ReadResponse,function(err,response) {

        if(err) {
            callback(err,response);
        } else {
            assert( nodes.length == response.results.length);
            callback(null,response.results,response.diagnosticInfos);
        }
    });

};

OPCUASession.prototype.performMessageTransaction = function(request, responseClass,callback) {

    assert(typeof(callback) === "function");
    request.requestHeader.authenticationToken = this.authenticationToken;
    this._client._secureChannel.performMessageTransaction(request,responseClass,callback);
};


OPCUASession.prototype.close = function(callback) {
    this._client.closeSession(this,callback);
};



OPCUAClient.prototype._nextSessionName = function()
{
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return 'Session' + this.___sessionName_counter;
};


OPCUAClient.prototype._createSession = function(callback) {


    assert(typeof(callback) === "function");

    if (!this._secureChannel) {
        callback(new Error(" No secure channel"));
        return;
    }

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
    self._secureChannel.performMessageTransaction(request, s.CreateSessionResponse,function(err,response){

        if (!err) {

            assert( response instanceof s.CreateSessionResponse);

            //
            // todo: verify SignedSoftwareCertificates and  response.serverSignature
            //
            var session = new OPCUASession(self);
            session.name                = request.sessionName;

            session.sessionId           = response.sessionId;
            session.authenticationToken = response.authenticationToken;
            session.timeout             = response.revisedSessionTimeout;
            session.serverNonce         = response.serverNonce;
            session.serverCertificate   = response.serverCertificate;
            session.serverSignature     = response.serverSignature;


            callback(null,session);

        } else {

            callback(err,null);
        }
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
        userIdentityToken: new s.AnonymousIdentityToken({
            policyId: "0"
        }), // extension object
        userTokenSignature: {
            algorithm: null,
            signature: null
        }

    });

    //xx    request.requestHeader.authenticationToken = session.authenticationToken;

    var self  = this;
    session.performMessageTransaction(request, s.ActivateSessionResponse,function(err,response){

        if (!err) {

            assert( response instanceof s.ActivateSessionResponse);

            session.serverNonce = response.serverNonce;

            var results = response.results;

            callback(null,session);

        } else {

            callback(err,null);
        }
    });
};

/**
 * create and activate a new session
 *
 * @param callback
 */
OPCUAClient.prototype.createSession = function(callback) {

    assert(_.isFunction(callback));
    var self = this;

    self._createSession(function(err,session){
        if(err) {
            callback(err);
        } else {
            self._activateSession(session,function(err){
                assert(!_.contains(self._sessions,session));
                if (!err) {
                    self._sessions.push(session);
                    assert(_.contains(self._sessions,session));

                } else {
                    console.log(" Client _activateSession  has failed");
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

    if (!this._secureChannel) {
        callback(new Error(" No secure channel"));
    }

    var request = new s.CloseSessionRequest({
        deleteSubscriptions: true
    });

    var self  = this;
    session.performMessageTransaction(request, s.CloseSessionResponse,function(err,response){

        if(err) {
            console.log(" received : ",err);
            self._secureChannel.close(function(){
                callback(err,null);
            });
        } else {
            self._secureChannel.close(callback);
        }
    });
};

/**
 * @param callback
 * @param session
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

