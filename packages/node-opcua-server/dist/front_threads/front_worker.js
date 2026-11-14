/**
 * @module node-opcua-server
 *
 * A front thread (see FrontThreadEngine): a FrontOPCUAServer configured by the application's
 * serverModule, listening with reusePort. It holds no address space, no session record and no
 * subscription of its own: the values of the shared store are read in place, the other services
 * go to the engine, the subscription services to the session worker of the session.
 */
import { parentPort, workerData } from "node:worker_threads";
import { FrontOPCUAServer } from "./front_opcua_server.js";
import { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";
import { RemoteEngine } from "./remote_engine.js";
async function main() {
    const port = parentPort;
    if (!port) {
        throw new Error("front_worker: not started as a worker thread (see FrontThreadEngine)");
    }
    const data = workerData;
    const module = (await import(data.serverModule));
    if (typeof module.default !== "function") {
        throw new Error(`front_worker: ${data.serverModule} has no default export returning the server options`);
    }
    const options = await module.default(data.serverModuleData, { front: data.front });
    const channel = new EngineChannel(port);
    const backend = new RemoteCompactBackend(data.descriptor, channel, data.storeNamespaces);
    const engine = new RemoteEngine(data.server, channel, backend);
    const server = new FrontOPCUAServer({
        ...options,
        // without SO_REUSEPORT each front takes a port of its own, after the one asked for
        ...(data.sharedPort ? { reusePort: true } : { port: (options.port ?? 26543) + data.front })
    }, engine, data.sessionWorkerPorts);
    await server.initialize();
    port.on("message", (message) => {
        if (channel.receive(message))
            return;
        switch (message.kind) {
            case "descriptor":
                backend.setDescriptor(message.descriptor);
                break;
            case "sessionClosed":
                engine.sessionClosedByEngine(message.token, message.reason);
                break;
            case "forgetSession":
                engine.forgetSession(message.token);
                break;
            case "restoreSession":
                engine.restoreSession(message.token);
                break;
            case "releaseSession": {
                const released = {
                    kind: "sessionReleased",
                    id: message.id,
                    state: engine.releaseSession(message.token)
                };
                port.postMessage(released);
                break;
            }
            case "stop":
                server
                    .shutdown(0)
                    .catch(() => undefined)
                    .finally(() => {
                    const stopped = { kind: "stopped" };
                    port.postMessage(stopped);
                    port.close();
                });
                break;
        }
    });
    await server.start();
    const ready = { kind: "ready", endpointUrl: server.getEndpointUrl() };
    port.postMessage(ready);
}
// a front thread only: a session worker imports this module when it is also the serverModule of the fronts
if (workerData?.thread === "front") {
    main().catch((err) => {
        const failed = { kind: "failed", message: err?.stack ?? String(err) };
        parentPort?.postMessage(failed);
        parentPort?.close();
    });
}
//# sourceMappingURL=front_worker.js.map