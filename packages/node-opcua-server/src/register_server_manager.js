const assert = require("node-opcua-assert").assert;
const async = require("async");
const EventEmitter = require("events").EventEmitter;
const util = require("util");
const _ = require("underscore");

const discovery_service = require("node-opcua-service-discovery");
const RegisterServerRequest = discovery_service.RegisterServerRequest;
const RegisterServerResponse = discovery_service.RegisterServerResponse;
const RegisterServer2Request = discovery_service.RegisterServer2Request;
const RegisterServer2Response = discovery_service.RegisterServer2Response;

const OPCUAClientBase = require("node-opcua-client").OPCUAClientBase;
const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

const Enum = require("node-opcua-enum");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);

const RegisterServerManagerStatus = new Enum({
    INACTIVE: 1,
    INITIALIZING: 2,
    REGISTERING: 3,
    WAITING: 4,
    UNREGISTERING: 5
});
const g_DefaultRegistrationServerTimeout = 8 * 60 * 1000; // 8 minutes

/**
 * RegisterServerManager is responsible to Register an opcua server on a LDS or LDS-ME server
 * This class takes in charge :
 *  - the initial registration of a server
 *  - the regular registration renewal (every 8 minutes or so ...)
 *  - dealing with cases where LDS is not up and running when server starts.
 *    ( in this case the connection will be continuously attempted using the infinite
 *    back-off strategy
 *  - the un-registration of the server ( during shutdown for instance)
 *
 * Events:
 *
 * Emitted when the server is trying to registered the LDS
 * but when the connection to the lds has failed
 * serverRegistrationPending is sent when the backoff signal of the
 * connection process is rained
 * @event serverRegistrationPending
 *
 * emitted when the server is successfully registered to the LDS
 * @event serverRegistered
 *
 * emitted when the server has successfully renewed its registration to the LDS
 * @event serverRegistrationRenewed
 *
 * emitted when the server is successfully unregistered to the LDS
 * ( for instance during shutdown)
 * @event serverUnregistered
 *
 *
 * (LDS => Local Discovery Server)
 * @param options
 * @param options.server {OPCUAServer}
 * @param options.discoveryServerEndpointUrl {String}
 * @constructor
 */
function RegisterServerManager(options) {

    EventEmitter.call(this);

    const self = this;
    self.server = options.server;
    self._setState(RegisterServerManagerStatus.INACTIVE);
    self.timeout = g_DefaultRegistrationServerTimeout;
    self.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl
        || "opc.tcp://localhost:4840";

    assert(typeof self.discoveryServerEndpointUrl === "string");
    self._registrationTimerId = null;
}
util.inherits(RegisterServerManager, EventEmitter);

RegisterServerManager.prototype.dispose = function () {
    const self = this;
    self.server = null;
    debugLog("RegisterServerManager#dispose", self.state.toString());
    assert(self.state === RegisterServerManagerStatus.INACTIVE);
    assert(self._registrationTimerId === null, "stop has not been called");
    self.removeAllListeners();
};

function securityPolicyLevel(securityPolicy) {
    switch (securityPolicy) {
        case SecurityPolicy.None.value:
            return 0;
        case SecurityPolicy.Basic128.value:
            return 0;
        case SecurityPolicy.Basic128Rsa15.value:
            return 0;
        case SecurityPolicy.Basic192.value:
            return 1;
        case SecurityPolicy.Basic192Rsa15.value:
            return 2;
        case SecurityPolicy.Basic256.value:
            return 3;
        case SecurityPolicy.Basic256Rsa15.value:
            return 3;
        case SecurityPolicy.Basic256Sha256.value:
            return 3;
        default:
            return 0;
    }
}

function sortEndpointBySecurityLevel(endpoints) {

    endpoints.sort((a, b) => {
        if (a.securityMode.value === b.securityMode.value) {
            if (a.securityPolicyUri === b.securityPolicyUri) {
                return a.securityLevel < b.securityLevel;
            } else {
                return securityPolicyLevel(a.securityPolicyUri) < securityPolicyLevel(b.securityPolicyUri);
            }
        } else {
            return a.securityMode.value < b.securityMode.value;
        }
    });
    return endpoints;
}

function findSecureEndpoint(endpoints) {

    // we only care about binary tcp transport endpoint
    endpoints = endpoints.filter(function (e) {
        return e.transportProfileUri === "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";
    });

    let endpoint = endpoints.filter(function (e) {
        return e.securityMode === MessageSecurityMode.SIGNANDENCRYPT;
    });

    if (endpoint.length === 0) {
        endpoint = endpoints.filter(function (e) {
            return e.securityMode === MessageSecurityMode.SIGN;
        });
    }
    if (endpoint.length === 0) {
        endpoint = endpoints.filter(function (e) {
            return e.securityMode === MessageSecurityMode.NONE;
        });
    }
    endpoint = sortEndpointBySecurityLevel(endpoint);
    return endpoint[0];
}


RegisterServerManager.prototype._emitEvent= function(eventName){
    const self = this;
    setImmediate(function() {
        self.emit(eventName);
    });
};

RegisterServerManager.prototype._setState = function(status){
    const self = this;
    const previousState = self.state || "";
    debugLog("RegisterServerManager#setState : => ",status.toString()," was ",previousState.toString());
    //xx console.log((new Error()).stack);
    self.state = status;
};

RegisterServerManager.prototype.start = function (callback) {

    debugLog("RegisterServerManager#start");
    const self = this;
    if (self.state !== RegisterServerManagerStatus.INACTIVE) {
        return callback(new Error("RegisterServer process already started")); // already started
    }

    // perform initial registration + automatic renewal
    self._establish_initial_connection(function (err) {

        if (err) {
            debugLog("RegisterServerManager#start => _establish_initial_connection has failed");
            return callback(err);
        }

        self._setState(RegisterServerManagerStatus.REGISTERING);

        self._registerServer(true, function (err) {

            if (self.state !== RegisterServerManagerStatus.REGISTERING) {
                debugLog("RegisterServerManager#start )=> Registration has been cancelled");
                return callback(new Error("Registration has been cancelled"));
            }

            if (err) {
                debugLog("RegisterServerManager#start - registering server has failed ! please check that your server certificate is accepted by the LDS");
                self._emitEvent("serverRegistrationFailure");
            } else {
                self._emitEvent("serverRegistered");
                self._setState(RegisterServerManagerStatus.WAITING);
                self._trigger_next();
            }
            callback();
        });
    });
};

RegisterServerManager.prototype._establish_initial_connection = function (outer_callback) {

    debugLog("RegisterServerManager#_establish_initial_connection");

    const self = this;
    assert(!self._registration_client);
    assert(typeof self.discoveryServerEndpointUrl === "string");
    assert(self.state === RegisterServerManagerStatus.INACTIVE);
    self._setState(RegisterServerManagerStatus.INITIALIZING);
    self.selectedEndpoint = null;

    // Retry Strategy must be set
    let client = new OPCUAClientBase({
        clientName: "RegistrationClient-1",
        certificateFile: self.server.certificateFile,
        privateKeyFile: self.server.privateKeyFile,
        connectionStrategy: infinite_connectivity_strategy,
    });

    self._registration_client = client;

    client.on("backoff", function (number, delay) {
        debugLog("RegisterServerManager - received backoff");
        console.log("contacting discovery server backoff  attempt #".bgWhite.yellow, number, " retrying in ", delay / 1000.0, " seconds");
        self._emitEvent("serverRegistrationPending");
    });

    async.series([

        function do_initial_connection_with_discovery_server(callback) {
            client.connect(self.discoveryServerEndpointUrl, function(err){
                if (err) {
                    debugLog("RegisterServerManager#_establish_initial_connection : initial connection to server has failed");
                   //xx debugLog(err);
                }
                return callback(err);
            });
        },

        function getEndpoints_on_discovery_server(callback) {
            client.getEndpoints(function (err, endpoints) {
                if (!err) {
                    const endpoint = findSecureEndpoint(endpoints);
                    assert(endpoint);
                    if (endpoint.serverCertificate) {
                        assert(endpoint.serverCertificate);
                        self.selectedEndpoint = endpoint;
                    } else {
                        self.selectedEndpoint = null;
                    }
                } else {
                    debugLog("RegisterServerManager#_establish_initial_connection : getEndpointsRequest has failed");
                    debugLog(err);
                }
                callback(err);
            });
        },
        function closing_discovery_server_connection(callback) {
            self._server_endpoints = client._server_endpoints;
            client.disconnect(function(err) {
                client = null;
                callback(err);
            });
        },
        function wait_a_little_bit(callback) {
            setTimeout(callback, 100);
        },
    ], function (err) {

        debugLog("-------------------------------",!!err);

        self._registration_client = null;
        if (self.state !== RegisterServerManagerStatus.INITIALIZING) {
            debugLog("RegisterServerManager#_establish_initial_connection has been interrupted");
            self._setState(RegisterServerManagerStatus.INACTIVE);
            if (client) {
                client.disconnect(function(err) {
                    client = null;
                    outer_callback(new Error("Initialization has been canceled"));
                });
            }else {
                outer_callback(new Error("Initialization has been canceled"));
            }
            return;
        }
        if (err) {
            self._setState(RegisterServerManagerStatus.INACTIVE);
            client.disconnect(function(err1) {
                self._registration_client = null;
                debugLog("#######",!!err1);
                outer_callback(err);
            });
        } else {
            outer_callback();
        }
    });
};

RegisterServerManager.prototype._trigger_next = function () {

    const self = this;
    assert(!self._registrationTimerId);
    // from spec 1.04 part 4:
    // The registration process is designed to be platform independent, robust and able to minimize
    // problems created by configuration errors. For that reason, Servers shall register themselves more
    // than once.
    //     Under normal conditions, manually launched Servers shall periodically register with the Discovery
    // Server as long as they are able to receive connections from Clients. If a Server goes offline then it
    // shall register itself once more and indicate that it is going offline. The registration frequency
    // should be configurable; however, the maximum is 10 minutes. If an error occurs during registration
    // (e.g. the Discovery Server is not running) then the Server shall periodically re-attempt registration.
    //     The frequency of these attempts should start at 1 second but gradually increase until the
    // registration frequency is the same as what it would be if no errors occurred. The recommended
    // approach would be to double the period of each attempt until reaching the maximum.
    //     When an automatically launched Server (or its install program) registers with the Discovery Server
    // it shall provide a path to a semaphore file which the Discovery Server can use to determine if the
    //     Server has been uninstalled from the machine. The Discovery Server shall have read access to
    // the file system that contains the file

    // install a registration
    debugLog("RegisterServerManager#_trigger_next : installing timeout to perform registerServer renewal (timeout =",self.timeout,")");
    self._registrationTimerId = setTimeout(function () {

        if (!self._registrationTimerId) {
            debugLog("RegisterServerManager => cancelling re registration");
            return;
        }
        self._registrationTimerId = null;

        debugLog("RegisterServerManager#_trigger_next : renewing RegisterServer");
        self._registerServer(true,function (err) {
            if (self.state !== RegisterServerManagerStatus.INACTIVE && self.state !== RegisterServerManagerStatus.UNREGISTERING) {
                debugLog("RegisterServerManager#_trigger_next : renewed !",err);
                self._setState(RegisterServerManagerStatus.WAITING);
                self._emitEvent("serverRegistrationRenewed");
                self._trigger_next();
            }
        });
    }, self.timeout);

};

RegisterServerManager.prototype._cancel_pending_client_if_any = function (callback) {

    debugLog("RegisterServerManager#_cancel_pending_client_if_any");

    const self = this;
    if (self._registration_client) {
        debugLog("RegisterServerManager#_cancel_pending_client_if_any => wee need to disconnection _registration_client");
        self._registration_client.disconnect(function () {
            self._registration_client = null;
            self._cancel_pending_client_if_any(callback);
        });
    } else {
        debugLog("RegisterServerManager#_cancel_pending_client_if_any : done");
        callback();
    }
};

RegisterServerManager.prototype.stop = function (outer_callback) {

    debugLog("RegisterServerManager#stop");

    const self = this;


    if (self._registrationTimerId) {
        debugLog("RegisterServerManager#stop :clearing timeout");
        clearTimeout(self._registrationTimerId);
        self._registrationTimerId = null;
    }

    self._cancel_pending_client_if_any(function (err) {
        debugLog("RegisterServerManager#stop :clearing timeout");

        if(!self.selectedEndpoint || self.state === RegisterServerManagerStatus.INACTIVE){
            self.state = RegisterServerManagerStatus.INACTIVE;
            assert(self._registrationTimerId === null);
            return outer_callback();
        }

        if (err) {
            self._setState(RegisterServerManagerStatus.INACTIVE);
            return outer_callback(err);
        }
        self._registerServer(false, function() {
            self._setState(RegisterServerManagerStatus.INACTIVE);
            self._emitEvent("serverUnregistered");
            outer_callback(err);
        });
    });
};

function constructRegisterServerRequest(server, isOnline) {

    const discoveryUrls = server.getDiscoveryUrls();
    assert(!isOnline || discoveryUrls.length >= 1,"expecting some discoveryUrls if we go online ....");

    const request = new RegisterServerRequest({

        server: {
            // The globally unique identifier for the Server instance. The serverUri matches
            // the applicationUri from the ApplicationDescription defined in 7.1.
            serverUri: server.serverInfo.applicationUri,

            // The globally unique identifier for the Server product.
            productUri: server.serverInfo.productUri,
            serverNames: [
                {locale: "en", text: server.serverInfo.productName}
            ],
            serverType: server.serverType,
            gatewayServerUri: null,
            discoveryUrls: discoveryUrls,
            semaphoreFilePath: null,
            isOnline: isOnline
        }
    });

    return request;
}


function constructRegisterServer2Request(server, isOnline) {

    const discoveryUrls = server.getDiscoveryUrls();
    assert(!isOnline || discoveryUrls.length >= 1,"expecting some discoveryUrls if we go online ....");

    const request = new RegisterServer2Request({

        server: {
            // The globally unique identifier for the Server instance. The serverUri matches
            // the applicationUri from the ApplicationDescription defined in 7.1.
            serverUri: server.serverInfo.applicationUri,

            // The globally unique identifier for the Server product.
            productUri: server.serverInfo.productUri,
            serverNames: [
                {locale: "en", text: server.serverInfo.productName}
            ],
            serverType: server.serverType,
            gatewayServerUri: null,
            discoveryUrls: discoveryUrls,
            semaphoreFilePath: null,
            isOnline: isOnline
        },
        serverCapabilities: new discovery_service.MdnsDiscoveryConfiguration({
            mdnsServerName: server.serverInfo.applicationUri,
            serverCapabilities: server.capabilitiesForMDNS
        })
    });

    return request;
}


const no_reconnect_connectivity_strategy = {
    maxRetry: 1, // NO RETRY !!!
    initialDelay: 2000,
    maxDelay: 50000,
    randomisationFactor: 0
};
const infinite_connectivity_strategy = {
    maxRetry: 10000000,
    initialDelay: 2000,
    maxDelay: 50000,
    randomisationFactor: 0
};


function sendRegisterServerRequest(self,client,isOnline,callback) {

    // try to send a RegisterServer2Request
    const request = constructRegisterServer2Request(self.server, isOnline);
    client.performMessageTransaction(request, function (err, response) {
        if (!err) {
            // RegisterServerResponse
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has succeeded (isOnline",isOnline,")");
            assert(response instanceof RegisterServer2Response);
            callback(err);
        } else {
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has failed (isOnline",isOnline,")");
            debugLog("RegisterServerManager#_registerServer falling back to using sendRegisterServerRequest instead");
            // fall back to
            const request = constructRegisterServerRequest(self.server, isOnline);
            //xx console.log("request",request.toString());
            client.performMessageTransaction(request, function (err, response) {
                if(!err) {
                    debugLog("RegisterServerManager#_registerServer sendRegisterServerRequest has succeeded (isOnline",isOnline,")");
                    assert(response instanceof RegisterServerResponse);
                } else{
                    debugLog("RegisterServerManager#_registerServer sendRegisterServerRequest has failed (isOnline",isOnline,")");
                }
                callback(err);
            });
        }
    });
}

/**
 *
 * @param isOnline      {Boolean}
 * @param outer_callback {Function}
 * @private
 */
RegisterServerManager.prototype._registerServer = function(isOnline, outer_callback)
{
    assert(_.isFunction(outer_callback));
    const self = this;

    debugLog("RegisterServerManager#_registerServer isOnline:",isOnline,"seleectedEndpoint: ",self.selectedEndpoint.endpointUrl);
    assert(self.selectedEndpoint || "must have a selected endpoint => please call _establish_initial_connection");
    assert(self.server.serverType, " must have a valid server Type");
    assert(self.discoveryServerEndpointUrl);

    // construct connection
    const server = this.server;
    const selectedEndpoint = self.selectedEndpoint;

    if (!selectedEndpoint) {
        console.log("Warning : cannot register server - no endpoint avaialble");
        return outer_callback(new Error("Cannot registerServer"));
    }

    const options = {
        securityMode: selectedEndpoint.securityMode,
        securityPolicy: SecurityPolicy.get(selectedEndpoint.securityPolicyUri),
        serverCertificate: selectedEndpoint.serverCertificate,
        certificateFile: server.certificateFile,
        privateKeyFile: server.privateKeyFile,
        connectionStrategy: no_reconnect_connectivity_strategy,
        clientName: "RegistrationClient-2"
    };

    const tmp = self._server_endpoints;

    let client = new OPCUAClientBase(options);
    client._server_endpoints = tmp;
    server._registration_client = client;

    const theStatus =isOnline ? RegisterServerManagerStatus.REGISTERING :RegisterServerManagerStatus.UNREGISTERING;
    self._setState(theStatus);

    debugLog("                      lds endpoint uri : ",selectedEndpoint.endpointUrl);

    async.series([
        function establish_connection_with_lds(callback) {
            client.connect(selectedEndpoint.endpointUrl, function (err) {

                if (err) {
                    debugLog("RegisterServerManager#_registerServer connection to client has failed");
                    debugLog("RegisterServerManager#_registerServer  => please check that you server certificate is trusted by the LDS");
                    //xx debugLog(options);
                    client.disconnect(function () {
                        debugLog("RegisterServerManager#_registerServer client disconnected");
                        callback(err);
                    });


                //     if (false) {
                //
                //         // try anonymous connection then
                //         const options = {
                //             securityMode: MessageSecurityMode.NONE,
                //             securityPolicy: SecurityPolicy.None,
                //             serverCertificate: selectedEndpoint.serverCertificate,
                //             certificateFile: server.certificateFile,
                //             privateKeyFile: server.privateKeyFile
                //         };
                //         debugLog("RegisterServerManager#_registerServer trying with no security");
                //
                //         client = new OPCUAClientBase(options);
                //         client._server_endpoints = tmp;
                //         server._registration_client = client;
                //
                //         client.connect(selectedEndpoint.endpointUrl, function (err) {
                //
                //             if (err) {
                //                 console.log(" cannot register server to discovery server " + self.discoveryServerEndpointUrl);
                //                 console.log("   " + err.message);
                //                 console.log(" make sure discovery server is up and running.");
                //                 console.log(" also, make sure that discovery server is accepting and trusting server certificate.");
                //                 console.log(" endpoint  = ", selectedEndpoint.toString());
                //                 console.log(" certificateFile ", server.certificateFile);
                //                 console.log("privateKeyFile   ", server.privateKeyFile);
                //                 client.disconnect(function () {
                //                     callback(err);
                //                 });
                //                 return;
                //             }
                //             return callback();
                //         });
                //         }
                } else {
                    callback();
                }
            });
        },
        function (callback) {
            sendRegisterServerRequest(self,client,isOnline, function (err) {
                callback(err);
            });
        },
        function close_connection_with_lds(callback) {
            client.disconnect(callback);
        }
    ], function (err) {

        debugLog("RegisterServerManager#_registerServer end (isOnline",isOnline,")");
        server._registration_client = null;
        outer_callback(err);
    });
};

exports.RegisterServerManager = RegisterServerManager;
