import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
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
