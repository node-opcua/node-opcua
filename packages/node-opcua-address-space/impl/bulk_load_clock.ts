/**
 * @module node-opcua-address-space
 *
 * One clock reading for one bulk load.
 *
 * Constructing a Variable stamps it with `getCurrentClock()`, and so does setting its initial
 * value — twice per variable, thousands of times per nodeset, for a timestamp that means
 * "when this was loaded". The readings differ by microseconds and nothing depends on the
 * difference; the syscall behind them is ~1.4% of a load.
 *
 * The reading is taken once when a load begins and reused until it ends. Two things make that
 * safe rather than merely cheaper:
 *
 *  - it is scoped to the **address space being loaded**, not to the process. A server writing
 *    to a different address space, or to this one outside a load, still gets a real clock. A
 *    module-global freeze would have leaked a stale timestamp into any concurrent write.
 *  - it is **reference counted**, so loading a nodeset into an address space that is already
 *    mid-load — grafting onto a partially built space — does not end the freeze early.
 *
 * What changes observably: every Variable a single load creates carries the same
 * `sourceTimestamp` instead of timestamps a few microseconds apart. For nodes that came from
 * one file, at one instant, that is arguably the more truthful answer; it is a change all the
 * same, which is why it is confined to loading.
 */
import { getCurrentClock, type PreciseClock } from "node-opcua-date-time";

interface Frozen {
    clock: PreciseClock;
    depth: number;
}

/**
 * Keyed weakly, so an address space that is disposed and dropped takes its entry with it —
 * a load that throws before `endBulkLoadClock` cannot pin one either.
 */
const frozen = new WeakMap<object, Frozen>();

/** begin a load: take the reading the load will stamp everything with */
export function beginBulkLoadClock(addressSpace: object): void {
    const existing = frozen.get(addressSpace);
    if (existing) {
        existing.depth += 1;
        return;
    }
    frozen.set(addressSpace, { clock: getCurrentClock(), depth: 1 });
}

/** end a load; the innermost end of a nested pair is not the one that thaws it */
export function endBulkLoadClock(addressSpace: object): void {
    const existing = frozen.get(addressSpace);
    if (!existing) return;
    existing.depth -= 1;
    if (existing.depth <= 0) {
        frozen.delete(addressSpace);
    }
}

/**
 * the clock to stamp a node with: the load's reading while one is in progress for this address
 * space, a fresh reading otherwise.
 */
export function loadClock(addressSpace: object | null | undefined): PreciseClock {
    const existing = addressSpace ? frozen.get(addressSpace) : undefined;
    return existing ? existing.clock : getCurrentClock();
}
