import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import { AttributeIds } from "node-opcua-basic-types";
import { type DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { ReadRequest } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source/index.js";

describe("ServerEngine - readSync", () => {
    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: get_mini_nodeset_filename() }, () => {
            const namespace = engine.addressSpace?.getOwnNamespace();
            if (!namespace) {
                throw new Error("addressSpace is null");
            }
            namespace.addVariable({
                browseName: "Temperature",
                nodeId: "s=Temperature",
                dataType: "Double",
                value: { dataType: DataType.Double, value: 21.5 }
            });
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    const request = () =>
        new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                { nodeId: "ns=1;s=Temperature", attributeId: AttributeIds.Value },
                { nodeId: "ns=1;s=Temperature", attributeId: AttributeIds.BrowseName },
                { nodeId: "ns=1;s=DoesNotExist", attributeId: AttributeIds.Value }
            ]
        });

    it("answers a Read before returning", () => {
        const session = engine.createSession({});
        const results = engine.readSync(session.sessionContext, request());
        should(results.map((dataValue) => dataValue.statusCode)).eql([
            StatusCodes.Good,
            StatusCodes.Good,
            StatusCodes.BadNodeIdUnknown
        ]);
        should(results[0].value.value).eql(21.5);
        should(results[1].value.value.name).eql("Temperature");
        should(results[0].serverTimestamp).be.instanceOf(Date);
        session.close(true, "CloseSession");
    });

    it("read() returns the same results, through a promise", async () => {
        const session = engine.createSession({});
        const direct = engine.readSync(session.sessionContext, request());
        const promised: DataValue[] = await engine.read(session.sessionContext, request());
        should(promised.map((dataValue) => dataValue.value.value)).eql(direct.map((dataValue) => dataValue.value.value));
        should(promised.map((dataValue) => dataValue.statusCode)).eql(direct.map((dataValue) => dataValue.statusCode));
        session.close(true, "CloseSession");
    });
});
