"use strict";
const path = "../bin/node-opcua";
require(path + "test_compliance/helpers");
const chalk = require("chalk");

const { OPCUAClient } = require(path);

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

function include_test(filename, options) {
    const test = require("./" + filename);
    test.register_test(options);
}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("COMPLIANCE TESTING", function () {
    const options = {
        server: null,
        endpointUrl: null,
        client: null,
        temperatureVariableId: null
    };

    const port = 2234;
    before(async () => {
        console.log(chalk.yellow("\n INFO - building the server "));
        options.server = await build_server_with_temperature_device({ port: port, add_simulation: true });
        console.log(chalk.yellow("\n INFO - server built"));
        options.endpointUrl = options.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        options.temperatureVariableId = options.server.temperatureVariableId;

        options.client = OPCUAClient.create({});
    });

    after(async () => {
        options.client = null;
        await options.server.shutdown();
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
