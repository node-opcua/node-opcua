import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Enum with negative values #937", () => {
    it("should load a nodeset.xml file containing enums with negative values", async () => {
        const addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            path.join(__dirname, "../test_helpers/test_fixtures/issue937_min_enum.nodeset2.xml")
        ]);
        addressSpace.dispose();
    });
    it("should load a nodeset.xml file containing enums with negative values", async () => {
        const addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            path.join(__dirname, "../test_helpers/test_fixtures/issue937_max_enum.nodeset2.xml")
        ]);
        addressSpace.dispose();
    });
});
