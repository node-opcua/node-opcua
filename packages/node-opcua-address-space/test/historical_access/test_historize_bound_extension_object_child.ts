import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { type HistoryData, ReadRawModifiedDetails } from "node-opcua-service-history";
import { DataType } from "node-opcua-variant";
import {
    AddressSpace,
    type ContinuationPoint,
    ContinuationPointManager,
    SessionContext,
    type UAObjectType,
    type UAVariable
} from "../../dist/api/index.js";
import { generateAddressSpace } from "../../nodeJS.js";
import { date_add } from "../../testHelpers.js";

// The user question: for a COMPLEX (bound) ExtensionObject variable that exposes its fields as
// child Variables through a JavaScript Proxy, does a single setValueFromSource on the PARENT
// cascade down to the child Variables, so that a historized child records the change?
//
// This exercises setExtensionObjectPartialValue() -> propagateTouchValueUpward/Downward().
describe("Testing Historical Data Node - cascade of a bound ExtensionObject to a historized child", () => {
    const context = new SessionContext({
        session: {
            continuationPointManager: new ContinuationPointManager(),
            getSessionId: () => coerceNodeId(1)
        }
    });

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.ia, nodesets.cnc]);
    });
    after(() => {
        addressSpace.dispose();
    });

    async function readAllHistory(node: UAVariable, today: Date): Promise<NonNullable<HistoryData["dataValues"]>> {
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

    it("HBX1 - setValueFromSource on the bound parent cascades to a historized child variable", async () => {
        const nsCNC = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");
        const cncChannelType = addressSpace.findObjectType("CncChannelType", nsCNC) as UAObjectType;
        const channel = cncChannelType.instantiate({
            browseName: "MyChannelHBX1",
            organizedBy: addressSpace.rootFolder.objects
        });
        const cncPositionDataType = addressSpace.findDataType("CncPositionDataType", nsCNC)!;

        // parent = bound ExtensionObject variable, its fields are exposed as child variables
        const posTcpBcsX = channel.getComponentByName("PosTcpBcsX")! as UAVariable;
        const actPos = posTcpBcsX.getComponentByName("ActPos")! as UAVariable;

        // historize the CHILD, not the parent
        addressSpace.installHistoricalDataNode(actPos);

        const today = new Date();
        // three whole-object updates on the PARENT
        for (let i = 1; i <= 3; i++) {
            const extObj = addressSpace.constructExtensionObject(cncPositionDataType, {
                actPos: i * 10,
                cmdPos: i * 100,
                remDist: i * 1000
            });
            posTcpBcsX.setValueFromSource({ dataType: DataType.ExtensionObject, value: extObj });
        }

        // 1. the child variable must reflect the last cascaded value (cascade DOWN worked)
        actPos.readValue().value.value.should.eql(30);
        // and the parent aggregate is consistent too
        posTcpBcsX.readValue().value.value.actPos.should.eql(30);

        // 2. the historized child must have recorded every cascaded change.
        //    The leading 0 is the child's initial value, captured at installHistoricalDataNode time;
        //    10, 20, 30 are the three values cascaded from the parent's setValueFromSource.
        const dataValues = await readAllHistory(actPos, today);
        dataValues.map((d) => d.value.value).should.eql([0, 10, 20, 30]);
    });
});
