"use strict";
var path = "../bin/node-opcua";
require(path+"test_compliance/helpers");

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

function include_test(filename, options) {
    var test = require("./" + filename);
    test.register_test(options);
}
var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;

describe("COMPLIANCE TESTING", function () {

    var options = {
        server: null,
        endpointUrl: null,
        client: null,
        temperatureVariableId: null
    };

    var port = 2234;
    before(function (done) {
        console.log("\n INFO - building the server ".yellow);
        options.server = build_server_with_temperature_device({ port: port, add_simulation: true}, function (err) {
            console.log("\n INFO - server built".yellow);
            options.endpointUrl = options.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            options.temperatureVariableId = options.server.temperatureVariableId;

            options.client = new OPCUAClient();

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
        options.client = null;
        options.server.shutdown(done);
    });

    describe("Address Space Model", function () {
        include_test("address_space_model/address_space_user_write_access_ERR_001.js", options);
    });

    describe("Attribute_Services", function () {
        include_test("attribute_services/attribute_read/024.js", options);
    });

    describe("Discovery_Services", function () {
        include_test("discovery_services/find_servers_self/001.js", options);
    });
});

