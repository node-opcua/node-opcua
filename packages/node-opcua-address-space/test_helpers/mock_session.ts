import type {
    ContinuationData,
    IContinuationPointInfo,
    IContinuationPointManager,
    ISessionBase
} from "node-opcua-address-space-base";
import type { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import type { ReferenceDescription } from "node-opcua-service-browse";

export class MockContinuationPointManager implements IContinuationPointManager {
    public registerHistoryReadRaw(
        _maxElements: number,
        _dataValues: DataValue[],
        _cnt: ContinuationData
    ): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public getNextHistoryReadRaw(_numValues: number, _cnt: ContinuationData): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public registerReferences(
        _maxElements: number,
        _values: ReferenceDescription[],
        _cnt: ContinuationData
    ): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
    public getNextReferences(_numValue: number, _cnt: ContinuationData): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
    public dispose(): void {
        // do nothing
    }
}

export const mockSession: ISessionBase = {
    getSessionId() {
        return new NodeId();
    },
    continuationPointManager: new MockContinuationPointManager()
};
