import chalk from "chalk";
import path from "path";
import fs from "fs";
import os from "os";
import {
    OPCUAServer,
    OPCUADiscoveryServer,
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { assert } from "node-opcua-assert";
import { createServerCertificateManager } from "../../../test_helpers/createServerCertificateManager";


import { stepLog } from "./_helper";


const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

