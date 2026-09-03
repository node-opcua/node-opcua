import { AttributeIds } from "node-opcua-basic-types";
import should from "should";
import { apply_timestamps, apply_timestamps_no_copy, DataValue, TimestampsToReturn } from "../dist/index.js";

describe("apply_timestamps - only the requested timestamps are returned (Part 4 7.40)", () => {
    const make = () =>
        new DataValue({ value: { dataType: "Int32", value: 1 }, sourceTimestamp: new Date(1000), serverTimestamp: new Date(2000) });

    it("TimestampsToReturn.Source drops the server timestamp (no copy)", () => {
        const dv = apply_timestamps_no_copy(make(), TimestampsToReturn.Source, AttributeIds.Value);
        should(dv.serverTimestamp).eql(null);
        should(dv.sourceTimestamp).eql(new Date(1000));
    });
    it("TimestampsToReturn.Source drops the server timestamp (copy)", () => {
        const dv = apply_timestamps(make(), TimestampsToReturn.Source, AttributeIds.Value);
        should(dv.serverTimestamp).eql(null);
        should(dv.sourceTimestamp).eql(new Date(1000));
    });
    it("TimestampsToReturn.Server drops the source timestamp", () => {
        const dv = apply_timestamps_no_copy(make(), TimestampsToReturn.Server, AttributeIds.Value);
        should(dv.sourceTimestamp).eql(null);
        should(dv.serverTimestamp).eql(new Date(2000));
    });
});
