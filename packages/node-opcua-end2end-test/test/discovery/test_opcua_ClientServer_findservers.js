"use strict";
const async = require("async");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const port = 2000;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("DS5- testing OPCUA-Service Discovery Endpoint", function() {


    let server, client, temperatureVariableId, endpointUrl;

    before(function(done) {

        server = build_server_with_temperature_device({ port: port }, function(err) {
            if (err) { return done(err); }
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done) {
        client = OPCUAClient.create({});
        done();
    });

    afterEach(function(done) {
        done();
    });

    after(function(done) {
        setImmediate(function() {
            server.shutdown(done);
        });
    });

    function make_on_connected_client(functor, done) {

        let connected = false;
        const tasks = [
            function(callback) {
                client.connect(endpointUrl, function(err) {
                    connected = true;
                    callback(err);
                });
            },

            function(callback) {
                functor(client, callback);
            },

            function(callback) {
                client.disconnect(function(err) {
                    connected = false;
                    callback(err);
                });
            },
        ];
        async.series(tasks, function(err) {
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

    it("should answer a FindServers Request - without filters", function(done) {
        // Every  Server  shall provide a  Discovery Endpoint  that supports this  Service;   however, the  Server
        // shall only return a single record that describes itself.  Gateway Servers  shall return a record for each
        // Server  that they provide access to plus (optionally) a record that allows the  Gateway Server  to be
        // accessed as an ordinary OPC UA  Server.
        make_on_connected_client(function(client, callback) {

            client.findServers(function(err, servers) {
                if (!err) {
                    servers.length.should.eql(1);
                }
                callback(err);
            });
        }, done);

    });

    it("should answer a FindServers Request - with filters", function(done) {

        make_on_connected_client(function(client, callback) {

            const filters = {};
            client.findServers(filters, function(err, servers) {
                servers.length.should.eql(1);
                callback(err);
            });
        }, done);

    });

    it("should answer FindServers Request and apply serverUris filter", function(done) {

        make_on_connected_client(function(client, callback) {

            const filters = {
                serverUris: ["invalid server uri"]
            };

            client.findServers(filters, function(err, servers) {
                servers.length.should.eql(0);
                callback(err);
            });
        }, done);

    });

    it("should answer FindServers Request and apply endpointUri filter", function(done) {

        make_on_connected_client(function(client, callback) {

            const filters = {
                serverUris: ["invalid server uri"]
            };

            client.findServers(filters, function(err, servers) {
                servers.length.should.eql(0);
                callback(err);
            });
        }, done);

    });
});
