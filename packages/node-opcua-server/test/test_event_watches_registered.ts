import type { MessagePort } from "node:worker_threads";
import { StoreAddressSpace } from "node-opcua-address-space-store";
import { NodeId } from "node-opcua-nodeid";
import { EventFilter } from "node-opcua-types";
import should from "should";
import type { FrontToEngine } from "../source/front_threads/protocol.js";
import { EngineChannel, RemoteCompactBackend } from "../source/front_threads/remote_backend.js";

// A session worker asks its engine to listen for the events of an event item. The reply to the
// CreateMonitoredItems waits until the engine has acknowledged it: an event the engine raises once the
// client has its item must reach it (the race of a test raising an event right after "initialized").
describe("RemoteCompactBackend: event watches the engine has not acknowledged yet", () => {
    it("eventWatchesRegistered settles once the engine replies to every watchEvents, not before", async () => {
        const space = new StoreAddressSpace({ expectedNodes: 16, shared: true });
        const posted: FrontToEngine[] = [];
        const port = { postMessage: (message: FrontToEngine) => posted.push(message) } as unknown as MessagePort;
        const channel = new EngineChannel(port);
        const backend = new RemoteCompactBackend(space.store.shareForReaders(), channel, []);

        should(backend.eventWatchesRegistered()).eql(undefined, "nothing pending yet");

        backend.subscribeEvents(new NodeId(NodeId.NodeIdType.NUMERIC, 2253, 0), new EventFilter({}), null, () => {});
        backend.subscribeEvents(new NodeId(NodeId.NodeIdType.NUMERIC, 2253, 0), new EventFilter({}), null, () => {});
        const registered = backend.eventWatchesRegistered();
        should(registered).not.eql(undefined);
        let settled = false;
        void registered?.then(() => {
            settled = true;
        });

        // the requests leave on the next turn; the engine has not answered
        await new Promise((resolve) => setImmediate(resolve));
        const requests = posted.find((message) => message.kind === "requests");
        if (requests?.kind !== "requests") throw new Error("no requests posted");
        should(requests.requests.map((request) => request.kind)).eql(["watchEvents", "watchEvents"]);
        await new Promise((resolve) => setImmediate(resolve));
        should(settled).eql(false, "the engine has not acknowledged the watches");

        // the engine acknowledges the first, then the second
        channel.receive({ kind: "replies", ids: [requests.ids[0]], payloads: [null] });
        await new Promise((resolve) => setImmediate(resolve));
        should(settled).eql(false, "one watch is still pending");
        channel.receive({ kind: "replies", ids: [requests.ids[1]], payloads: [null] });
        await registered;
        should(settled).eql(true);
        should(backend.eventWatchesRegistered()).eql(undefined, "nothing pending any more");
    });
});
