"use strict";
import path from "path";
import chalk from "chalk";
import { OPCUAClient, OPCUAServer, NodeId } from "node-opcua";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

interface TestOptions {
    server: OPCUAServer | null;
    endpointUrl: string | null;
    client: OPCUAClient | null;
    temperatureVariableId: NodeId | null;
}

function include_test(filename: string, options: TestOptions) {
    const test = require("./" + filename);
    test.register_test(options);
}

describe("COMPLIANCE TESTING", function () {
    const options: TestOptions = {
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
        await options.server!.shutdown();
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