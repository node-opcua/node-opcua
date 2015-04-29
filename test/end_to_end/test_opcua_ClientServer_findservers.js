
require("requirish")._(module);

var _ = require("underscore");
var async= require("async");
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

describe("testing OPCUA-Service Discovery Endpoint",function() {

    var server, client, temperatureVariableId, endpointUrl;

    before(function (done) {

        server = build_server_with_temperature_device({port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        done();
    });

    after(function (done) {
       setImmediate(function(){
           server.shutdown(done);
       });
    });

    function make_on_connected_client(functor,done) {

        var connected = false;
        var tasks = [
            function (callback) {
                client.connect(endpointUrl, function(err) {
                    connected = true;
                    callback(err);
                });
            },

            function (callback) {
                functor(client, callback);
            },

            function (callback) {
                client.disconnect(function(err) {
                    connected = false;
                    callback(err);
                });
            },
        ];
        async.series(tasks,function(err) {
            if (connected) {
                client.disconnect(function(err) {
                    connected = false;
                    done(err);
                });
            } else {
                done(err);
            }
        });
    }

    it("should anwser a FindServers Request - without filters",function(done){
        // Every  Server  shall provide a  Discovery Endpoint  that supports this  Service;   however, the  Server
        // shall only return a single record that describes itself.  Gateway Servers  shall return a record for each
        // Server  that they provide access to plus (optionally) a record that allows the  Gateway Server  to be
        // accessed as an ordinary OPC UA  Server.
        make_on_connected_client(function(client,callback) {

            client.findServers(function(err,servers) {
                servers.length.should.eql(1);
                callback(err);
            });
        },done);

    });

    it("should anwser a FindServers Request - with filters",function(done){

        make_on_connected_client(function(client,callback) {

            var filters = {};
            client.findServers(filters ,function(err,servers) {
                servers.length.should.eql(1);
                callback(err);
            });
        },done);

    });
    it("should anwser FindServers Request and apply serverUris filter",function(done) {

        make_on_connected_client(function(client,callback) {

            var filters = {
                serverUris: ["invalid server uri"]
            };

            client.findServers(filters,
                function(err,servers) {
                    servers.length.should.eql(0);
                    callback(err);
                });
        },done);

    });


    it("should anwser FindServers Request and apply endpointUri filter",function(done) {

        make_on_connected_client(function(client,callback) {

            var filters = {
                serverUris: ["invalid server uri"]
            };

            client.findServers(filters,
                function(err,servers) {
                    servers.length.should.eql(0);
                    callback(err);
                });
        },done);

    });
});