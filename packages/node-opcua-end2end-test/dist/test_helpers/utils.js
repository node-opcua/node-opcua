import { make_errorLog } from "node-opcua-debug";
const errorLog = make_errorLog("TEST");
export async function wait(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}
export async function waitUntilCondition(condition, timeout, message = "") {
    const t = Date.now();
    while (!(await condition())) {
        await wait(100);
        const t2 = Date.now();
        if (t2 - t > timeout) {
            const msg = `waitUntilCondition: Timeout  reached timeout=${timeout} ${message || ""}`;
            errorLog("waitUntilCondition", msg);
            throw new Error(msg);
        }
    }
}
export async function waitForEvent(emitter, event, timeoutMs) {
    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${event} not received within ${timeoutMs} ms`)), timeoutMs);
        emitter.once(event, () => {
            clearTimeout(timer);
            resolve();
        });
    });
}
export const stepLog = (message) => {
    console.log(`${"    -> ".padEnd(40, "-")} ${message}`);
};
/*export function trace_console_log(...args: [string, ...string[]]) {
    const log1 = global.console.log;
    global.console.log = function () {
        const t = new Error("").stack!.split("\n")[2];
        if (t.match(/opcua/)) {
            log1.call(console, cyan(t));
        }
        log1.apply(console, args);
    };
}
*/
export const tracelog = (...args) => {
    const d = new Date();
    const t = `${d.toTimeString().split(" ")[0]}.${d.getMilliseconds().toString().padStart(3, "0")}`;
    console.log.apply(console, [t, ...args]);
};
//# sourceMappingURL=utils.js.map