import {
    ContinuationStuff,
    IContinuationPointInfo,
    IContinuationPointInfo2,
    IContinuationPointManager
} from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { ReferenceDescription } from "node-opcua-service-browse";

export class MockContinuationPointManager implements IContinuationPointManager {
    public registerHistoryReadRaw(maxElements: number, dataValues: DataValue[], cnt: ContinuationStuff): IContinuationPointInfo2 {
        throw new Error("Method not implemented.");
    }
    public getNextHistoryReadRaw(numValues: number, cnt: ContinuationStuff): IContinuationPointInfo2 {
        throw new Error("Method not implemented.");
    }
    public register(maxElements: number, values: ReferenceDescription[]): IContinuationPointInfo {
        throw new Error("Method not implemented.");
    }
    public getNext(continuationPoint: Buffer): IContinuationPointInfo {
        throw new Error("Method not implemented.");
    }
    public cancel(continuationPoint: Buffer): IContinuationPointInfo {
        throw new Error("Method not implemented.");
    }
}

export const mockSession = {
    getSessionId() {
        return NodeId.nullNodeId;
    },
    continuationPointManager: new MockContinuationPointManager()
};
