/**
 * @module node-opcua-server
 *
 * The push of the value changes of the store to the workers: the nodes the monitored items of a
 * worker listen to, and the changes of each turn of the event loop in one message per worker.
 */
import { NodeClass } from "node-opcua-data-model";
import { encodeMonitoredValues, WATCH } from "./protocol.js";
/** the changes waiting for a busy front beyond which only the latest value of each node is kept */
const MAX_WAITING_CHANGES = 1000;
export class ValueWatches {
    #addressSpace;
    #watched = new Map();
    #outgoing = new Map();
    #pushScheduled = false;
    constructor(addressSpace) {
        this.#addressSpace = addressSpace;
    }
    /** the watch and unwatch operations a worker sent, three numbers each */
    apply(worker, operations) {
        for (let k = 0; k + 2 < operations.length; k += 3) {
            if (operations[k] === WATCH) {
                this.#watch(worker, operations[k + 1], operations[k + 2]);
                // the worker began this watch before its client had the item (see CompactStore.beginWatch)
                this.#addressSpace.store.endWatch();
            }
            else {
                this.#unwatch(worker, operations[k + 1], operations[k + 2]);
            }
        }
    }
    /** the worker finished with the "changes" message in flight */
    changesDone(worker) {
        const outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined)
            return;
        outgoing.inFlight = false;
        outgoing.waiting.clear();
        if (outgoing.indexes.length > 0)
            this.#schedulePush();
    }
    /** a worker that ended: it listens to nothing any longer */
    workerGone(worker) {
        for (const [index, watch] of [...this.#watched]) {
            if (!watch.fronts.delete(worker) || watch.fronts.size > 0)
                continue;
            this.#watched.delete(index);
            this.#stopListening(watch);
        }
        this.#outgoing.delete(worker);
    }
    stopAll() {
        for (const watch of this.#watched.values())
            this.#stopListening(watch);
        this.#watched.clear();
        this.#outgoing.clear();
    }
    #watch(worker, index, generation) {
        const nodes = this.#addressSpace.store.nodes;
        let watch = this.#watched.get(index);
        if ((watch !== undefined && watch.generation !== generation) ||
            index >= nodes.count ||
            nodes.isDeleted(index) ||
            nodes.generation(index) !== generation) {
            // the node the front holds is gone
            this.#outgoingTo(worker).disposed.push(index);
            this.#schedulePush();
            return;
        }
        if (watch === undefined) {
            const view = this.#addressSpace.viewOf(index);
            const created = {
                generation,
                view,
                fronts: new Set(),
                onChange: (dataValue, version) => {
                    for (const front of created.fronts)
                        this.#queue(front, index, dataValue, version);
                },
                onDispose: () => {
                    // the view is gone with the node: its listeners go with it
                    this.#watched.delete(index);
                    for (const front of created.fronts)
                        this.#outgoingTo(front).disposed.push(index);
                    this.#schedulePush();
                }
            };
            view.on("value_changed", created.onChange);
            view.on("dispose", created.onDispose);
            this.#watched.set(index, created);
            watch = created;
        }
        watch.fronts.add(worker);
        // the changes told since the worker began this watch, in order: the front keeps those newer than
        // the value it has (see FrontMonitoredNode.deliver)
        for (const { version, dataValue } of this.#addressSpace.recentChanges(index)) {
            this.#queue(worker, index, dataValue, version);
        }
        // the value now: the front may have read it in place before this watch, and missed a write since
        if (view_isVariable(watch.view)) {
            this.#queue(worker, index, watch.view.readValue(null));
        }
    }
    #unwatch(worker, index, generation) {
        const watch = this.#watched.get(index);
        if (watch === undefined || watch.generation !== generation || !watch.fronts.delete(worker) || watch.fronts.size > 0) {
            return;
        }
        this.#watched.delete(index);
        this.#stopListening(watch);
    }
    #stopListening(watch) {
        watch.view.removeListener("value_changed", watch.onChange);
        watch.view.removeListener("dispose", watch.onDispose);
    }
    #outgoingTo(worker) {
        let outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined) {
            outgoing = { indexes: [], versions: [], values: [], disposed: [], inFlight: false, waiting: new Map() };
            this.#outgoing.set(worker, outgoing);
        }
        return outgoing;
    }
    /** `version`: the one of `dataValue` (a change written elsewhere may be older than the store's), else the store's */
    #queue(worker, index, dataValue, version = this.#addressSpace.store.values.version(index)) {
        const outgoing = this.#outgoingTo(worker);
        if (outgoing.inFlight) {
            const at = outgoing.waiting.get(index);
            if (at !== undefined && outgoing.indexes.length >= MAX_WAITING_CHANGES) {
                // the front has fallen behind: the newer value replaces the last one waiting
                outgoing.versions[at] = version; // check-proto-pollution: ok - numeric array position
                outgoing.values[at] = dataValue; // check-proto-pollution: ok - numeric array position
                return;
            }
            outgoing.waiting.set(index, outgoing.indexes.length);
        }
        outgoing.indexes.push(index);
        outgoing.versions.push(version);
        outgoing.values.push(dataValue);
        this.#schedulePush();
    }
    /** the changes of this turn, one message per front, after the replies of the turn */
    #schedulePush() {
        if (this.#pushScheduled)
            return;
        this.#pushScheduled = true;
        setImmediate(() => {
            this.#pushScheduled = false;
            for (const [worker, outgoing] of this.#outgoing) {
                if (outgoing.indexes.length > 0 && !outgoing.inFlight) {
                    const changes = {
                        kind: "changes",
                        indexes: outgoing.indexes,
                        versions: outgoing.versions,
                        values: encodeMonitoredValues(outgoing.values)
                    };
                    worker.postMessage(changes);
                    outgoing.indexes = [];
                    outgoing.versions = [];
                    outgoing.values = [];
                    outgoing.inFlight = true;
                }
                if (outgoing.disposed.length > 0) {
                    const disposed = { kind: "disposed", indexes: outgoing.disposed };
                    worker.postMessage(disposed);
                    outgoing.disposed = [];
                }
            }
        });
    }
}
function view_isVariable(view) {
    return view.nodeClass === NodeClass.Variable;
}
//# sourceMappingURL=value_watches.js.map