/**
 * @module node-opcua-server
 *
 * The push of the value changes of the store to the workers: the nodes the monitored items of a
 * worker listen to, and the changes of each turn of the event loop in one message per worker.
 */

import type { Worker } from "node:worker_threads";
import type { CompactAddressSpace } from "node-opcua-address-space";
import type { StoreNodeView, StoreVariableView } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { type EngineToFront, encodeMonitoredValues, WATCH } from "./protocol.js";

/** the changes waiting for a busy front beyond which only the latest value of each node is kept */
const MAX_WAITING_CHANGES = 1000;

/** a node the monitored items of one front or more listen to */
interface Watch {
    generation: number;
    view: StoreNodeView;
    fronts: Set<Worker>;
    onChange: (dataValue: DataValue) => void;
    onDispose: () => void;
}

/** what goes to a front at the end of the turn */
interface Outgoing {
    indexes: number[];
    versions: number[];
    values: DataValue[];
    disposed: number[];
    /** a "changes" message the front has not finished with */
    inFlight: boolean;
    /** while one is in flight: where each node's last waiting value is, to replace it once too many wait */
    waiting: Map<number, number>;
}

export class ValueWatches {
    readonly #addressSpace: CompactAddressSpace;
    readonly #watched = new Map<number, Watch>();
    readonly #outgoing = new Map<Worker, Outgoing>();
    #pushScheduled = false;

    constructor(addressSpace: CompactAddressSpace) {
        this.#addressSpace = addressSpace;
    }

    /** the watch and unwatch operations a worker sent, three numbers each */
    public apply(worker: Worker, operations: number[]): void {
        for (let k = 0; k + 2 < operations.length; k += 3) {
            if (operations[k] === WATCH) this.#watch(worker, operations[k + 1], operations[k + 2]);
            else this.#unwatch(worker, operations[k + 1], operations[k + 2]);
        }
    }

    /** the worker finished with the "changes" message in flight */
    public changesDone(worker: Worker): void {
        const outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined) return;
        outgoing.inFlight = false;
        outgoing.waiting.clear();
        if (outgoing.indexes.length > 0) this.#schedulePush();
    }

    /** a worker that ended: it listens to nothing any longer */
    public workerGone(worker: Worker): void {
        for (const [index, watch] of [...this.#watched]) {
            if (!watch.fronts.delete(worker) || watch.fronts.size > 0) continue;
            this.#watched.delete(index);
            this.#stopListening(watch);
        }
        this.#outgoing.delete(worker);
    }

    public stopAll(): void {
        for (const watch of this.#watched.values()) this.#stopListening(watch);
        this.#watched.clear();
        this.#outgoing.clear();
    }

    #watch(worker: Worker, index: number, generation: number): void {
        const nodes = this.#addressSpace.store.nodes;
        let watch = this.#watched.get(index);
        if (
            (watch !== undefined && watch.generation !== generation) ||
            index >= nodes.count ||
            nodes.isDeleted(index) ||
            nodes.generation(index) !== generation
        ) {
            // the node the front holds is gone
            this.#outgoingTo(worker).disposed.push(index);
            this.#schedulePush();
            return;
        }
        if (watch === undefined) {
            const view = this.#addressSpace.viewOf(index);
            const created: Watch = {
                generation,
                view,
                fronts: new Set(),
                onChange: (dataValue: DataValue) => {
                    for (const front of created.fronts) this.#queue(front, index, dataValue);
                },
                onDispose: () => {
                    // the view is gone with the node: its listeners go with it
                    this.#watched.delete(index);
                    for (const front of created.fronts) this.#outgoingTo(front).disposed.push(index);
                    this.#schedulePush();
                }
            };
            view.on("value_changed", created.onChange);
            view.on("dispose", created.onDispose);
            this.#watched.set(index, created);
            watch = created;
        }
        watch.fronts.add(worker);
        // the value now: the front may have read it in place before this watch, and missed a write since
        if (view_isVariable(watch.view)) {
            this.#queue(worker, index, watch.view.readValue(null));
        }
    }

    #unwatch(worker: Worker, index: number, generation: number): void {
        const watch = this.#watched.get(index);
        if (watch === undefined || watch.generation !== generation || !watch.fronts.delete(worker) || watch.fronts.size > 0) {
            return;
        }
        this.#watched.delete(index);
        this.#stopListening(watch);
    }

    #stopListening(watch: Watch): void {
        watch.view.removeListener("value_changed", watch.onChange as (...args: unknown[]) => void);
        watch.view.removeListener("dispose", watch.onDispose);
    }

    #outgoingTo(worker: Worker): Outgoing {
        let outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined) {
            outgoing = { indexes: [], versions: [], values: [], disposed: [], inFlight: false, waiting: new Map() };
            this.#outgoing.set(worker, outgoing);
        }
        return outgoing;
    }

    #queue(worker: Worker, index: number, dataValue: DataValue): void {
        const outgoing = this.#outgoingTo(worker);
        const version = this.#addressSpace.store.values.version(index);
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
    #schedulePush(): void {
        if (this.#pushScheduled) return;
        this.#pushScheduled = true;
        setImmediate(() => {
            this.#pushScheduled = false;
            for (const [worker, outgoing] of this.#outgoing) {
                if (outgoing.indexes.length > 0 && !outgoing.inFlight) {
                    const changes: EngineToFront = {
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
                    const disposed: EngineToFront = { kind: "disposed", indexes: outgoing.disposed };
                    worker.postMessage(disposed);
                    outgoing.disposed = [];
                }
            }
        });
    }
}

function view_isVariable(view: StoreNodeView): view is StoreVariableView {
    return view.nodeClass === NodeClass.Variable;
}
