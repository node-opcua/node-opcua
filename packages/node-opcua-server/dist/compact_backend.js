import { CompactAddressSpaceServices, historyReadThrough } from "node-opcua-address-space";
import { getCurrentClock } from "node-opcua-date-time";
import { resolveNodeId } from "node-opcua-nodeid";
import { HistoryReadResult } from "node-opcua-service-history";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
/** the compact address space of this thread */
export class LocalCompactBackend {
    #space;
    #services;
    namespaces;
    constructor(space, namespaces) {
        this.#space = space;
        this.namespaces = namespaces;
        this.#services = new CompactAddressSpaceServices(space);
    }
    read(context, nodeToRead, maxAge, timestampsToReturn) {
        return this.#services.read(context, nodeToRead, maxAge, timestampsToReturn);
    }
    async write(context, nodesToWrite) {
        // one clock for the whole Write (the accessor has read it into the context already)
        const now = (context?.currentTime ?? getCurrentClock()).timestamp.getTime();
        return nodesToWrite.map((writeValue) => coerceStatusCode(this.#services.write(context, writeValue, now)));
    }
    async browse(context, description) {
        return this.#services.browse(context, description);
    }
    async references(context, nodeId, description) {
        const node = this.#space.store.find(nodeId);
        if (node < 0) {
            return [];
        }
        const referenceType = description.referenceTypeId && description.referenceTypeId.value !== 0 ? description.referenceTypeId : undefined;
        return this.#services.references(context, node, description, referenceType, this.namespaces);
    }
    async translate(browsePath, context) {
        const result = this.#services.translate(browsePath, context ?? null);
        return result.statusCode.isGood() ? result : null;
    }
    call(context, request) {
        return this.#services.call(context, request);
    }
    async historyRead(context, nodeToRead, historyReadDetails, continuationData) {
        const space = this.#space;
        const index = space.store.find(resolveNodeId(nodeToRead.nodeId));
        if (index < 0 || space.store.nodes.isDeleted(index)) {
            return new HistoryReadResult({ statusCode: StatusCodes.BadNodeIdUnknown });
        }
        const historian = space.historians.get(index);
        if (!historian) {
            // not historized: what a node object without history answers
            return new HistoryReadResult({ statusCode: StatusCodes.BadNotReadable });
        }
        const view = space.viewOf(index);
        return historyReadThrough({
            nodeId: view.nodeId,
            browseName: view.browseName,
            varHistorian: historian,
            canUserReadHistory: (c) => space.permissions.historyReadStatus(c, index) === StatusCodes.Good.value
        }, context, historyReadDetails, nodeToRead.indexRange ?? null, nodeToRead.dataEncoding ?? null, continuationData);
    }
    findNode(nodeId) {
        return this.#space.findNode(resolveNodeId(nodeId));
    }
}
//# sourceMappingURL=compact_backend.js.map