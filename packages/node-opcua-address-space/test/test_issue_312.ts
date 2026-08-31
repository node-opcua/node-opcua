import fs from "node:fs";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { getFixture } from "node-opcua-test-fixtures";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

describe("Issue 132", function (this: Mocha.Context) {
    this.timeout(Math.max(40000, this.timeout()));

    let addressSpace: AddressSpace;

    beforeEach(() => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("#312 - should load a nodeset xml file containing MandatoryPlaceHolder f", async () => {
        const xml_file0 = getAddressSpaceFixture("mini.Nodeset2.xml");
        const xml_file1 = getFixture("fixture_issue_312_nodeset2.xml");

        fs.existsSync(xml_file0).should.be.eql(true);

        fs.existsSync(xml_file1).should.be.eql(true);

        const xml_files = [xml_file0, xml_file1];
        await generateAddressSpace(addressSpace, xml_files);
    });
});
