import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5849;

describe("FrontThreadEngine.shutdown: a thread that never ends does not hold it", function () {
    this.timeout(30000);

    it("resolves although a session worker never answers stop and cannot be terminated", async () => {
        const engine = await FrontThreadEngine.create({ applicationUri: "urn:test:deaf-thread" });
        engine.registerNamespace("urn:test:deaf-thread:plant");
        await engine.start({
            fronts: 1,
            ownPorts: true,
            sessionWorkerScript: new URL("./fixtures/front_threads_deaf_session_worker.mjs", import.meta.url),
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port }
        });
        const started = Date.now();
        let guard: NodeJS.Timeout | undefined;
        const outcome = await Promise.race([
            engine.shutdown().then(() => "resolved"),
            new Promise<string>((resolve) => {
                guard = setTimeout(() => resolve("still waiting"), 15000);
            })
        ]);
        clearTimeout(guard);
        should(outcome).eql("resolved");
        should(Date.now() - started).belowOrEqual(15000);
    });
});
