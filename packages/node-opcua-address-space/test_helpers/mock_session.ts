import { ContinuationData, IContinuationPointInfo, IContinuationPointManager } from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { ReferenceDescription } from "node-opcua-service-browse";

export class MockContinuationPointManager implements IContinuationPointManager {
    public registerHistoryReadRaw(
        maxElements: number,
        dataValues: DataValue[],
        cnt: ContinuationData
    ): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public getNextHistoryReadRaw(numValues: number, cnt: ContinuationData): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public registerReferences(
        maxElements: number,
        values: ReferenceDescription[],
        cnt: ContinuationData
    ): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
    public getNextReferences(numValue: number, cnt: ContinuationData): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
}

export const mockSession = {
    getSessionId() {
        return new NodeId();
    },
    continuationPointManager: new MockContinuationPointManager()
};
