// http://opcfoundation.org/UA/SecurityPolicy#Basic256


var opcua = require("../");
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");

var utils = opcua.utils;

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var SecurityPolicy = opcua.SecurityPolicy;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog  = opcua.utils.make_debugLog(__filename);


var _ = require("underscore");

var port = 2222;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;



var start_simple_server = require("./helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("./helpers/external_server_fixture").stop_simple_server;



var server,temperatureVariableId, endpointUrl,serverCertificate;
function start_inner_server_local(callback) {
    // Given a server that have a signed end point
    server = build_server_with_temperature_device({ port: port}, function () {

        var data = {}
        data.endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        data.serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
        data.temperatureVariableId = server.temperatureVariableId;
        data.server = server;
        callback(null,data);
    });
}

function stop_inner_server_local(data,callback) {
    var server  = data.server;
    server.currentChannelCount.should.equal(0);
    server.shutdown(callback);
}


function start_server1(callback) {
    // Given a server that have a signed end point
    start_simple_server(function(err,data){
        if (err) {
            return callback(err,null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = "ns=1;i=1";
        callback(null,data);
    });
}

function stop_server1(data,callback) {
    stop_simple_server(data,callback);
}

function start_server(callback) {
    // Given a server that have a signed end point
    start_inner_server_local(function(err,data){
        if (err) {
            return callback(err,null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = data.temperatureVariableId;
        callback(null,data);
    });
}

function stop_server(data,callback) {
    stop_inner_server_local(data,callback);
}
//xx start_server=start_server1;
//xx stop_server=stop_server1;

var OPCUASession = opcua.OPCUASession;
var ClientSubscription = opcua.ClientSubscription;

function keep_monitoring_some_variable(session,nodeIdToMonitor,duration,done) {

    assert(session instanceof OPCUASession);

    var subscription = new ClientSubscription(session, {
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 3,
        maxNotificationsPerPublish: 3,
        publishingEnabled: true,
        priority: 6
    });

    subscription.on("started", function () {
        setTimeout(function () {
            subscription.terminate();
        }, duration);
    });

    subscription.on("terminated", function () {
        done();
    });
}



describe("testing Secure Client-Server communication",function() {


    this.timeout(10000);

    var serverHandle, client;

    before(function (done) {
        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        })
    });
    after(function (done) {
        stop_server(serverHandle, function(){
            console.log("server is now shutdown");
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

            keep_monitoring_some_variable(session, null, 2000, function () {
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


var ClientSecureChannelLayer = require("../lib/client/client_secure_channel_layer").ClientSecureChannelLayer;

describe("testing server behavior on secure connection ",function(){

    this.timeout(10000);

    var serverHandle, client;
    var old_method;
    before(function (done) {

        // let modify the client behavior so that _renew_security_token call is delayed by an amount of time
        // that should cause the server to worry about the token not to be renewed.
        old_method = ClientSecureChannelLayer.prototype._renew_security_token;

        ClientSecureChannelLayer.prototype._renew_security_token = function() {
            var self = this;
            setTimeout(function(){ old_method.call(self); },1500);
        };


        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        })
    });
    after(function (done) {


        ClientSecureChannelLayer.prototype._renew_security_token= old_method;

        stop_server(serverHandle, done);
    });

    xit("ZZ server shall shutdown the connection if client doesn't renew security token on time",function(done){

        var options ={
            securityMode:      opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy:    opcua.SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 21
        };

        var token_change = 0;
        client = new OPCUAClient(options);

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {
            keep_monitoring_some_variable(session,null,2000,function() {
                token_change.should.be.greaterThan(1);
                done();
            });
        },done);

        client.on("lifetime_75",function(token){
            console.log("received lifetime_75",JSON.stringify(token));
        });
        client.on("security_token_renewed",function(){
            token_change+=1;
        });
        client.on("close",function(){
            console.log(" connection has been closed");
            done();
        });
    });

});
