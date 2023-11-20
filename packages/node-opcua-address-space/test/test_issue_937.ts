import path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { BinaryStream } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";
import { AttributeIds, coerceInt64toInt32 } from "node-opcua-basic-types";
import { AddressSpace, UADataType, UAVariable } from "..";
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

    it("should load a nodeset.xml file containing EnumValues with negative values", async () => {
        const addressSpace = AddressSpace.create();

        const namespace = addressSpace.registerNamespace("own");

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            path.join(__dirname, "../test_helpers/test_fixtures/issue937_negative_enum_values.nodeset2.xml")
        ]);
        // console.log(addressSpace.getNamespaceArray().map((a) => a.namespaceUri));

        const nsA = addressSpace.getNamespaceIndex("http://A");

        const encodeDecodeDataValue = (value: DataValue) => {
            const stream = new BinaryStream(1000);
            value.encode(stream);
            stream.rewind();

            const dataValue = new DataValue();
            dataValue.decode(stream);
            dataValue.toString().should.eql(value.toString());
        };
        const uaDataType = addressSpace.findNode(`ns=${nsA};i=1001`)! as UADataType;

        const def = uaDataType.readAttribute(null, AttributeIds.DataTypeDefinition);

        coerceInt64toInt32(def.value.value.fields[0].value).should.eql(-1);
        encodeDecodeDataValue(def);
        console.log(def.toString());

        const uaVariable = addressSpace.findNode(`ns=${nsA};i=1002`)! as UAVariable;
        uaVariable.browseName.toString().should.eql("2:MyVariable");
        uaVariable.dataType.toString().should.eql("ns=2;i=1001");

        uaVariable.writeEnumValue("NotAvailable");

        const value = uaVariable.readValue();
        console.log(value.toString());

        encodeDecodeDataValue(value);

        addressSpace.dispose();
    });
});
