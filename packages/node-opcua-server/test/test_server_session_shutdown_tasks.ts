import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { ServerEngine } from "../source/index.js";

const mini_nodeset_filename = get_mini_nodeset_filename();

describe("ServerSession#registerSessionShutdownTask", () => {
    function withEngine(fn: (engine: ServerEngine) => Promise<void>) {
        return async () => {
            const engine = new ServerEngine();
            await new Promise<void>((resolve) => engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => resolve()));
            try {
                await fn(engine);
            } finally {
                await engine.shutdown();
            }
        };
    }

    it(
        "runs the tasks once when the session closes",
        withEngine(async (engine) => {
            const session = engine.createSession({});
            const witness: string[] = [];
            session.registerSessionShutdownTask(() => {
                witness.push("T1");
            });
            session.registerSessionShutdownTask(async () => {
                witness.push("T2");
            });
            should(witness).eql([]);

            await engine.closeSession(session.authenticationToken, true, "CloseSession");
            should(witness).eql(["T1", "T2"]);
        })
    );

    it(
        "closeSession closes the session synchronously, and resolves after the tasks have settled",
        withEngine(async (engine) => {
            const session = engine.createSession({});
            const token = session.authenticationToken;
            let release: () => void = () => {};
            let taskDone = false;
            session.registerSessionShutdownTask(async () => {
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
                taskDone = true;
            });

            let closed = false;
            const promise = engine.closeSession(token, true, "CloseSession").then(() => {
                closed = true;
            });
            should(engine.getSession(token)).eql(undefined);

            await new Promise((resolve) => setImmediate(resolve));
            should(closed).eql(false);

            release();
            await promise;
            should(taskDone).eql(true);
        })
    );

    it(
        "a task that fails does not stop the other tasks, and does not reject",
        withEngine(async (engine) => {
            const session = engine.createSession({});
            const witness: string[] = [];
            session.registerSessionShutdownTask(() => {
                throw new Error("sync failure");
            });
            session.registerSessionShutdownTask(async () => {
                throw new Error("async failure");
            });
            session.registerSessionShutdownTask(() => {
                witness.push("T3");
            });
            await engine.closeSession(session.authenticationToken, true, "CloseSession");
            should(witness).eql(["T3"]);
        })
    );

    it(
        "a task registered after the close runs immediately",
        withEngine(async (engine) => {
            const session = engine.createSession({});
            await engine.closeSession(session.authenticationToken, true, "CloseSession");
            let done = false;
            session.registerSessionShutdownTask(() => {
                done = true;
            });
            should(done).eql(true);
        })
    );

    it("engine.shutdown waits for the tasks of the open sessions", async () => {
        const engine = new ServerEngine();
        await new Promise<void>((resolve) => engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => resolve()));
        const session = engine.createSession({});
        let taskDone = false;
        session.registerSessionShutdownTask(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            taskDone = true;
        });
        await engine.shutdown();
        should(taskDone).eql(true);
    });
});
