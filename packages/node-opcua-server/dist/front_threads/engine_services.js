/**
 * @module node-opcua-server
 *
 * The services of the server engine that a front asks the engine to run for one of its sessions
 * (Read, Write, Browse, TranslateBrowsePaths, Call, HistoryRead), with their request and results
 * as binary encodings.
 */
import { SessionContext } from "node-opcua-address-space";
import { HistoryReadRequest } from "node-opcua-service-history";
import { BrowseDescription, BrowsePath, CallMethodRequest, CallMethodResult, ReadRequest, WriteValue } from "node-opcua-types";
import { decodeStructure, decodeStructures, decodeStructuresWith, encodeDataValues, encodeStructures } from "./protocol.js";
export class EngineServices {
    #serverEngine;
    #sessions;
    #addressSpace;
    constructor(serverEngine, sessions, addressSpace) {
        this.#serverEngine = serverEngine;
        this.#sessions = sessions;
        this.#addressSpace = addressSpace;
    }
    /** a service of the server engine, for a session of a front: its request and its results as their binary encoding */
    async run(service, token, bytes) {
        const engine = this.#serverEngine;
        const sessionContext = this.#sessions.contextOf(token);
        if (token !== null && !sessionContext) {
            throw new Error("the session is closed");
        }
        // TranslateBrowsePaths may run without a session: then it is not filtered
        const context = sessionContext ?? SessionContext.defaultContext;
        switch (service) {
            case "read": {
                const request = decodeStructure(bytes, new ReadRequest());
                await new Promise((resolve, reject) => engine.prepareRead(context, request, (err) => (err ? reject(err) : resolve())));
                return encodeDataValues(engine.readSync(context, request));
            }
            case "write": {
                const statuses = await engine.write(context, decodeStructures(bytes, WriteValue.prototype));
                // a namespace default may have been written (NamespaceMetadata): the readers apply it from now on
                this.#addressSpace.publishNamespacePolicy();
                return statuses.map((status) => status.value);
            }
            case "browse":
                return encodeStructures(await engine.browseWithAutomaticExpansion(decodeStructures(bytes, BrowseDescription.prototype), context));
            case "translate":
                // a BrowsePath decodes into the RelativePath its constructor makes
                return encodeStructures(await engine.translateBrowsePaths(decodeStructuresWith(bytes, () => new BrowsePath()), sessionContext ?? undefined));
            case "call": {
                const results = await engine.call(context, decodeStructures(bytes, CallMethodRequest.prototype));
                return encodeStructures(results.map((result) => new CallMethodResult(result)));
            }
            case "historyRead": {
                const request = decodeStructure(bytes, new HistoryReadRequest());
                await new Promise((resolve) => engine.refreshValues(request.nodesToRead ?? [], 0, () => resolve(), context));
                return encodeStructures(await engine.historyRead(context, request));
            }
        }
    }
}
//# sourceMappingURL=engine_services.js.map