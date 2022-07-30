const { make_errorLog } = require("node-opcua-debug");

const errorLog = make_errorLog("TEST");

async function wait(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}

async function wait_until_condition(condition, timeout, message) {
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

module.exports.wait_until_condition = wait_until_condition;
module.exports.wait = wait;
