// tslint:disable:no-bitwise
import * as fs from "fs";
import * as path from "path";
import * as should from "should";
import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing NodeSet XML file loading special data structure", function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("should load a nodeset xml file", async () => {
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_qualifiedname.xml");

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
        
        const node = addressSpace.findNode("ns=1;i=1001") as UAVariable;

        should.exist(node);

        console.log(node.toString());
    });
});
