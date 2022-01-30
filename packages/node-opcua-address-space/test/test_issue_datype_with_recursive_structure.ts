import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Loading nodeset.xml with recursive DataType", () => {
    it("should load a custom ExtensionObject", async () => {
        const addressSpace = AddressSpace.create();

        const example = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_recursive_structure.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, example]);
        const nsAcme = addressSpace.getNamespaceIndex("http://acme")
        const dataType = addressSpace.findDataType("WwMessageArgumentValueDataType", nsAcme)!;

        const extObj = addressSpace.constructExtensionObject(dataType,{
            switchField: 1,
            array: [{
                boolean:1,
            }, {
                uInt16:16
            }, 
            {
                array: [{
                    float:32
                },
                {
                    double:32
                }]
            }
        ]
        });
        console.log(extObj.toString());

        addressSpace.dispose();
    });
});
