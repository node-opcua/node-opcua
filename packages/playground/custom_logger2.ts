import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const _debugLog = make_debugLog("TEST");
const _errorLog = make_errorLog("TEST");
const warningLog = make_warningLog("TEST");

async function main() {
    for (let i = 0; i < 200; i++) {
        warningLog("Hello World", i);
    }
}
main();
