/**
 * @module node-opcua-server
 *
 * What a thread collects for another during a turn of its event loop, posted once at the end of the
 * turn: one batch per target, one message per batch.
 */
export declare class TurnBatches<K, B> {
    #private;
    /** `schedule`: when the batches go, setImmediate (the end of the turn) unless said otherwise */
    constructor(create: () => B, post: (target: K, batch: B) => void, schedule?: (callback: () => void) => void);
    /** the batch of `target` for this turn, posted with the others when the turn ends */
    of(target: K): B;
    /** a target that is gone: its batch is dropped */
    delete(target: K): void;
    clear(): void;
}
//# sourceMappingURL=turn_batches.d.ts.map