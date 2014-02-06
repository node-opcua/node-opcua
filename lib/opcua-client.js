
var opcua = require("./nodeopcua");
var read_certificate = require("../lib/crypto_utils").read_certificate;
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert= require("assert");

var SecureChannelLayer =require("./client/client_secure_channel_layer").ClientSecureChannelLayer;
var s = require("./structures");

var debugLog  = require("../lib/utils").make_debugLog(__filename);

/**
 *
 * @constructor OPCUAClient
 */
function OPCUAClient() {

    this.protocolVersion = 1;
    this._sessions = [];
    this._clientNonce = crypto.randomBytes(32);
    this._certificate = read_certificate("certificates/client_cert.pem");
    this._server_endpoints =[];

}

/**
 * connect OPCUA client to server
 *
 * @param endpoint_url
 * @param callback
 */
OPCUAClient.prototype.connect = function(endpoint_url, callback)
{
    assert(_.isFunction(callback), "expecting a callback");

    var self = this;

    // prevent illegal call to connect
    if ( this._secureChannel) {
        process.nextTick(function() { callback(new Error("connect already called"),null);});
        return;
    }

    self._connection_callback = callback;

    //todo: make sure endpoint_url exists in the list of endpoints send by the server
    async.series([

        //------------------------------------------------- STEP 2 : OpenSecureChannel
        function(callback) {
            assert( self._secureChannel === undefined );
            self._secureChannel = new SecureChannelLayer();
            self._secureChannel.protocolVersion = self.protocolVersion;
            self._secureChannel.create(endpoint_url,function(err){
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
        } else {
            if (self._connection_callback) {
                setImmediate(self._connection_callback,err); // OK
                self._connection_callback = null;
            }
        }
    });

};


/**
 * return the endpoint information from a URI
 * @param endpoint_url
 */
OPCUAClient.prototype.findEndpoint = function(endpoint_url) {

    for (var endpoint in this._server_endpoints) {
        if (this._server_endpoints.hasOwnProperty(endpoint)) {
            if (endpoint.endpointUrl === endpoint_url) {
                return endpoint;
            }
        }
    }
    return undefined;
};


OPCUAClient.prototype.getEndPointRequest = function(callback) {

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

var OPCUASession = function(client) {
    this._client = client;
};

OPCUASession.prototype.browseName = function() {

};
OPCUASession.prototype.activate = function() {

};
OPCUASession.prototype.close = function() {
    this._client.closeSession(this);
};


OPCUAClient.prototype._nextSessionName = function()
{
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return 'Session' + this.___sessionName_counter;
};


OPCUAClient.prototype.createSession = function(callback) {


    assert(typeof(callback) === "function");

    if (!this._secureChannel) {
        callback(new Error(" No secure channel"));
    }

    var applicationDescription = new s.ApplicationDescription({
        applicationUri: "urn:localhost:application:",
        productUri: "http://localhost/application",
        applicationName: { text: "MyApplication"},
        applicationType: s.EnumApplicationType.CLIENT,
        gatewayServerUri: undefined,
        discoveryProfileUri: undefined,
        discoveryUrls: []
    });

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

            var session = new OPCUASession(this);
            session.name = createSessionRequest.sessionName;

            session.sessionId           = response.sessionId;
            session.authenticationToken = response.authenticationToken;
            session.timeout             = response.revisedSessionTimeout;
            session.serverNonce         = response.serverNonce;
            session.serverCertificate   = response.serverCertificate;
            session.serverSignature     = response.serverSignature;

            self._sessions.push(session);

            callback(null,session);

        } else {

            callback(err,null);
        }
    });


};
/**
 *
 * @param session
 */
OPCUAClient.prototype.closeSession = function(session) {
    //todo : send close session on securechannel
    var index = this._sessions.indexOf(session);
    if (index >=0 ) {
        this._sessions.splice(index, 1);
    }
};

/**
 * disconnect client from server
 * @param callback
 */
OPCUAClient.prototype.disconnect = function(callback) {

    if (this._secureChannel) {
        this._secureChannel.close(callback);
    } else {
        callback();
    }

};

exports.OPCUAClient = OPCUAClient;

