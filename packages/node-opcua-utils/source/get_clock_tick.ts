/**
 * @module node-opcua-utils
 */
export let get_clock_tick: () => number;
import { hrtime } from "./hrtime";

if (typeof process === "object" && process.hrtime) {
    const tickOrigin = process.hrtime();
    // clock it as a double in millisecond
    // so we can measure very tiny time intervals
    get_clock_tick = () => {
        const hrt = process.hrtime(tickOrigin);
        const r = (hrt[0]) * 1000.0 + Math.ceil((hrt[1] / 1e6) * 1000) / 1000;
        return r;
    };
} else {
    get_clock_tick = () => Date.now();
}
