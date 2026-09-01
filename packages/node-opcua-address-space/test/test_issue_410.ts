import type { Double } from "node-opcua-basic-types";
import { DataTypeIds } from "node-opcua-constants";
import { standardUnits } from "node-opcua-data-access";
import { DataValue, type DataValueT } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, SessionContext, type UAAnalogItem } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

describe("AnalogDataItem ValuePrecision issue #410", () => {
    const nodesetFilename = nodesets.standard;

    let addressSpace: AddressSpace;
    let analogItem: UAAnalogItem<number, DataType.Double>;

    before(async () => {
        addressSpace = AddressSpace.create();

        const namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);

        await generateAddressSpace(addressSpace, nodesetFilename);
        const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

        analogItem = namespace.addAnalogDataItem({
            browseName: "TemperatureSensor",
            dataType: "Double",
            definition: "(tempA -25) + tempB",
            engineeringUnits: standardUnits.degree_celsius,
            engineeringUnitsRange: { low: -2000, high: 2000 },
            instrumentRange: { low: -100, high: 200 },
            organizedBy: objectsFolder,
            value: new Variant({ dataType: DataType.Double, value: 10.0 }),
            valuePrecision: 0.5
        });
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("ValuePrecision should have a DataType Double", () => {
        should(analogItem.valuePrecision?.dataType).be.instanceOf(NodeId);
        should(analogItem.valuePrecision?.dataType).eql(resolveNodeId(DataTypeIds.Double));
    });
    it("ValuePrecision should be writable ", async () => {
        analogItem = analogItem!;

        const dataValue = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 0.25 })
        }) as DataValueT<Double, DataType.Double>;
        const context = SessionContext.defaultContext;
        const statusCode = await analogItem.valuePrecision?.writeValue(context, dataValue);
        should(statusCode).eql(StatusCodes.Good);
    });
});
