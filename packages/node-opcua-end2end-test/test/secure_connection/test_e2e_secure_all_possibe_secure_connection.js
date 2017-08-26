/*global: describe, require, it , before, after*/
"use strict";
// http://opcfoundation.org/UA/SecurityPolicy#Basic256
Error.stackTraceLimit = Infinity;

var should = require("should");
var sinon = require("sinon");
var path = require("path");
var fs = require("fs");
var _ = require("underscore");

var crypto = require("crypto");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var ClientSecureChannelLayer = require("node-opcua-client").ClientSecureChannelLayer;


var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var certificate_store = path.join(__dirname, "../../certificates");
fs.existsSync(certificate_store).should.eql(true, "expecting certificate store");

var port = 2225;

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var start_simple_server = require("../../test_helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("../../test_helpers/external_server_fixture").stop_simple_server;


var g_defaultSecureTokenLifetime = 500;
var g_cycleNumber = 3;
var g_defaultTestDuration = g_defaultSecureTokenLifetime * ( g_cycleNumber + 10);


var server, temperatureVariableId, endpointUrl, serverCertificate;

function start_inner_server_local(options, callback) {
    // Given a server that have a signed end point

    options = options || {};
    options.port = options.port || port;

    server = build_server_with_temperature_device(options, function (err) {
        if (err) {
            return callback(err);
        }
        var data = {};
        data.endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        data.serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
        data.temperatureVariableId = server.temperatureVariableId;
        data.server = server;
        callback(null, data);
    });
}

function stop_inner_server_local(data, callback) {
    try {
        if (data) {
            var server = data.server;

            // it is possible that server still have running session in this series of test, as we are testing
            // faulty client that do not renew token properly, causing server to abruptly drop the connection that
            // has become un-secured. We simply issue a warning rather than a exception if we find that currentSessionCount != 0
            if(server.engine.currentSessionCount !== 0 ) {
                console.log("stop_inner_server_local:  Warning all sessions should have been closed".yellow);
            }
            //xxx server.engine.currentSessionCount.should.equal(0, " all sessions should have been closed");
            //xxx server.currentChannelCount.should.equal(0, "All channel should have been closed");
            server.shutdown(callback);
        } else {
            callback();
        }
    } catch (err) {
        callback(err);
    }
}


function start_server1(options, callback) {
    // Given a server that have a signed end point
    start_simple_server(options, function (err, data) {
        if (err) {
            return callback(err, null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = "ns=1;i=1";
        callback(null, data);
    });
}


/**
 * returns the number of security token exchanged on the server
 * since the server started, performed by any endpoints.
 * @param server
 * @return {Number}
 */
function get_server_channel_security_token_change_count(server) {
    var sessions = _.values(server.engine._sessions);
    sessions.length.should.eql(1, "Expecting only one session on server at address " + server.endpointUri);
    var count = server.endpoints.reduce(function (accumulated, endpoint) {
        return accumulated + endpoint.securityTokenCount;
    }, 0);

    return count;

}

function stop_server1(data, callback) {
    stop_simple_server(data, callback);
}

function start_server(options, callback) {
    if (_.isFunction(options) && !callback) {
        callback = options;
        options = null;
    }
    // Given a server that have a signed end point
    start_inner_server_local(options, function (err, data) {
        if (err) {
            return callback(err, null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = data.temperatureVariableId;
        callback(null, data);
    });
}

var start_server_with_1024bits_certificate = function (callback) {
    var options = {};
    start_server(options, callback);
};

var start_server_with_2048bits_certificate = function (callback) {

    //var server_certificate256_pem_file = path.join(__dirname, "../fixtures/certs/demo_client_cert256.pem");
    //var server_certificate256_privatekey_file = path.join(__dirname, "../fixtures/certs/demo_client_key256.pem");

    var server_certificate256_pem_file = path.join(certificate_store, "server_cert_2048.pem");
    var server_certificate256_privatekey_file = path.join(certificate_store, "server_key_2048.pem");

    fs.existsSync(server_certificate256_pem_file).should.eql(true);
    fs.existsSync(server_certificate256_privatekey_file).should.eql(true);

    var options = {
        certificateFile: server_certificate256_pem_file,
        privateKeyFile: server_certificate256_privatekey_file
    };
    start_server(options, callback);
};


function stop_server(data, callback) {

    stop_inner_server_local(data, callback);
}

//xx start_server=start_server1;
//xx stop_server=stop_server1;

var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;

function keep_monitoring_some_variable(session, duration, done) {

    should(session).be.instanceof(ClientSession);

    var nbTokenId_before_server_side = get_server_channel_security_token_change_count(server);

    var subscription = new ClientSubscription(session, {
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 3,
        maxNotificationsPerPublish: 3,
        publishingEnabled: true,
        priority: 6
    });

    var the_error = null;
    subscription.on("started", function () {

        //xx console.log(" starting monitoring for ",duration," ms");
        setTimeout(function () {
            //xx console.log(" terminating subscription  ");
            subscription.terminate();
        }, duration);
    });

    subscription.on("internal_error", function (err) {
        debugLog("xxx internal error in ClientSubscription".red, err.message);
        the_error = err;
    });
    subscription.on("terminated", function () {

        debugLog("        subscription terminated ");
        if (!the_error) {
            var nbTokenId = get_server_channel_security_token_change_count(server) - nbTokenId_before_server_side;
            nbTokenId.should.be.greaterThan(2);
        }
        done(the_error);
    });
}


function common_test(securityPolicy, securityMode, options, done) {

    //xx console.log("securityPolicy = ", securityPolicy,"securityMode = ",securityMode);

    opcua.MessageSecurityMode.get(securityMode).should.not.eql(null, "expecting supporting");

    options = options || {};
    options = _.extend(options, {
        securityMode: opcua.MessageSecurityMode.get(securityMode),
        securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
        serverCertificate: serverCertificate
    });

    options.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || g_defaultSecureTokenLifetime;
    //xx console.log("xxxx options.defaultSecureTokenLifetime",options.defaultSecureTokenLifetime);

    var token_change = 0;
    var client = new OPCUAClient(options);

    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

        keep_monitoring_some_variable(session, options.defaultSecureTokenLifetime * 3, function (err) {
            token_change.should.be.greaterThan(2);
            inner_done(err);
        });
    }, done);

    client.on("lifetime_75", function (token) {
        debugLog("received lifetime_75", JSON.stringify(token));
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
    });
    client.on("close", function () {
        debugLog(" connection has been closed");
    });
}

function check_open_secure_channel_fails(securityPolicy, securityMode, options, done) {

    options = options || {};
    options = _.extend(options, {
        securityMode: opcua.MessageSecurityMode.get(securityMode),
        securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
        serverCertificate: serverCertificate,
        defaultSecureTokenLifetime: g_defaultSecureTokenLifetime
    });
    var client = new OPCUAClient(options);

    client.on("backoff", function (number, delay) {
        debugLog(" backoff attempt#", number, " retry in ", delay);
    });

    client.connect(endpointUrl, function (err) {

        if (err) {
            debugLog("Error = ", err.message);
            client.disconnect(function () {
                done();
            });

        } else {
            client.disconnect(function () {
                done(new Error("The connection's succeeded, but was expected to fail!"));
            });
        }
    });
}

function common_test_expected_server_initiated_disconnection(securityPolicy, securityMode, done) {


    opcua.MessageSecurityMode.get(securityMode).should.not.eql(null, "expecting a valid MessageSecurityMode");

    var fail_fast_connectivity_strategy = {
        maxRetry: 1,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0
    };
    var options = {
        securityMode: opcua.MessageSecurityMode.get(securityMode),
        securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
        serverCertificate: serverCertificate,
        defaultSecureTokenLifetime: g_defaultSecureTokenLifetime,

        connectionStrategy: fail_fast_connectivity_strategy
    };

    var token_change = 0;
    var client = new OPCUAClient(options);

    var after_reconnection_spy = new sinon.spy();
    var start_reconnection_spy = new sinon.spy();

    perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

        client.on("start_reconnection", start_reconnection_spy);
        client.on("after_reconnection", after_reconnection_spy);

        keep_monitoring_some_variable(session, g_defaultTestDuration, function (err) {
            console.log("err = ", err);
            // inner_done(err);
        });
        client.on("close", function () {
            debugLog("            connection has been closed");
            inner_done();
        });

    }, function (err) {

        debugLog(" RECEIVED ERROR :".yellow.bold, err);
        start_reconnection_spy.callCount.should.eql(1);
        //xx after_reconnection_spy.callCount.should.eql(1);
        should(err).be.instanceOf(Error);

        done();
    });

    client.on("backoff", function (number, delay) {
        console.log("backoff  attempt #".bgWhite.yellow,number, " retrying in ",delay/1000.0," seconds");
    });
    client.on("lifetime_75", function (token) {
        debugLog("            received lifetime_75", JSON.stringify(token));
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
    });
    client.on("close", function () {
        debugLog("            connection has been closed");
    });
}

function perform_collection_of_test_with_client_configuration(message, options) {

    it("should succeed with Basic128Rsa15 with Sign           " + message, function (done) {
        common_test("Basic128Rsa15", "SIGN", options, done);
    });

    it("should succeed with Basic128Rsa15 with Sign           " + message, function (done) {
        common_test("Basic128Rsa15", "SIGN", options, done);
    });

    it("should succeed with Basic128Rsa15 with SignAndEncrypt " + message, function (done) {
        common_test("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
    });

    it("should succeed with Basic256      with Sign           " + message, function (done) {
        common_test("Basic256", "SIGN", options, done);
    });

    it("should succeed with Basic256      with SignAndEncrypt " + message, function (done) {
        common_test("Basic256", "SIGNANDENCRYPT", options, done);
    });

    it("should fail    with Basic256Rsa15 with Sign           " + message, function (done) {
        check_open_secure_channel_fails("Basic256Rsa15", "SIGN", options, done);
    });

    it("should fail    with Basic256Rsa15 with SignAndEncrypt " + message, function (done) {
        check_open_secure_channel_fails("Basic256Rsa15", "SIGNANDENCRYPT", options, done);
    });
}

function perform_collection_of_test_with_various_client_configuration(prefix) {

    prefix = prefix || "";

    var client_certificate256_pem_file = path.join(certificate_store, "client_cert_2048.pem");
    var client_certificate256_privatekey_file = path.join(certificate_store, "client_key_2048.pem");
    fs.existsSync(client_certificate256_pem_file).should.eql(true);
    fs.existsSync(client_certificate256_privatekey_file).should.eql(true);

    var options = {
        certificateFile: client_certificate256_pem_file,
        privateKeyFile: client_certificate256_privatekey_file
    };
    perform_collection_of_test_with_client_configuration(prefix + "(2048 bits certificate on client)", options);
    perform_collection_of_test_with_client_configuration(prefix + "(1024 bits certificate on client)", null);

}


var crypto_utils = require("node-opcua-crypto").crypto_utils;
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
    return;
}

var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;
describe("ZZA- testing Secure Client-Server communication", function () {

    this.timeout(Math.max(this._timeout, 20001));

    var serverHandle, client;
    before(function (done) {
        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    it("QQQ1 a client shall be able to establish a SIGNED connection with a server", function (done) {


        should.exist(serverCertificate);
        server.currentChannelCount.should.equal(0);
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            inner_done();
        }, done);

    });

    it("QQQ2 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 1024 bit client certificate", function (done) {

        should.exist(serverCertificate);

        var options = {

            certificateFile: path.join(certificate_store, "client_selfsigned_cert_1024.pem"),
            privateKeyFile: path.join(certificate_store, "client_key_1024.pem"),

            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            inner_done();
        }, done);

    });

    it("QQQ3 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 2048 bit client certificate", function (done) {

        should.exist(serverCertificate);

        var options = {

            certificateFile: path.join(certificate_store, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(certificate_store, "client_key_2048.pem"),

            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            inner_done();
        }, done);

    });

    xit("QQQ4 server shall reject secure connection when client provides a nonce with the wrong length", function (done) {

        should.exist(serverCertificate);

        var options = {
            certificateFile: path.join(certificate_store, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(certificate_store, "client_key_2048.pem"),

            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);

        var old_performMessageTransaction = ClientSecureChannelLayer.prototype._performMessageTransaction;
        ClientSecureChannelLayer.prototype._performMessageTransaction = function (msgType, requestMessage, callback) {

            // let's alter the client Nonce,
            if (requestMessage.constructor.name === "OpenSecureChannelRequest") {
                requestMessage.clientNonce.length.should.eql(16);
                this.clientNonce = requestMessage.clientNonce = crypto.randomBytes(32);
                ClientSecureChannelLayer.prototype._performMessageTransaction = old_performMessageTransaction;
            }
            old_performMessageTransaction.call(this, msgType, requestMessage, callback);
        };

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            inner_done();
        }, function (err) {
            console.log(err.message);
            err.message.should.match(/BadSecurityModeRejected/);
            done();
        });

    });

    it("QQQ5 a token shall be updated on a regular basis", function (done) {

        var options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: g_defaultSecureTokenLifetime
        };

        var token_change = 0;
        client = new OPCUAClient(options);
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            keep_monitoring_some_variable(session, g_defaultTestDuration, function (err) {
                //xx console.log("end of Monitoring ")
                token_change.should.be.greaterThan(g_cycleNumber);
                inner_done(err);
            });
        }, done);

        client.on("lifetime_75", function (token) {
            //xx console.log("received lifetime_75", JSON.stringify(token));
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
            //xx console.log("security_token_renewed");
        });

    });
});

describe("ZZB- testing server behavior on secure connection ", function () {

    this.timeout(Math.max(this._timeout, 20002));

    var serverHandle;
    var old_method;
    var timerId  = null;
    before(function (done) {

        ClientSecureChannelLayer.prototype._renew_security_token.should.be.instanceOf(Function);
        // let modify the client behavior so that _renew_security_token call is delayed by an amount of time
        // that should cause the server to worry about the token not to be renewed.
        old_method = ClientSecureChannelLayer.prototype._renew_security_token;

        ClientSecureChannelLayer.prototype._renew_security_token = function () {
            if (timerId) {return;}
            var self = this;
            timerId = setTimeout(function () {
                timerId = null;
                old_method.call(self);
            }, 1500);
        };

        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        should(timerId).eql(null);
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }

        // restoring _renew_security_token
        ClientSecureChannelLayer.prototype._renew_security_token = old_method;
        debugLog(" Disconnecting server");

        stop_server(serverHandle, done);
    });

    it("server shall shutdown the connection if client doesn't renew security token on time", function (done) {

        var no_reconnect_connectivity_strategy = {
            maxRetry: 0, // NO RETRY !!!
            initialDelay: 100,
            maxDelay: 200,
            randomisationFactor: 0
        };
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: g_defaultSecureTokenLifetime,

            connectionStrategy: no_reconnect_connectivity_strategy
        };

        var token_change = 0;
        var client = new OPCUAClient(options);
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            keep_monitoring_some_variable(session, g_defaultTestDuration, function (err) {
                //xx console.log("end of Monitoring ")
                //xx token_change.should.be.greaterThan(g_cycleNumber);
                inner_done(err);
            });
        }, function(err) {

            // Server must have disconneced
            should.exist(err);
            err.message.should.match(/disconnected by third party/);
            done();

        });

        client.on("lifetime_75", function (token) {
            //xx console.log("received lifetime_75", JSON.stringify(token));
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
            //xx console.log("security_token_renewed");
        });

 //xx       common_test_expected_server_initiated_disconnection(opcua.SecurityPolicy.Basic128Rsa15, opcua.MessageSecurityMode.SIGN, done);
    });

});

describe("ZZC- testing Security Policy with a valid 1024 bit certificate on server", function () {

    this.timeout(Math.max(this._timeout, 20003));

    var serverHandle;

    before(function (done) {
        start_server_with_1024bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    perform_collection_of_test_with_various_client_configuration(" (1024 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", function (done) {

        var securityMode = "SIGN";
        var securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        check_open_secure_channel_fails(securityPolicy, securityMode, null, done);

    });
});

describe("ZZD- testing Security Policy with a valid 2048 bit certificate on server", function () {

    this.timeout(Math.max(this._timeout, 20004));

    var serverHandle;

    before(function (done) {
        start_server_with_2048bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });


    perform_collection_of_test_with_various_client_configuration(" (2048 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", function (done) {

        var securityMode = "SIGN";
        var securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        check_open_secure_channel_fails(securityPolicy, securityMode, null, done);

    });
});

describe("ZZE- testing with various client certificates", function () {

    this.timeout(Math.max(this._timeout, 20005));

    var serverHandle;

    before(function (done) {
        start_server_with_1024bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    var client_privatekey_file = path.join(certificate_store, "client_key_1024.pem");

    var client_certificate_ok = path.join(certificate_store, "client_cert_1024.pem");
    var client_certificate_out_of_date = path.join(certificate_store, "client_cert_1024_outofdate.pem");
    var client_certificate_not_active_yet = path.join(certificate_store, "client_cert_1024_not_active_yet.pem");
    var client_certificate_revoked = path.join(certificate_store, "client_cert_1024_revoked.pem");

    it("Server should allow a client with a valid certificate to connect", function (done) {

        var options = {
            certificateFile: client_certificate_ok,
            privateKeyFile: client_privatekey_file
        };
        common_test("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
    });

    it("Server should not allow a client with a out of date certificate to connect", function (done) {

        var options = {
            certificateFile: client_certificate_out_of_date,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
    });

    it("Server should not allow a client to connect when the certificate is not active yet", function (done) {

        var options = {
            certificateFile: client_certificate_not_active_yet,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
    });

    xit("Server should not allow a client to connect with a revoked certificate", function (done) {
        // todo : implement a mechanism in server code to check certificate against CRL ( Certificate Revocation List)
        var options = {
            certificateFile: client_certificate_revoked,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
    });


});
