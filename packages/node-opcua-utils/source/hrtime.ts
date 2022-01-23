// polyfil for window.performance.now
const performance: any = (typeof global === "object" &&  global.performance) || {};
const performanceNow =
    performance.now ||
    performance.mozNow ||
    performance.msNow ||
    performance.oNow ||
    performance.webkitNow ||
    function () {
        return new Date().getTime();
    };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime_for_browser(previousTimestamp?: [number, number]): [number, number] {
   
    previousTimestamp = previousTimestamp || [0, 0];

    const clocktime = performanceNow.call(performance) * 1e-3;
    let seconds = Math.floor(clocktime);
    let nanoseconds = Math.floor((clocktime % 1) * 1e9);
    if (previousTimestamp) {
        seconds = seconds - previousTimestamp[0];
        nanoseconds = nanoseconds - previousTimestamp[1];
        if (nanoseconds < 0) {
            seconds--;
            nanoseconds += 1e9;
        }
    }
    return [seconds, nanoseconds];
}
export type HRTimeFunc = (time?: [number, number]) => [number, number];
export const hrtime: HRTimeFunc = typeof process === "object" ? (process.hrtime as HRTimeFunc || hrtime_for_browser) : hrtime_for_browser;
