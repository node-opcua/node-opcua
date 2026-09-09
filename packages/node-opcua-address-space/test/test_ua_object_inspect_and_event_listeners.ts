import type { EventEmitter } from "node:events";
import { inspect } from "node:util";
import chalk from "chalk";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import type { AddressSpace } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../testHelpers.js";

// The two halves of one server crash (certification run 11718, CTT "A and C Refresh"
// Err_004): the eleventh event MonitoredItem on the Server object made Node emit its
// MaxListenersExceededWarning, whose text inspects the emitter without colours, and that
// inspection threw a TypeError out of `node.on("event", ...)` and out of the server process.
describe("UAObject: inspect() and event listeners", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("inspect(object, { colors: false }) works after chalk has been used for real", () => {
        // chalk 4 turns each style into a non-configurable own property on first use; a
        // Proxy over chalk that returned something else for it threw from then on
        chalk.cyan("x");
        chalk.green("x");
        const server = addressSpace.rootFolder.objects.server;
        const text = inspect(server, { colors: false });
        should(text).containEql("UAObject");
        should(text).containEql("Server");
        // and the colourless form is really colourless
        should(text).not.containEql("\u001b"); // no ANSI escape
        should(inspect(server, { colors: false, depth: 0 })).eql("UAObject<Server ns=0;i=2253>");
    });

    it("inspect(variable, { colors: false }) works after chalk has been used for real", () => {
        chalk.cyan("x");
        const serverStatus = addressSpace.rootFolder.objects.server.getChildByName("ServerStatus")!;
        const text = inspect(serverStatus, { colors: false });
        should(text).containEql("UAVariable");
        should(text).not.containEql("\u001b"); // no ANSI escape
    });

    it("more than ten event listeners on an object is not a leak to warn about", async () => {
        const server = addressSpace.rootFolder.objects.server;
        // one listener per event MonitoredItem, and the Server object collects them for every Session
        // (the public UAObject interface exposes on/once/removeListener only; the cap is the emitter's)
        should((server as unknown as EventEmitter).getMaxListeners()).be.greaterThan(10);

        const warnings: Error[] = [];
        const onWarning = (w: Error) => warnings.push(w);
        process.on("warning", onWarning);
        const listeners = Array.from({ length: 12 }, () => () => {
            /* an event MonitoredItem */
        });
        try {
            for (const listener of listeners) {
                server.on("event", listener);
            }
            // process warnings are delivered on a later tick
            await new Promise((resolve) => setImmediate(resolve));
            should(warnings.filter((w) => w.name === "MaxListenersExceededWarning")).eql([]);
        } finally {
            process.removeListener("warning", onWarning);
            for (const listener of listeners) {
                server.removeListener("event", listener);
            }
        }
    });
});
