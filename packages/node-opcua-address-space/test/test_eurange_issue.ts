import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { AttributeIds } from "node-opcua-basic-types";

import { AddressSpace, UAVariable, UAVariableType } from "..";
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

    it("should instatiate a VariableType that has a  valid Range as a value, and the same value should appear in the instiated variable", () => {
        const type = addressSpace.findVariableType("MyType", 1) as UAVariableType;

        const dataValueFromType = type.readAttribute(null, AttributeIds.Value);
        console.log(dataValueFromType.toString());

        const variable = type.instantiate({
            browseName: "Type",
            componentOf: addressSpace.rootFolder.objects.server
        });
        const dataValue = variable.readAttribute(null, AttributeIds.Value);
        console.log(dataValue.toString());

        dataValue.value.toString().should.eql(dataValueFromType.value.toString());

    });
});
