import  { make_errorLog } from "node-opcua-debug";

const errorLog = make_errorLog("TEST");

export async function wait(duration: number) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}

export async function wait_until_condition(condition: ()=>boolean, timeout: number, message: string = "") {
    const t = Date.now();
    while (!condition()) {
        await wait(100);
        const t2 = Date.now();
        if (t2 - t > timeout) {
            const msg= `wait_until_condition: Timeout  reached timeout=${timeout} ${message ||""}`;
            errorLog("wait_until_condition", msg);
            throw new Error(msg);
        }
    }
}

