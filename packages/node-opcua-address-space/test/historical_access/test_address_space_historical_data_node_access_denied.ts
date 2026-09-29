import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { type HistoryReadResult, ReadRawModifiedDetails } from "node-opcua-service-history";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import should from "should";
import {
    AddressSpace,
    type ContinuationData,
    ContinuationPointManager,
    SessionContext,
    type UAVariable
} from "../../dist/api/index.js";
import { generateAddressSpace } from "../../nodeJS.js";
import { date_add } from "../../testHelpers.js";

/** The internal entry point installHistoricalDataNode puts on the variable. */
interface HistoricalVariable {
    canUserReadHistory(context: SessionContext): boolean;
    _historyRead(
        context: SessionContext,
        historyReadDetails: ReadRawModifiedDetails,
        indexRange: null,
        dataEncoding: null,
        continuationData: ContinuationData,
        callback: (err: Error | null, result?: HistoryReadResult) => void
    ): void;
}

describe("Testing Historical Data Node, history read refused to the user", () => {
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

    it("HAD1- should answer BadUserAccessDenied once, without reading the history", async () => {
        const node: UAVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyAccessDeniedVar",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node);

        const today = new Date();
        node.setValueFromSource({ dataType: "Double", value: 42 }, StatusCodes.Good, today);

        const historicalNode = node as unknown as HistoricalVariable;
        historicalNode.canUserReadHistory = () => false;

        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 10 }),
            isReadModified: false,
            numValuesPerNode: 1000,
            returnBounds: false,
            startTime: date_add(today, { seconds: -10 })
        });

        const statusCodes: StatusCode[] = [];
        historicalNode._historyRead(context, historyReadDetails, null, null, { continuationPoint: null }, (err, result) => {
            should(err).eql(null);
            statusCodes.push(result?.statusCode ?? StatusCodes.BadInternalError);
        });

        // let any asynchronous second answer arrive before counting
        await new Promise((resolve) => setImmediate(resolve));

        should(statusCodes).eql([StatusCodes.BadUserAccessDenied]);
    });
});
