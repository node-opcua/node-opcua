/**
 * @module node-opcua-server
 *
 * The counts a server keeps for itself as a whole: what its limits are checked against
 * (sessions, subscriptions, monitored items, connections), what ServerDiagnosticsSummary
 * reports, and the next subscription id.
 *
 * A server keeps them as plain numbers. Servers that answer as one, each in its own thread on
 * the same port (see FrontThreadEngine), keep them in one SharedArrayBuffer: a limit is then
 * taken with an atomic add that fails past the limit, so that no two threads both take the last
 * slot.
 */

export enum ServerCounter {
    Sessions = 0,
    Subscriptions = 1,
    MonitoredItems = 2,
    Connections = 3,
    CumulatedSessions = 4,
    CumulatedSubscriptions = 5,
    RejectedSessions = 6,
    SecurityRejectedSessions = 7,
    RejectedRequests = 8,
    SecurityRejectedRequests = 9,
    SessionTimeouts = 10,
    SessionAborts = 11,
    /** the last subscription id handed out */
    SubscriptionId = 12
}
const COUNTERS = 13;

export interface IServerCounters {
    /** true when the counts are those of several servers answering as one */
    readonly shared: boolean;
    get(counter: ServerCounter): number;
    /** adds `delta`, and answers the new count */
    add(counter: ServerCounter, delta: number): number;
    /** adds one when the count is below `limit`: false, and nothing added, when it is not */
    tryAcquire(counter: ServerCounter, limit: number): boolean;
}

/** the counts of one server, as plain numbers */
export class LocalServerCounters implements IServerCounters {
    public readonly shared = false;
    readonly #values = new Array<number>(COUNTERS).fill(0);

    public get(counter: ServerCounter): number {
        return this.#values[counter];
    }

    public add(counter: ServerCounter, delta: number): number {
        this.#values[counter] += delta; // check-proto-pollution: ok - numeric enum index into an array
        return this.#values[counter];
    }

    public tryAcquire(counter: ServerCounter, limit: number): boolean {
        if (this.#values[counter] >= limit) return false;
        this.#values[counter] += 1; // check-proto-pollution: ok - numeric enum index into an array
        return true;
    }
}

/** the counts of servers in several threads of one process, in a SharedArrayBuffer */
export class SharedServerCounters implements IServerCounters {
    public readonly shared = true;
    readonly #values: Int32Array;

    /** over `buffer`, made by allocate(); the threads all hold the same buffer */
    constructor(buffer: SharedArrayBuffer) {
        this.#values = new Int32Array(buffer);
    }

    /** a buffer for the counts, the subscription ids starting at `firstSubscriptionId` */
    public static allocate(firstSubscriptionId: number): SharedArrayBuffer {
        const buffer = new SharedArrayBuffer(COUNTERS * Int32Array.BYTES_PER_ELEMENT);
        Atomics.store(new Int32Array(buffer), ServerCounter.SubscriptionId, firstSubscriptionId);
        return buffer;
    }

    public get(counter: ServerCounter): number {
        return Atomics.load(this.#values, counter);
    }

    public add(counter: ServerCounter, delta: number): number {
        return Atomics.add(this.#values, counter, delta) + delta;
    }

    public tryAcquire(counter: ServerCounter, limit: number): boolean {
        for (;;) {
            const count = Atomics.load(this.#values, counter);
            if (count >= limit) return false;
            if (Atomics.compareExchange(this.#values, counter, count, count + 1) === count) return true;
        }
    }
}
