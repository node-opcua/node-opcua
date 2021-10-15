/**
 * @module node-opcua-secure-channel
 */

/**
 * SequenceNumberGenerator manages a monotonically increasing sequence number.
 * @class SequenceNumberGenerator
 * @constructor
 *
 * @see OPC Unified Architecture, Part 6 -  $6.4.2 page 36 -
 *
 * The SequenceNumber shall also monotonically increase for all messages and shall not wrap
 * around until it is greater than 4294966271 (UInt32.MaxValue – 1024). The first number after
 * the wrap around shall be less than 1024. Note that this requirement means that
 * SequenceNumbers do not reset when a new TokenId is issued.
 * The SequenceNumber shall be incremented by exactly one for each MessageChunk sent unless
 * the communication channel was interrupted and re-established. Gaps are permitted between the
 * SequenceNumber for the last MessageChunk received before the interruption and the
 */
export class SequenceNumberGenerator {

    // spec Part 3 says:
    // The same sequence number shall not be reused on a Subscription until over
    // four billion NotificationMessages have been sent.
    // At a continuous rate of one thousand NotificationMessages per second on a given Subscription, it would
    // take roughly fifty days for the same sequence number to be reused. This allows Clients to safely treat
    // sequence numbers as unique.
    public static MAXVALUE = 4294966271;

    private _counter: number;

    constructor() {
        this._counter = 0;
        this._set(1);
    }

    public next(): number {
        const current = this._counter;
        this._counter += 1;
        if (this._counter > SequenceNumberGenerator.MAXVALUE) {
            this._set(1);
        }
        return current;
    }

    public future(): number {
        return this._counter;
    }

    private _set(value: number) {
        this._counter = value;
    }

}
