import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import type { WriteValueOptions } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, SessionContext, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const context = SessionContext.defaultContext;

describe("testing the StatusCode returned when a Variable write is rejected", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/WriteStatusCodes/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should reject a Value write with BadUserAccessDenied when UserAccessLevel withholds CurrentWrite", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "RestrictedToRead",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead",
            value: { dataType: DataType.Double, value: 0 }
        }) as UAVariable;

        const dataValue = new DataValue({ value: { dataType: DataType.Double, value: 42 } });
        const statusCode = await variable.writeValue(context, dataValue);
        // AccessLevel allows the write in general; it is this user's UserAccessLevel that
        // forbids it here, which is an access decision, not "writing is unsupported".
        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });

    it("should keep refusing a variant type that does not fit, whatever was written before", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "DoubleOnly",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            value: { dataType: DataType.Double, value: 0 }
        }) as UAVariable;
        const write = (dataType: DataType, value: unknown) =>
            variable.writeValue(context, new DataValue({ value: { dataType, value } }));
        // a type that fits, then one that does not, twice: an accepted type must not open the door to another
        for (let k = 0; k < 2; k++) {
            should(await write(DataType.Double, 1.5 + k)).eql(StatusCodes.Good);
            should(await write(DataType.String, "not a number")).eql(StatusCodes.BadTypeMismatch);
        }
    });

    it("should check a variant type again once the DataType of the Variable has changed", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "NumberThenInteger",
            dataType: "Number",
            organizedBy: addressSpace.rootFolder.objects,
            value: { dataType: DataType.Double, value: 0 }
        }) as UAVariable;
        const write = (dataType: DataType, value: unknown) =>
            variable.writeValue(context, new DataValue({ value: { dataType, value } }));
        should(await write(DataType.Double, 2.5)).eql(StatusCodes.Good);
        // Number and Integer are abstract: only the DataType check tells that a Double is not an Integer
        (variable as { dataType: NodeId }).dataType = resolveNodeId("Integer");
        should(await write(DataType.Double, 3.5)).eql(StatusCodes.BadTypeMismatch);
        should(await write(DataType.Int32, 3)).eql(StatusCodes.Good);
    });

    it("should reject a Historizing write with BadNotWritable when the node has no HA Configuration", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "NotHistorized",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            value: { dataType: DataType.Double, value: 0 }
        }) as UAVariable;
        should(variable.getChildByName("HA Configuration")).eql(null);

        const writeValue: WriteValueOptions = {
            attributeId: AttributeIds.Historizing,
            value: { value: { dataType: DataType.Boolean, value: true } }
        };
        const statusCode = await variable.writeAttribute(context, writeValue);
        // Historizing is a real attribute of a Variable; nothing about this node makes the
        // attribute inapplicable (that would be BadAttributeIdInvalid), it just cannot be
        // turned on without an HA Configuration.
        statusCode.should.eql(StatusCodes.BadNotWritable);
    });
});
