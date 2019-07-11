import * as fs from "fs";
import * as mocha from "mocha";
import * as path from "path";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import { AddressSpace, generateAddressSpace, UAVariable } from "../../source";
import { promoteToMultiStateValueDiscrete } from "../../src/data_access/ua_mutlistate_value_discrete";

describe("MultiStateValueDiscreteType - 2", () => {

    let addressSpace: AddressSpace;
    const data  = { addressSpace: null as any  };
    before(async () => {
        addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("MyPrivateNamespace");
        data.addressSpace = addressSpace;
        const xmlFiles = [
            nodesets.standard_nodeset_file,
            path.join(__dirname, "../../test_helpers/test_fixtures/mini.nodeset.withVariousVariables.xml")
        ];
        fs.existsSync(xmlFiles[0]).should.eql(true);
        await generateAddressSpace(addressSpace, xmlFiles);

    });

    after(() => {
        addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("ZYZ3 it should promoteToMultiStateValueDiscrete from an existing nodeset", async () => {

        const ns = addressSpace.getNamespaceIndex("mydemo/");

        const variable = addressSpace.findNode("ns=2;i=16003") as UAVariable;
        variable.browseName.toString().should.eql("2:VariableMultiStateValueDiscrete");

        const msvd = promoteToMultiStateValueDiscrete(variable);

        msvd._getDataType().should.eql(DataType.Int32);
        Object.keys(msvd._enumValueIndex()).length.should.eql(3);

        msvd.setValue(1);
        msvd.getValueAsNumber().should.eql(1);
        msvd.getValueAsString().should.eql("Blue");

        msvd.setValue(3);
        msvd.getValueAsNumber().should.eql(3);
        msvd.getValueAsString().should.eql("Red");

        msvd.setValue("Blue");
        msvd.getValueAsNumber().should.eql(1);
        msvd.getValueAsString().should.eql("Blue");

        msvd.setValue("Red");
        msvd.getValueAsNumber().should.eql(3);
        msvd.getValueAsString().should.eql("Red");

    });
});
