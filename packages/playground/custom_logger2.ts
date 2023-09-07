import util from "util";

import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { setDebugLogger, setWarningLogger, setErrorLogger } from "node-opcua-debug";
import { OPCUAClient } from "node-opcua-client";

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");
const warningLog = make_warningLog("TEST");

async function main() {

for (let i=0;i<200; i++) {
    warningLog("Hello World", i);
} 
}
main();
