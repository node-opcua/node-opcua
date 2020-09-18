import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";

import { AddressSpace, UAVariable, promoteToMultiStateDiscrete, promoteToMultiStateValueDiscrete } from "../..";
import { generateAddressSpace } from "../../nodeJS";

describe("MultiStateValueDiscreteType - 2", () => {
    let addressSpace: AddressSpace;
    const data = { addressSpace: null as any };
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

    it("ZYZ-1 it should promoteToMultiStateValueDiscrete from an existing nodeset", async () => {
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

        should(() => {
            msvd.setValue("RedCRAP");
        }).throw();
        msvd.getValueAsNumber().should.eql(3);

        should(() => {
            msvd.setValue(12345);
        }).throw();
        msvd.getValueAsNumber().should.eql(3);
    });

    it("ZYZ-2 it should promoteToMultiStateDiscrete from an existing nodeset", async () => {
        const ns = addressSpace.getNamespaceIndex("mydemo/");

        const variable = addressSpace.findNode("ns=2;i=26001") as UAVariable;
        variable.browseName.toString().should.eql("2:VariableMultiStateDiscrete");

        const msd = promoteToMultiStateDiscrete(variable);

        msd.setValue(1);
        msd.getValueAsString().should.eql("Blue");
        msd.getValue().should.eql(1);

        msd.setValue(2);
        msd.getValueAsString().should.eql("Red");
        msd.getValue().should.eql(2);

        msd.setValue(3);
        msd.getValueAsString().should.eql("Yellow");
        msd.getValue().should.eql(3);

        msd.setValue("Purple");
        msd.getValueAsString().should.eql("Purple");
        msd.getValue().should.eql(4);

        msd.setValue("Red");
        msd.getValueAsString().should.eql("Red");
        msd.getValue().should.eql(2);

        msd.setValue("Blue");
        msd.getValueAsString().should.eql("Blue");
        msd.getValue().should.eql(1);

        should(() => {
            msd.setValue("Crap");
        }).throw();
        msd.getValue().should.eql(1);

        should(() => {
            msd.setValue("Crap");
        }).throw();
        msd.getValue().should.eql(1);

        should(function not_be_possible_to_set_an_invalid_numeric_value() {
            msd.setValue(42);
        }).throw();
        msd.getValue().should.eql(1);
    });
});
