/**
 * @module node-opcua-server
 *
 * The push of the value changes of the store to the workers: the nodes the monitored items of a
 * worker listen to, and the changes of each turn of the event loop in one message per worker.
 */
import type { Worker } from "node:worker_threads";
import type { CompactAddressSpace } from "node-opcua-address-space";
export declare class ValueWatches {
    #private;
    constructor(addressSpace: CompactAddressSpace);
    /** the watch and unwatch operations a worker sent, three numbers each */
    apply(worker: Worker, operations: number[]): void;
    /** the worker finished with the "changes" message in flight */
    changesDone(worker: Worker): void;
    /** a worker that ended: it listens to nothing any longer */
    workerGone(worker: Worker): void;
    stopAll(): void;
}
//# sourceMappingURL=value_watches.d.ts.map