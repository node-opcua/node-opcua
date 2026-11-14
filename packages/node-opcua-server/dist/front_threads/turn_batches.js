/**
 * @module node-opcua-server
 *
 * What a thread collects for another during a turn of its event loop, posted once at the end of the
 * turn: one batch per target, one message per batch.
 */
export class TurnBatches {
    #batches = new Map();
    #scheduled = false;
    #create;
    #post;
    #schedule;
    /** `schedule`: when the batches go, setImmediate (the end of the turn) unless said otherwise */
    constructor(create, post, schedule = setImmediate) {
        this.#create = create;
        this.#post = post;
        this.#schedule = schedule;
    }
    /** the batch of `target` for this turn, posted with the others when the turn ends */
    of(target) {
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
    delete(target) {
        this.#batches.delete(target);
    }
    clear() {
        this.#batches.clear();
    }
    #postAll() {
        this.#scheduled = false;
        const batches = this.#batches;
        this.#batches = new Map();
        for (const [target, batch] of batches)
            this.#post(target, batch);
    }
}
//# sourceMappingURL=turn_batches.js.map