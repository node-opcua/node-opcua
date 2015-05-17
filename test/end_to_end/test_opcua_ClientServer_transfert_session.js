require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog  = opcua.utils.make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


describe("testing session  transfer to different channel",function() {

    var server, temperatureVariableId, endpointUrl;

    before(function (done) {

        resourceLeakDetector.start();
        server = build_server_with_temperature_device({ port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });

    });

    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
        done();
    });

    after(function (done) {
        server.shutdown(function() {
            resourceLeakDetector.stop();
            done();
        });
    });

    it("RQB1 - calling CreateSession and CloseSession - CloseSession should return BadSessionNotActivated",function(done) {
            var client1;
            var session1;
            async.series([

            function(callback) {
                client1 = new OPCUAClient();
                client1.connect(endpointUrl,callback)
            },
            // create a session using client1
            function(callback) {
                client1._createSession(function(err,session) {
                    if (err) {
                        return callback(err);
                    }
                    session1 = session;
                    callback();
                });
            },

            function(callback) {
                client1._closeSession(session1,function(err) {
                    err.message.should.match(/BadSessionNotActivated/);
                    callback();
                });
            },

            //// activate the session as expected on same channel used to create it
            //function(callback) {
            //    client1._activateSession(session1,function(err){
            //        callback(err);
            //    });
            //},
            //
            function(callback) {
                client1.disconnect(callback);
            }

        ],done);

    });

    it("RQB2 - calling CloseSession without calling CreateSession first",function(done) {
        var client1;
        var session1;
        async.series([

            function(callback) {
                client1 = new OPCUAClient();
                client1.connect(endpointUrl,callback)
            },
            function(callback) {
                var request = new opcua.session_service.CloseSessionRequest({
                    deleteSubscriptions: true
                });
                client1.performMessageTransaction(request,function(err,response){
                    //err.message.should.match(/BadSessionIdInvalid/);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionIdInvalid);
                    callback();
                });
            },
            function(callback) {
                client1.disconnect(callback);
            }
        ],done);

    });

    it("RQB3 - calling CreateSession,  CloseSession  and CloseSession again" ,function(done) {
        var client1;
        var session1;
        async.series([

            function(callback) {
                client1 = new OPCUAClient();
                client1.connect(endpointUrl,callback)
            },
            // create a session using client1
            function(callback) {
                client1._createSession(function(err,session) {
                    if (err) { return callback(err);}
                    session1 = session;
                    callback();
                });
            },

            // first call to close session should be OK
            function(callback) {
                client1._closeSession(session1,function(err) {
                    err.message.should.match(/BadSessionNotActivated/);
                    callback();
                });
            },
            // second call to close session should raise an error
            function(callback) {
                var request = new opcua.session_service.CloseSessionRequest({
                    deleteSubscriptions: true
                });
                client1.performMessageTransaction(request,function(err,response){
                    //err.message.should.match(/BadSessionIdInvalid/);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionIdInvalid);
                    callback();
                });
            },

            function(callback) {
                client1.disconnect(callback);
            }

        ],function final(err){
            client1.disconnect(function() {
                done(err);
            });
        });

    });

    it("RQ0 - call ActiveSession on a session that has been transfered to a different channel",function(done){

        // this test verifies that the following requirement can be met
        // OpcUA 1.02 part 3 $5.5 Secure Channel Set page 20
        // Once a  Client  has established a  Session  it may wish to access the  Session  from a different
        // SecureChannel. The Client can do this by validating the new  SecureChannel  with the
        // ActivateSession  Service  described in 5.6.3.
        var client1,client2;
        var session1;
        async.series([

            // create a first channel (client1)
            function(callback) {
                client1 = new OPCUAClient();
                client1.connect(endpointUrl,callback)
            },
            // create a session using client1
            function(callback) {
                client1._createSession(function(err,session) {
                    if (err) { return callback(err);}
                         session1 = session;
                    callback();
                });
            },
            // activate the session as expected on same channel used to create it
            function(callback) {
                client1._activateSession(session1,function(err){
                    callback(err);
                });
            },

            // let verify that it is now possible to send a request on client1's session
            function(callback) {
                // coerce nodeIds
                var request = new opcua.read_service.ReadRequest({
                    nodesToRead: [{nodeId : "i=2255",attributeId: 13}],
                    maxAge: 0,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Both
                });
                request.requestHeader.authenticationToken = session1.authenticationToken;
                client1.performMessageTransaction(request, function (err, response) {
                    response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                    callback();
                });
            },

            // create a second channel (client2)
            function(callback) {
                client2 = new OPCUAClient();
                client2.connect(endpointUrl,callback)
            },
            function(callback) {
                // reactivate session on second channel
                client2.reactivateSession(session1,function(err){
                    callback(err);
                });
            },

            // now that session has been assigned to client 1,
            // server shall refuse any requests on channel1
            function(callback) {
                // coerce nodeIds
                var request = new opcua.read_service.ReadRequest({
                    nodesToRead: [{nodeId : "i=2255",attributeId: 13}],
                    maxAge: 0,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Both
                });
                request.requestHeader.authenticationToken = session1.authenticationToken;
                client1.performMessageTransaction(request, function (err, response) {
                    if (!err) {
                        response.responseHeader.serviceResult.should.eql(StatusCodes.BadSecureChannelIdInvalid);
                    }
                    callback(err);
                });
            },

            // terminate
            function(callback) {
                client2.disconnect(callback);
            },
            function(callback) {
                client1.disconnect(callback);
            }

        ],done);
    });

    // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
    // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
    // if the  SecureChannel  is not same as the one associated with the  CreateSession  request.
    it("RQ1 - should reject if the channel used to activate the session for the first time is not the same as the channel used to create the session",function(done){

        var client1,client2;
        var session1;
        async.series([

            // create a first channel (client1)
            function(callback) {
                server.getChannels().length.should.equal(0);
                client1 = new OPCUAClient();
                client1.connect(endpointUrl,callback)
            },
            // create a session using client1
            function(callback) {
                client1._createSession(function(err,session) {
                    if (err) { return callback(err);}
                    session1 = session;
                    server.getChannels().length.should.equal(1);
                    callback();
                });
            },
            // create a second channel (client2)
            function(callback) {
                client2 = new OPCUAClient();
                client2.connect(endpointUrl,callback)
            },

            // activate the session created with client1 using client2 !!
            // this should be detected by server and server shall return an error
            function(callback) {
                server.getChannels().length.should.equal(2);
                console.log(" ID1 =",client1._secureChannel.channelId);
                console.log(" ID2 =",client2._secureChannel.channelId);

                client2.reactivateSession(session1,function(err){

                    if (!err) {
                        callback(new Error("_activateSession shall return an error "));
                    }
                    err.message.should.match(/BadSessionNotActivated/);
                    callback();
                });
            },

            // terminate
            function(callback) {
                client2.disconnect(callback);
            },
            function(callback) {
                client1.disconnect(callback);
            }

        ],done);
    });


    var path = require("path");
    var fs = require("fs");
    function m(file) {

        var p = path.join("../../",file);
        p = path.join(__dirname,p);
        if (!fs.existsSync(p)) {
            console.log(" cannot find ",p);
        }
        return p;
    }
    var crypto_utils = require("lib/misc/crypto_utils");
    if (!crypto_utils.isFullySupported()) {
        console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
    } else {
        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // Subsequent calls to  ActivateSession  may be associated with different  SecureChannels.  If this is the
        // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
        // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.
        it("RQ2 -server should raise an error if a existing session is reactivated from a channel that have different certificate than the original channel", function (done) {

            var serverCertificate = server.getCertificate();

            var client1, client2;
            var session1;
            async.series([

                // create a first channel (client1)
                function (callback) {
                    console.log(" creating initial channel with some certificate");
                    var certificateFile1 = m("certificates/client_cert_1024.pem");
                    var privateKeyFile1 = m("certificates/client_key_1024.pem");
                    client1 = new OPCUAClient({
                        certificateFile: certificateFile1,
                        privateKeyFile: privateKeyFile1,
                        securityMode: opcua.MessageSecurityMode.SIGN,
                        securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
                        serverCertificate: serverCertificate
                    });
                    client1.connect(endpointUrl, callback)
                },
                // create a session using client1
                function (callback) {
                    console.log(" create session");
                    client1._createSession(function (err, session) {
                        if (err) {
                            return callback(err);
                        }
                        session1 = session;
                        callback();
                    });
                },
                // activate the session as expected on same channel used to create it
                function (callback) {
                    console.log(" activate session");
                    client1._activateSession(session1, function (err) {
                        callback(err);
                    });
                },

                // create a second channel (client2)
                // with a different certificate ....
                function (callback) {

                    // creating second channel with different credential
                    console.log(" creating second channel with different certificate");
                    var certificateFile2 = m("certificates/client_cert_2048.pem");
                    var privateKeyFile2 = m("certificates/client_key_2048.pem");
                    client2 = new OPCUAClient({
                        certificateFile: certificateFile2,
                        privateKeyFile: privateKeyFile2,
                        securityMode: opcua.MessageSecurityMode.SIGN,
                        securityPolicy: opcua.SecurityPolicy.Basic256,
                        serverCertificate: serverCertificate
                    });
                    client2.connect(endpointUrl, callback);

                },
                function (callback) {
                    // reactivate session on second channel
                    // Reactivate should fail because certificate is not the same as the original one
                    client2.reactivateSession(session1, function (err) {
                        if (err) {
                            err.message.should.match(/BadNoValidCertificates/);
                            callback();
                        } else {
                            callback(new Error("expecting reactivateSession to fail"));
                        }
                    });
                },
                // terminate
                function (callback) {
                    client2.disconnect(callback);
                },
                function (callback) {
                    client1.disconnect(callback);
                }

            ], done);

        });
    }

    // In addition,the Server shall verify that the  Client  supplied a  UserIdentityToken  that is   identical to the token
    // currently associated with the  Session.
    it("RQ3 - server should raise an error if a session is reactivated with different user identity tokens",function(done){
        async.series([


        ],done);

    });
    // Once the Server accepts the new  SecureChannel  it shall reject requests sent via the old  SecureChannel.
    it("RQ4 - server should reject request send via old channel when session has been transfered to new channel",function(done){
        async.series([


        ],done);

    });
});

