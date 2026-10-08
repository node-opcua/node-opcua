/**
 * @module node-opcua-server
 *
 * The services of the server engine that a front asks the engine to run for one of its sessions
 * (Read, Write, Browse, TranslateBrowsePaths, Call, HistoryRead), with their request and results
 * as binary encodings.
 */

import { type CompactAddressSpace, SessionContext } from "node-opcua-address-space";
import { HistoryReadRequest } from "node-opcua-service-history";
import { BrowseDescription, BrowsePath, CallMethodRequest, CallMethodResult, ReadRequest, WriteValue } from "node-opcua-types";
import type { ServerEngine } from "../server_engine.js";
import type { FrontSessions } from "./front_sessions.js";
import {
    decodeStructure,
    decodeStructures,
    decodeStructuresWith,
    encodeDataValues,
    encodeStructures,
    type ServiceKind
} from "./protocol.js";

export class EngineServices {
    readonly #serverEngine: ServerEngine;
    readonly #sessions: FrontSessions;
    readonly #addressSpace: CompactAddressSpace;

    constructor(serverEngine: ServerEngine, sessions: FrontSessions, addressSpace: CompactAddressSpace) {
        this.#serverEngine = serverEngine;
        this.#sessions = sessions;
        this.#addressSpace = addressSpace;
    }

    /** a service of the server engine, for a session of a front: its request and its results as their binary encoding */
    public async run(service: ServiceKind, token: string | null, bytes: Uint8Array): Promise<unknown> {
        const engine = this.#serverEngine;
        const sessionContext = this.#sessions.contextOf(token);
        if (token !== null && !sessionContext) {
            throw new Error("the session is closed");
        }
        // TranslateBrowsePaths alone runs without a session
        const context = sessionContext ?? SessionContext.defaultContext;
        switch (service) {
            case "read": {
                const request = decodeStructure(bytes, new ReadRequest());
                await new Promise<void>((resolve, reject) =>
                    engine.prepareRead(context, request, (err) => (err ? reject(err) : resolve()))
                );
                return encodeDataValues(engine.readSync(context, request));
            }
            case "write": {
                const statuses = await engine.write(context, decodeStructures(bytes, WriteValue.prototype));
                // a namespace default may have been written (NamespaceMetadata): the readers apply it from now on
                this.#addressSpace.publishNamespacePolicy();
                return statuses.map((status) => status.value);
            }
            case "browse":
                return encodeStructures(
                    await engine.browseWithAutomaticExpansion(decodeStructures(bytes, BrowseDescription.prototype), context)
                );
            case "translate":
                // a BrowsePath decodes into the RelativePath its constructor makes
                return encodeStructures(await engine.translateBrowsePaths(decodeStructuresWith(bytes, () => new BrowsePath())));
            case "call": {
                const results = await engine.call(context, decodeStructures(bytes, CallMethodRequest.prototype));
                return encodeStructures(results.map((result) => new CallMethodResult(result)));
            }
            case "historyRead": {
                const request = decodeStructure(bytes, new HistoryReadRequest());
                await new Promise<void>((resolve) => engine.refreshValues(request.nodesToRead ?? [], 0, () => resolve()));
                return encodeStructures(await engine.historyRead(context, request));
            }
        }
    }
}
