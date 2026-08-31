import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";

import { OPCUAClient } from "../dist/index.js";

describe("OPCUAClient + transportFactory option", () => {
    it("accepts a transportFactory option on OPCUAClientOptions", () => {
        const factory = { create: sinon.stub() };
        // Construction alone is the assertion — previously the option was
        // not a member of OPCUAClientBaseOptions and would be a compile error.
        const client = OPCUAClient.create({ transportFactory: factory });
        should.exist(client);
    });

    it("does not require a transportFactory (default is Node TCP transport)", () => {
        const client = OPCUAClient.create({});
        should.exist(client);
    });
});
