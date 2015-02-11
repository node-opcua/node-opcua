require("requirish")._(module);
// http://opcfoundation.org/UA/SecurityPolicy#Basic256


var opcua = require(".");

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var path = require("path");

var utils = opcua.utils;

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);


var _ = require("underscore");

var port = 2222;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var start_simple_server = require("./helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("./helpers/external_server_fixture").stop_simple_server;


var server, temperatureVariableId, endpointUrl, serverCertificate;
function start_inner_server_local(options,callback) {
    // Given a server that have a signed end point

    options = options || {};
    options.port = options.port || port;

    server = build_server_with_temperature_device(options, function () {

        var data = {};
        data.endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        data.serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
        data.temperatureVariableId = server.temperatureVariableId;
        data.server = server;
        callback(null, data);
    });
}

function stop_inner_server_local(data, callback) {
    var server = data.server;
    server.currentChannelCount.should.equal(0);
    server.shutdown(callback);
}


function start_server1(options,callback) {
    // Given a server that have a signed end point
    start_simple_server(options,function (err, data) {
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
 * returns the number of security token exchange on the server
 * since the server started, performed by any endpoints.
 * @param server
 * @returns {Number}
 */
function get_server_channel_security_token_change_count(server) {
    var sessions = _.values(server.engine._sessions);
    sessions.length.should.eql(1);

    var count =  server.endpoints.reduce(function(accumulated,endpoint){
        return accumulated + endpoint.securityTokenCount;
    },0);

    return count;

}

function stop_server1(data, callback) {
    stop_simple_server(data, callback);
}

function start_server(options,callback) {
    if (_.isFunction(options) && !callback) {
        callback = options; options =null;
    }
    // Given a server that have a signed end point
    start_inner_server_local(options,function (err, data) {
        if (err) {
            return callback(err, null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = data.temperatureVariableId;
        callback(null, data);
    });
}

var start_server_with_1024bits_certificate = function(callback) {
    var options = {};
    start_server(options,callback);
};

var start_server_with_2048bits_certificate = function(callback) {

    var path = require("path");
    var server_certificate256_pem_file = path.join(__dirname,"helpers/demo_client_cert256.pem");
    var server_certificate256_privatekey_file = path.join(__dirname,"helpers/demo_client_key256.pem");

    var options = {
        certificateFile: server_certificate256_pem_file,
        privateKeyFile:  server_certificate256_privatekey_file
    };
    start_server(options,callback);
};


function stop_server(data, callback) {
    stop_inner_server_local(data, callback);
}
//xx start_server=start_server1;
//xx stop_server=stop_server1;

var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;

function keep_monitoring_some_variable(session,  duration, done) {

    assert(session instanceof ClientSession);

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
        setTimeout(function () {
            subscription.terminate();
        }, duration);
    });

    subscription.on("internal_error", function (err) {
        //xx console.log("xxx internal error in ClientSubscription".red,err.message);
        the_error = err;
    });
    subscription.on("terminated", function () {

        if (!the_error) {
            var nbTokenId = get_server_channel_security_token_change_count(server) - nbTokenId_before_server_side;
            nbTokenId.should.be.greaterThan(2);
        }

        done(the_error);
    });
}


var default_test_duration = 1200;

var crypto_utils = require("lib/misc/crypto_utils");
if (!crypto_utils.isFullySupported()) {
       console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
} else {


    describe("testing Secure Client-Server communication", function () {


        this.timeout(10000);

        var serverHandle, client;
        before(function (done) {
            start_server(function (err, handle) {
                serverHandle = handle;
                done(err);
            })
        });
        after(function (done) {
            stop_server(serverHandle, function () {
                done();
            });
        });

        it("a client shall be able to establish a SIGNED connection with a server", function (done) {


            should(serverCertificate).not.equal(null);

            var options = {
                securityMode: opcua.MessageSecurityMode.SIGN,
                securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
                serverCertificate: serverCertificate
            };
            client = new OPCUAClient(options);
            perform_operation_on_client_session(client, endpointUrl, function (session, done) {
                done();
            }, done);

        });

        it("a client shall be able to establish a SIGN&ENCRYPT connection with a server ", function (done) {

            should(serverCertificate).not.equal(null);

            var options = {
                securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
                securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
                serverCertificate: serverCertificate
            };
            client = new OPCUAClient(options);
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                inner_done();
            }, done);

        });

        it("a token shall be updated on a regular basis", function (done) {

            var options = {
                securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
                securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
                serverCertificate: serverCertificate,
                defaultSecureTokenLifetime: 100
            };

            var token_change = 0;
            client = new OPCUAClient(options);
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                keep_monitoring_some_variable(session, default_test_duration, function () {
                    token_change.should.be.greaterThan(10);
                    inner_done();
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


    var ClientSecureChannelLayer = require("lib/client/client_secure_channel_layer").ClientSecureChannelLayer;

    function common_test(securityPolicy, securityMode, options,done) {

        //xx console.log("securityPolicy = ", securityPolicy,"securityMode = ",securityMode);

        opcua.MessageSecurityMode.get(securityMode).should.not.eql(null, "expecting supporting");


        options = options|| {};
        options = _.extend(options,{
            securityMode: opcua.MessageSecurityMode.get(securityMode),
            securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
            serverCertificate: serverCertificate
        });

        options.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 200;
        // console.log("xxxx options.defaultSecureTokenLifetime",options.defaultSecureTokenLifetime);

        var token_change = 0;
        var client = new OPCUAClient(options);

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            keep_monitoring_some_variable(session, options.defaultSecureTokenLifetime * 5, function (err) {
                token_change.should.be.greaterThan(3);
                inner_done(err);
            });
        }, done);

        client.on("lifetime_75", function (token) {
            //xx console.log("received lifetime_75",JSON.stringify(token));
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
        });
        client.on("close", function () {
            //xx console.log(" connection has been closed");
        });
    }

    function check_open_secure_channel_fails(securityPolicy, securityMode, options,done) {

        options = options|| {};
        options = _.extend(options,{
            securityMode: opcua.MessageSecurityMode.get(securityMode),
            securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 200
        });
        var client = new OPCUAClient(options);
        client.connect(endpointUrl, function (err) {

            if (err) {
                console.log("Error = ", err.message);
                done();
            } else {
                client.disconnect(function () {
                    done(new Error("The connection succedeed, but was expected to fail!"));
                });
            }
        });
    }

    function common_test_expected_server_initiated_disconnection(securityPolicy, securityMode, done) {


        opcua.MessageSecurityMode.get(securityMode).should.not.eql(null, "expecting supporting");

        var options = {
            securityMode: opcua.MessageSecurityMode.get(securityMode),
            securityPolicy: opcua.SecurityPolicy.get(securityPolicy),
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 150
        };

        var token_change = 0;
        var client = new OPCUAClient(options);

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            keep_monitoring_some_variable(session,  default_test_duration, function (err) {
                inner_done(err);
            });
        }, function (err) {
            console.log(" RECEIVED ERROR :".yellow.bold, err);

            should(err).be.instanceOf(Error);
            done();
        });

        client.on("lifetime_75", function (token) {
            //xx console.log("received lifetime_75",JSON.stringify(token));
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
        });
        client.on("close", function () {
            console.log(" connection has been closed");
        });
    }

    describe("testing server behavior on secure connection ", function () {

        this.timeout(10000);

        var serverHandle, client;
        var old_method;

        before(function (done) {

            // let modify the client behavior so that _renew_security_token call is delayed by an amount of time
            // that should cause the server to worry about the token not to be renewed.
            old_method = ClientSecureChannelLayer.prototype._renew_security_token;

            ClientSecureChannelLayer.prototype._renew_security_token = function () {
                var self = this;
                setTimeout(function () {
                    old_method.call(self);
                }, 1500);
            };

            start_server(function (err, handle) {
                serverHandle = handle;
                done(err);
            })
        });
        after(function (done) {

            ClientSecureChannelLayer.prototype._renew_security_token = old_method;

            stop_server(serverHandle, done);
        });

        it("server shall shutdown the connection if client doesn't renew security token on time", function (done) {

            common_test_expected_server_initiated_disconnection(opcua.SecurityPolicy.Basic128Rsa15, opcua.MessageSecurityMode.SIGN, done);
        });

    });


    function perform_collection_of_test_with_client_configuration(message,options) {

        it('Basic128Rsa15 with Sign  ' + message, function (done) {
            common_test("Basic128Rsa15", "SIGN", options,done);
        });

        it('Basic128Rsa15 with Sign ' + message, function (done) {
            common_test("Basic128Rsa15", "SIGN", options,done);
        });

        it('Basic128Rsa15 with SignAndEncrypt ' + message, function (done) {
            common_test("Basic128Rsa15", "SIGNANDENCRYPT", options, done);
        });

        it('Basic256 with Sign ' + message, function (done) {
            common_test("Basic256", "SIGN",  options,done);
        });

        it('Basic256 with SignAndEncrypt ' + message, function (done) {
            common_test("Basic256", "SIGNANDENCRYPT", options, done);
        });

        it('Basic256Rsa15 with Sign ' + message, function (done) {
            check_open_secure_channel_fails("Basic256Rsa15", "SIGN",  options,done);
        });

        it('Basic256Rsa15 with SignAndEncrypt ' + message, function (done) {
            check_open_secure_channel_fails("Basic256Rsa15", "SIGNANDENCRYPT",  options,done);
        });
    }

    function perform_collection_of_test_with_various_client_configuration(prefix) {

        prefix = prefix || "" ;
        var client_certificate256_pem_file = path.join(__dirname,"helpers/demo_client_cert256.pem");
        var client_certificate256_privatekey_file = path.join(__dirname,"helpers/demo_client_key256.pem");

        var options = {
            certificateFile: client_certificate256_pem_file,
            privateKeyFile:  client_certificate256_privatekey_file
        };
        perform_collection_of_test_with_client_configuration(prefix +"(2048 bits certificate on client)",options);
        perform_collection_of_test_with_client_configuration(prefix +"(1024 bits certificate on client)",null);


    }

    describe("testing Security Policy with a valid 1024 bit certificate on server", function () {

        this.timeout(10000);

        var serverHandle;

        before(function (done) {
            start_server_with_1024bits_certificate(function (err, handle) {
                serverHandle = handle;
                done(err);
            })
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

    describe("testing Security Policy with a valid 2048 bit certificate on server", function () {

        this.timeout(20000);

        var serverHandle;

        before(function (done) {
            start_server_with_2048bits_certificate(function (err, handle) {
                serverHandle = handle;
                done(err);
            })
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
}
