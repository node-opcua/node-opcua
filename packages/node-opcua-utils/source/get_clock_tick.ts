export let get_clock_tick: () => number;

if (process.hrtime) {
    const tick_origin = process.hrtime()[0];
    // clock it as a double in millisecond
    // so we can measure very tiny time intervals
    get_clock_tick = function get_clock_tick() {
        const hrt = process.hrtime();
        const r = (hrt[0] - tick_origin) * 1000.0 + Math.ceil(hrt[1] / 1e6 * 1000) / 1000;
        return r;
    };
} else {
    get_clock_tick = function get_clock_tick() {
        return Date.now();
    };
}
