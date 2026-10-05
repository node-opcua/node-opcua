import type { UAVariable } from "node-opcua-address-space";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { ServerEngine, type ServerSession } from "../source/index.js";

describe("ServerSession - service counters of the session diagnostics", () => {
    let engine: ServerEngine;
    let session: ServerSession;

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: nodesets.standard }, () => done());
    });
    after(async () => {
        await engine.shutdown();
    });
    beforeEach(() => {
        session = engine.createSession({});
        // the session diagnostics exist in the address space from the activation of the session
        session.status = "active";
    });
    afterEach(() => {
        session.close(true, "CloseSession");
    });

    function sessionDiagnostics(): UAVariable {
        if (!session.sessionDiagnostics) {
            throw new Error("the session has no diagnostics");
        }
        return session.sessionDiagnostics as unknown as UAVariable;
    }
    function readCounter(counterName: string): { totalCount: number; errorCount: number } {
        const counter = sessionDiagnostics().getComponentByName(counterName) as UAVariable | null;
        if (!counter) {
            throw new Error(`cannot find SessionDiagnostics.${counterName}`);
        }
        const { totalCount, errorCount } = counter.readValue().value.value;
        return { totalCount, errorCount };
    }
    /**
     * a write through the proxies in front of a counter looks up, by name, the Variable
     * exposing it: this counts those lookups
     */
    function countVariableLookups(): () => number {
        const variable = sessionDiagnostics();
        const getComponentByName = variable.getComponentByName;
        let lookups = 0;
        // getComponentByName is overloaded: the arguments are passed on as they come
        const counting = function (this: UAVariable, ...args: unknown[]) {
            lookups += 1;
            return Reflect.apply(getComponentByName, this, args);
        };
        variable.getComponentByName = counting as UAVariable["getComponentByName"];
        return () => lookups;
    }

    it("a counter reads its exact value at once", () => {
        for (let i = 0; i < 10; i++) {
            session.incrementTotalRequestCount();
            session.incrementRequestTotalCounter("read");
        }
        session.incrementRequestErrorCounter("read");

        should(readCounter("ReadCount")).eql({ totalCount: 10, errorCount: 1 });
        should(readCounter("TotalRequestCount")).eql({ totalCount: 10, errorCount: 0 });
        should(readCounter("WriteCount")).eql({ totalCount: 0, errorCount: 0 });
    });

    it("the requests of a busy session do not go through the proxies of the counters", () => {
        session.incrementRequestTotalCounter("read");

        const lookups = countVariableLookups();
        for (let i = 0; i < 10; i++) {
            session.incrementTotalRequestCount();
            session.incrementRequestTotalCounter("read");
        }
        should(lookups()).eql(0);
    });

    it("goes through the proxies again once the session has been quiet for a while", async () => {
        session.incrementRequestTotalCounter("read");
        await new Promise((resolve) => setTimeout(resolve, 300));

        const lookups = countVariableLookups();
        session.incrementRequestTotalCounter("read");
        should(lookups()).be.above(0);
        should(readCounter("ReadCount")).eql({ totalCount: 2, errorCount: 0 });
    });
});
