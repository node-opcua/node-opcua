/**
 * @module node-opcua-server
 *
 * What a thread collects for another during a turn of its event loop, posted once at the end of the
 * turn: one batch per target, one message per batch.
 */

export class TurnBatches<K, B> {
    #batches = new Map<K, B>();
    #scheduled = false;
    readonly #create: () => B;
    readonly #post: (target: K, batch: B) => void;
    readonly #schedule: (callback: () => void) => void;

    /** `schedule`: when the batches go, setImmediate (the end of the turn) unless said otherwise */
    constructor(create: () => B, post: (target: K, batch: B) => void, schedule: (callback: () => void) => void = setImmediate) {
        this.#create = create;
        this.#post = post;
        this.#schedule = schedule;
    }

    /** the batch of `target` for this turn, posted with the others when the turn ends */
    public of(target: K): B {
        let batch = this.#batches.get(target);
        if (batch === undefined) {
            batch = this.#create();
            this.#batches.set(target, batch);
        }
        if (!this.#scheduled) {
            this.#scheduled = true;
            this.#schedule(() => this.#postAll());
        }
        return batch;
    }

    /** a target that is gone: its batch is dropped */
    public delete(target: K): void {
        this.#batches.delete(target);
    }

    public clear(): void {
        this.#batches.clear();
    }

    #postAll(): void {
        this.#scheduled = false;
        const batches = this.#batches;
        this.#batches = new Map();
        for (const [target, batch] of batches) this.#post(target, batch);
    }
}
