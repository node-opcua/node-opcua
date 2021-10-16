import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import {
    AddressSpace,
    UAVariable,
    UAMultiStateValueDiscrete,
    UAMultiStateDiscrete,
    UAMultiStateValueDiscreteEx,
    UAMultiStateDiscreteEx
} from "../..";
import { generateAddressSpace } from "../../nodeJS";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("MultiStateValueDiscreteType - 2", () => {
    let addressSpace: AddressSpace;
    const data = { addressSpace: null as any };
    before(async () => {
        addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("MyPrivateNamespace");
        data.addressSpace = addressSpace;
        const xmlFiles = [
            nodesets.standard,
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

        const multiStateValueDiscreteVar = variable as UAMultiStateValueDiscreteEx<number, DataType.UInt32>;
        // no need tp promote explicitly anymore promoteToMultiStateValueDiscrete(variable);

        multiStateValueDiscreteVar.setValue(1);
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(1);
        multiStateValueDiscreteVar.getValueAsString().should.eql("Blue");

        multiStateValueDiscreteVar.setValue(3);
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(3);
        multiStateValueDiscreteVar.getValueAsString().should.eql("Red");

        multiStateValueDiscreteVar.setValue("Blue");
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(1);
        multiStateValueDiscreteVar.getValueAsString().should.eql("Blue");

        multiStateValueDiscreteVar.setValue("Red");
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(3);
        multiStateValueDiscreteVar.getValueAsString().should.eql("Red");

        should(() => {
            multiStateValueDiscreteVar.setValue("RedCRAP");
        }).throw();
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(3);

        should(() => {
            multiStateValueDiscreteVar.setValue(12345);
        }).throw();
        multiStateValueDiscreteVar.getValueAsNumber().should.eql(3);

        /// STANDARD READ
        multiStateValueDiscreteVar.readValue().value.value.should.eql(3);
        multiStateValueDiscreteVar.readValue().statusCode.should.eql(StatusCodes.Good);
    });

    it("ZYZ-2 it should promoteToMultiStateDiscrete from an existing nodeset", async () => {
        const ns = addressSpace.getNamespaceIndex("mydemo/");

        const variable = addressSpace.findNode("ns=2;i=26001") as UAVariable;
        variable.browseName.toString().should.eql("2:VariableMultiStateDiscrete");

        const multiStateDiscreteVar = variable as UAMultiStateDiscreteEx<number, DataType.UInt32>;
        // no need tp promote explicitly anymore promoteToMultiStateDiscrete(variable);

        multiStateDiscreteVar.setValue(1);
        multiStateDiscreteVar.getValueAsString().should.eql("Blue");
        multiStateDiscreteVar.getValue().should.eql(1);

        multiStateDiscreteVar.setValue(2);
        multiStateDiscreteVar.getValueAsString().should.eql("Red");
        multiStateDiscreteVar.getValue().should.eql(2);

        multiStateDiscreteVar.setValue(3);
        multiStateDiscreteVar.getValueAsString().should.eql("Yellow");
        multiStateDiscreteVar.getValue().should.eql(3);

        multiStateDiscreteVar.setValue("Purple");
        multiStateDiscreteVar.getValueAsString().should.eql("Purple");
        multiStateDiscreteVar.getValue().should.eql(4);

        multiStateDiscreteVar.setValue("Red");
        multiStateDiscreteVar.getValueAsString().should.eql("Red");
        multiStateDiscreteVar.getValue().should.eql(2);

        multiStateDiscreteVar.setValue("Blue");
        multiStateDiscreteVar.getValueAsString().should.eql("Blue");
        multiStateDiscreteVar.getValue().should.eql(1);

        should(() => {
            multiStateDiscreteVar.setValue("Crap");
        }).throw();
        multiStateDiscreteVar.getValue().should.eql(1);

        should(() => {
            multiStateDiscreteVar.setValue("Crap");
        }).throw();
        multiStateDiscreteVar.getValue().should.eql(1);

        should(function not_be_possible_to_set_an_invalid_numeric_value() {
            multiStateDiscreteVar.setValue(42);
        }).throw();
        multiStateDiscreteVar.getValue().should.eql(1);
    });
});
