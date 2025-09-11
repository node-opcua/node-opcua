
import should from "should";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import {
    AddressSpace, Namespace, UADataType,

} from "..";
import { _getBasicDataTypeFromDataTypeNodeId } from "../src/get_basic_datatype";
import { getMiniAddressSpace } from "../testHelpers";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { coerceNodeId } from "node-opcua-nodeid";

describe("Testing UAVariable changeDataType", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();

        addressSpace.getNamespaceArray().length.should.eql(2);
        namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);
    });
    after(() => {
        addressSpace.dispose();
    });

    [
        { from: "UInt32", to: "Int32", value: 42, },
        { from: "UInt32", to: "Int32", value: [42, 23] },
        { from: DataType.Null, to: DataType.ExtensionObject, value: null, },
        { from: "i=0", to: "i=22", value: null, },
    ].map((test, index) => {
        it(`test-${index} should change dataType of a UAVariable from ${test.from} to ${test.to}`, () => {

            const fromDataTypeNode = addressSpace.findDataType(test.from)!;
            fromDataTypeNode && should(fromDataTypeNode).be.instanceOf(Object);

            const fromDataTypeNodeId = fromDataTypeNode?.nodeId || coerceNodeId(0);

            const fromDataType = _getBasicDataTypeFromDataTypeNodeId(addressSpace, fromDataTypeNodeId);

            const toDataTypeNode = addressSpace.findDataType(test.to)!;
            const toDataType = _getBasicDataTypeFromDataTypeNodeId(addressSpace, toDataTypeNode.nodeId);

            const variable = namespace.addVariable({
                browseName: `MyVariable${index}`,
                dataType: test.from,
                value: { dataType: fromDataType, value: test.value },
                organizedBy: addressSpace.rootFolder.objects
            });

            variable.dataType.toString().should.eql(fromDataTypeNodeId.toString());
            const valueBefore: Variant = variable.readValue().value;

            variable.changeDataType(toDataType);


            variable.dataType.toString().should.eql(toDataTypeNode.nodeId.toString());
            const valueAfter: Variant = variable.readValue().value;
            valueAfter.dataType.should.eql(toDataType);
            if (valueAfter.arrayType === VariantArrayType.Array) {
                valueAfter.arrayType.should.eql(VariantArrayType.Array);
            } else {
                should(valueAfter.value).eql(test.value);
            }
        })
    });
}); 
