import "should";

import { resolveNodeId, coerceNodeId } from "node-opcua-nodeid";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { nodesets } from "node-opcua-nodesets";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";

import { Namespace, PseudoSession } from "..";
import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue #1038", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let variable: UAVariable;
    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        await generateAddressSpace(addressSpace, xml_files);
        addressSpace.registerNamespace("Private");
        namespace = addressSpace.getOwnNamespace();

        variable = namespace.addVariable({
            browseName: "MyVariable",
            nodeId: "s=Variable",
            dataType: DataType.Double,
            arrayDimensions: [3, 4, 2]
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should be possible to create an object with a PseudoSession", async () => {
        const pseudoSession = new PseudoSession(addressSpace);

        const correctVariant = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [3, 4, 2],
            value: new Float64Array([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,

                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
            ])
        });
        const statusCode0 = await pseudoSession.write({
            nodeId: coerceNodeId("ns=1;s=Variable"),
            attributeId: AttributeIds.Value,
            value: {
                value: correctVariant
            }
        });

        statusCode0.should.eql(StatusCodes.Good);

        const faultyVariant = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [3, 4, 2],
            value: new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        });
        faultyVariant.value = new Float64Array([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
        ]);

        const statusCode1 = await pseudoSession.write({
            nodeId: coerceNodeId("ns=1;s=Variable"),
            attributeId: AttributeIds.Value,
            value: {
                value: faultyVariant
            }
        });
        statusCode1.should.eql(StatusCodes.BadInternalError);

        faultyVariant.dimensions = null;

        const statusCode2 = await pseudoSession.write({
            nodeId: coerceNodeId("ns=1;s=Variable"),
            attributeId: AttributeIds.Value,
            value: {
                value: faultyVariant
            }
        });
        statusCode2.should.eql(StatusCodes.BadInternalError);
    });
});
