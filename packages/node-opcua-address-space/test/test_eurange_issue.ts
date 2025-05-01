import path from "path";
import should from  "should";

import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { AttributeIds } from "node-opcua-basic-types";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("Testing EURange Issue", async function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace();
        const mynodeset = path.join(__dirname, "../test_helpers/test_fixtures/eurange_issue.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, mynodeset]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should instantiate a VariableType that has a  valid Range as a value, and the same value should appear in the instantiated variable", () => {
        const variableType = addressSpace.findVariableType("MyVariableType", 1)!;
        
        // console.log(variableType.toString());

        const dataValueFromType = variableType.readAttribute(null, AttributeIds.Value);
        doDebug && console.log(dataValueFromType.toString());

        const variable = variableType.instantiate({
            browseName: "MyVariable",
            componentOf: addressSpace.rootFolder.objects.server
        });
        const dataValue = variable.readAttribute(null, AttributeIds.Value);
        doDebug && console.log(dataValue.toString());

        dataValue.value.toString().should.eql(dataValueFromType.value.toString());
    });
    it("should instantiate a Object that has a property containing valid Range as a value, and the same value should appear in the instantiated object", () => {
        const objectType = addressSpace.findObjectType("MyObjectType", 1)!;
        should.exists(objectType);
        doDebug && console.log("objectType\n",objectType.toString());

        const dataValueFromType = objectType.getChildByName("Range")!.readAttribute(null, AttributeIds.Value);
        doDebug && console.log(dataValueFromType.toString());

        const object = objectType.instantiate({
            browseName: "MyObject",
            componentOf: addressSpace.rootFolder.objects.server
        });
        const dataValue = object.getChildByName("Range")!.readAttribute(null, AttributeIds.Value);
        doDebug && console.log("dataValue=\n",dataValue.toString());

        dataValue.value.toString().should.eql(dataValueFromType.value.toString());
    });
});
