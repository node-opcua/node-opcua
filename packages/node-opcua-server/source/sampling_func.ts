import { ISessionContext } from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";

export type SamplingFunc = (
    context: ISessionContext,
    dataValue: DataValue,
    callback: (err: Error | null, dataValue?: DataValue) => void
) => void;
