/**
 * @module node-opcua-server
 *
 * A front thread (see FrontThreadEngine): an OPCUAServer configured by the application's
 * serverModule, listening with reusePort, whose compact namespaces are the engine's shared store.
 */
import { parentPort, workerData } from "node:worker_threads";
import type { AddressSpaceAccessor } from "../addressSpace_accessor.js";
import { OPCUAServer, type OPCUAServerOptions } from "../opcua_server.js";
import type { EngineToFront, FrontToEngine, FrontWorkerData } from "./protocol.js";
import { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";

type ServerOptionsFactory = (data: unknown, front: { front: number }) => OPCUAServerOptions | Promise<OPCUAServerOptions>;

async function main(): Promise<void> {
    const port = parentPort;
    if (!port) {
        throw new Error("front_worker: not started as a worker thread (see FrontThreadEngine)");
    }
    const data = workerData as FrontWorkerData;
    const module = (await import(data.serverModule)) as { default?: ServerOptionsFactory };
    if (typeof module.default !== "function") {
        throw new Error(`front_worker: ${data.serverModule} has no default export returning the server options`);
    }
    const options = await module.default(data.serverModuleData, { front: data.front });
    const server = new OPCUAServer({
        ...options,
        // without SO_REUSEPORT each front takes a port of its own, after the one asked for
        ...(data.sharedPort ? { reusePort: true } : { port: (options.port ?? 26543) + data.front }),
        // the namespace table of every front starts as the engine's: same nodesets, no own namespace
        nodeset_filename: data.nodesets,
        skipOwnNamespace: true
    });
    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("front_worker: the server has no address space after initialize()");
    }
    const uris = addressSpace.getNamespaceArray().map((n) => n.namespaceUri);
    data.namespaceUris.forEach((uri, index) => {
        if (index < uris.length) {
            if (uris[index] !== uri) {
                throw new Error(`front_worker: namespace ${index} is ${uris[index]} here and ${uri} in the engine`);
            }
        } else if (addressSpace.registerNamespace(uri).index !== index) {
            throw new Error(`front_worker: namespace ${uri} does not take index ${index}`);
        }
    });

    const channel = new EngineChannel(port);
    const backend = new RemoteCompactBackend(data.descriptor, channel, data.compactNamespaces, data.anchors);
    (server.engine.addressSpaceAccessor as AddressSpaceAccessor).compactBackend = backend;

    port.on("message", (message: EngineToFront) => {
        if (channel.receive(message)) return;
        switch (message.kind) {
            case "descriptor":
                backend.setDescriptor(message.descriptor);
                break;
            case "anchors":
                backend.setAnchors(message.anchors);
                break;
            case "stop":
                server
                    .shutdown(0)
                    .catch(() => undefined)
                    .finally(() => {
                        const stopped: FrontToEngine = { kind: "stopped" };
                        port.postMessage(stopped);
                        port.close();
                    });
                break;
        }
    });

    await server.start();
    const ready: FrontToEngine = { kind: "ready", endpointUrl: server.getEndpointUrl() };
    port.postMessage(ready);
}

main().catch((err: Error) => {
    const failed: FrontToEngine = { kind: "failed", message: err?.stack ?? String(err) };
    parentPort?.postMessage(failed);
    parentPort?.close();
});
