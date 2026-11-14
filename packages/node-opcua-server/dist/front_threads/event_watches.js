/**
 * @module node-opcua-server
 *
 * The events and the values of the node objects that the session workers monitor: the engine
 * listens on the node objects and sends each worker what its items selected, one message per
 * worker and turn of the event loop.
 */
import { SessionContext } from "node-opcua-address-space";
import { EventFilter, extractEventFields } from "node-opcua-service-filter";
import { EventFieldList } from "node-opcua-types";
import { canReceiveEvent } from "../audit_event_permissions.js";
import { isRefreshBracketEvent } from "../condition_refresh_bracket.js";
import { checkWhereClauseOnAdressSpace } from "../filter/check_where_clause_on_address_space.js";
import { decodeStructure, encodeMonitoredValues, encodeStructures } from "./protocol.js";
import { RolesContext } from "./resolved_roles_context.js";
import { TurnBatches } from "./turn_batches.js";
export class EventWatches {
    #serverEngine;
    #sessions;
    // the event items of each worker: their filter evaluated here, on the node objects
    #eventWatches = new Map();
    #eventsOut = new TurnBatches(() => ({ ids: [], lists: [] }), (target, events) => target.postMessage({ kind: "events", ids: events.ids, fields: encodeStructures(events.lists) }));
    #objectWatches = new Map();
    // the values of the watched node objects, one message per worker and turn of the event loop
    #objectChanges = new TurnBatches(() => ({ nodeIds: [], values: [] }), (target, changes) => target.postMessage({
        kind: "objectChanges",
        nodeIds: changes.nodeIds,
        values: encodeMonitoredValues(changes.values)
    }));
    constructor(serverEngine, sessions) {
        this.#serverEngine = serverEngine;
        this.#sessions = sessions;
    }
    unwatchEvents(worker, id) {
        this.#eventWatches.get(worker)?.get(id)?.stop();
        this.#eventWatches.get(worker)?.delete(id);
    }
    /** a worker that ended: it listens to nothing any longer */
    workerGone(worker) {
        for (const watch of this.#eventWatches.get(worker)?.values() ?? [])
            watch.stop();
        this.#eventWatches.delete(worker);
        this.#eventsOut.delete(worker);
        for (const nodeId of [...this.#objectWatches.keys()])
            this.unwatchObject(worker, nodeId);
        this.#objectChanges.delete(worker);
    }
    stopAll() {
        for (const watches of this.#eventWatches.values())
            for (const watch of watches.values())
                watch.stop();
        this.#eventWatches.clear();
    }
    /**
     * the events of a node object for an event item of a worker: filtered here, where the address
     * space is, with the item's filter and the roles of its session; the selected fields go to the worker
     */
    watchEvents(worker, request) {
        const { id, subscriptionId, monitoredItemId } = request;
        const addressSpace = this.#serverEngine.addressSpace;
        const node = addressSpace?.findNode(request.nodeId);
        if (!addressSpace || !node)
            return;
        const filter = decodeStructure(request.filter, new EventFilter());
        const described = new RolesContext(request.context);
        const token = request.token;
        const listener = (eventData) => {
            // a ConditionRefresh in progress goes to the items of the Subscription it names (OPC 10000-9 5.5.7, 5.5.8),
            // its bracket whatever their filter (4.5), as MonitoredItem does where the events are raised
            const scope = addressSpace._condition_refresh_scope;
            const forThisItem = !!scope &&
                scope.subscription.id === subscriptionId &&
                (scope.monitoredItemId === undefined || scope.monitoredItemId === monitoredItemId);
            if (scope && !forThisItem)
                return;
            const bracket = forThisItem && isRefreshBracketEvent(eventData);
            // the roles of the session now: they change when it is activated again with another user
            const context = (token !== null && this.#sessions.contextOf(token)) || described;
            if (!bracket && !canReceiveEvent(context, addressSpace, eventData))
                return;
            if (!bracket &&
                filter.whereClause &&
                !checkWhereClauseOnAdressSpace(addressSpace, SessionContext.defaultContext, filter.whereClause, eventData)) {
                return;
            }
            const eventFields = extractEventFields(SessionContext.defaultContext, filter.selectClauses ?? [], eventData);
            this.#queueEvent(worker, id, new EventFieldList({ clientHandle: 0, eventFields }));
        };
        node.on("event", listener);
        let watches = this.#eventWatches.get(worker);
        if (!watches) {
            watches = new Map();
            this.#eventWatches.set(worker, watches);
        }
        watches.set(id, { stop: () => node.removeListener("event", listener) });
    }
    #queueEvent(worker, id, list) {
        const out = this.#eventsOut.of(worker);
        out.ids.push(id);
        out.lists.push(list);
    }
    /** a node object a session worker monitors: the values written to it go to that worker */
    watchObject(worker, nodeId) {
        let watch = this.#objectWatches.get(nodeId);
        if (!watch) {
            const node = this.#serverEngine.addressSpace?.findNode(nodeId);
            if (!node)
                return;
            const workers = new Set();
            const listener = (dataValue) => {
                for (const target of workers)
                    this.#queueObjectChange(target, nodeId, dataValue);
            };
            node.on("value_changed", listener);
            watch = { node, workers, listener };
            this.#objectWatches.set(nodeId, watch);
        }
        watch.workers.add(worker);
    }
    unwatchObject(worker, nodeId) {
        const watch = this.#objectWatches.get(nodeId);
        if (!watch)
            return;
        watch.workers.delete(worker);
        if (watch.workers.size === 0) {
            watch.node.removeListener("value_changed", watch.listener);
            this.#objectWatches.delete(nodeId);
        }
    }
    #queueObjectChange(worker, nodeId, dataValue) {
        const queued = this.#objectChanges.of(worker);
        queued.nodeIds.push(nodeId);
        queued.values.push(dataValue);
    }
}
//# sourceMappingURL=event_watches.js.map