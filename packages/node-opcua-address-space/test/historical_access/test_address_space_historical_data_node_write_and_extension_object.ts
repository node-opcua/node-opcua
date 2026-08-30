import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { type HistoryData, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { AddressSpace, type ContinuationPoint, ContinuationPointManager, SessionContext, type UAVariable } from "../..";
import { generateAddressSpace } from "../../nodeJS.js";
import { date_add } from "../../testHelpers.js";

// This test locks in that BOTH ways of feeding a value into a historized variable end up
// recorded in the historian:
//   - setValueFromSource (server side application code)
//   - writeValue         (client Write service)
// and that this works for scalar values AS WELL AS for (unbound) ExtensionObject values.
//
// Historically, setValueFromSource on a plain (unbound) ExtensionObject variable did not emit
// "value_changed", so nothing was historized unless the application also called touchValue().
describe("Testing Historical Data Node - write path and ExtensionObject", () => {
    const context = new SessionContext({
        session: {
            continuationPointManager: new ContinuationPointManager(),
            getSessionId: () => coerceNodeId(1)
        }
    });

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("MyPrivateNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });

    after(() => {
        addressSpace.dispose();
    });

    async function readAllHistory(node: UAVariable, today: Date): Promise<DataValue[]> {
        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 60 }),
            isReadModified: false,
            numValuesPerNode: 1000,
            returnBounds: false,
            startTime: date_add(today, { seconds: -60 })
        });
        const historyReadResult = await node.historyRead(context, historyReadDetails, null, null, {
            continuationPoint: null as ContinuationPoint | null
        });
        return (historyReadResult.historyData as HistoryData).dataValues || [];
    }

    it("HWX1 - setValueFromSource on a scalar variable is historized", async () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "ScalarSetValue",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node);

        const today = new Date();
        for (let i = 0; i < 3; i++) {
            node.setValueFromSource({ dataType: DataType.Double, value: i }, StatusCodes.Good, date_add(today, { seconds: i }));
        }

        const dataValues = await readAllHistory(node, today);
        dataValues.length.should.eql(3);
        dataValues.map((d) => d.value.value).should.eql([0, 1, 2]);
    });

    it("HWX2 - writeValue on a scalar variable is historized", async () => {
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "ScalarWriteValue",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double",
            accessLevel: "CurrentRead | CurrentWrite"
        });
        addressSpace.installHistoricalDataNode(node);

        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const statusCode = await node.writeValue(
                context,
                new DataValue({
                    value: { dataType: DataType.Double, value: i },
                    sourceTimestamp: date_add(today, { seconds: i })
                })
            );
            statusCode.should.eql(StatusCodes.Good);
        }

        const dataValues = await readAllHistory(node, today);
        dataValues.length.should.eql(3);
        dataValues.map((d) => d.value.value).should.eql([0, 1, 2]);
    });

    it("HWX3 - setValueFromSource on an (unbound) ExtensionObject variable is historized (no touchValue needed)", async () => {
        const rangeDataType = addressSpace.findDataType("Range")!;
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "ExtObjSetValue",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: rangeDataType
        });
        addressSpace.installHistoricalDataNode(node);

        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const range = addressSpace.constructExtensionObject(rangeDataType, { low: i, high: 10 + i });
            // NOTE: no touchValue() here - setValueFromSource must historize on its own
            node.setValueFromSource(
                { dataType: DataType.ExtensionObject, value: range },
                StatusCodes.Good,
                date_add(today, { seconds: i })
            );
        }

        const dataValues = await readAllHistory(node, today);
        dataValues.length.should.eql(3);
        for (let i = 0; i < 3; i++) {
            dataValues[i].value.dataType.should.eql(DataType.ExtensionObject);
            const range = dataValues[i].value.value as { low: number; high: number };
            range.low.should.eql(i);
            range.high.should.eql(10 + i);
        }
    });

    it("HWX4 - writeValue on an (unbound) ExtensionObject variable is historized", async () => {
        const rangeDataType = addressSpace.findDataType("Range")!;
        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "ExtObjWriteValue",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: rangeDataType,
            accessLevel: "CurrentRead | CurrentWrite"
        });
        addressSpace.installHistoricalDataNode(node);

        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const range = addressSpace.constructExtensionObject(rangeDataType, { low: i, high: 10 + i });
            const statusCode = await node.writeValue(
                context,
                new DataValue({
                    value: { dataType: DataType.ExtensionObject, value: range },
                    sourceTimestamp: date_add(today, { seconds: i })
                })
            );
            statusCode.should.eql(StatusCodes.Good);
        }

        const dataValues = await readAllHistory(node, today);
        dataValues.length.should.eql(3);
        for (let i = 0; i < 3; i++) {
            dataValues[i].value.dataType.should.eql(DataType.ExtensionObject);
            const range = dataValues[i].value.value as { low: number; high: number };
            range.low.should.eql(i);
            range.high.should.eql(10 + i);
        }
    });
});
