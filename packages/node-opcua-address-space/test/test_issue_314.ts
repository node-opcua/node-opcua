import * as path from "path";
import * as fs from "fs";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";

import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing loading ExtensionObject value from NodeSet XML file", function (this: any) {
    this.timeout(20000); // could be slow on appveyor !

    let addressSpace: AddressSpace;

    beforeEach(() => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("#314 should load a EUInformation value from nodeset xml file", async () => {
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_analog_items.xml");
        fs.existsSync(xml_file).should.be.eql(true);

        const xml_files = [nodesets.standard, nodesets.di, xml_file];
        await generateAddressSpace(addressSpace, xml_files);

        const nodeId = "ns=2;i=6038";
        const node = addressSpace.findNode(nodeId)! as UAVariable;
        node.browseName.toString().should.eql("EngineeringUnits");

        const dataValue = node.readValue();
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);
        dataValue.value.value.constructor.name.should.eql("EUInformation");
        dataValue.value.value.namespaceUri.should.eql("http://www.opcfoundation.org/UA/units/un/cefact");
        dataValue.value.value.unitId.should.eql(5066068);
        dataValue.value.value.displayName.toString().should.eql("locale=null text=mm");
        dataValue.value.value.description.toString().should.eql("locale=meter text=millimetre");
    });
});
