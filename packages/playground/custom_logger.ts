import util from "util";
import { createLogger, transports, format } from "winston";

import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { setDebugLogger, setWarningLogger, setErrorLogger } from "node-opcua-debug";
import { OPCUAClient } from "node-opcua-client";

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");
const warningLog = make_warningLog("TEST");

const stripColorFormat = format(function stripColor(info) {
    //   info.message = info.message[0];
    const code = /\u001b\[(\d+(;\d+)*)?m/g; // eslint-disable-line no-control-regex
    info.message = info.message.replace(code, "");
    return info;
})();
const alignColorsAndTime = format.combine(
    //  stripColorFormat,
    format.errors({ stack: false }),
    format.timestamp({
        format: "YY-MM-DD HH:MM:SS"
    }),
    stripColorFormat,
    format.cli(),
    // format.colorize({
    //     all: true
    // }),
    // format.prettyPrint({
    //    //  colorize: process.stdout.isTTY
    // }),
    format.label({
         label: "[NodeOPCUA]"
    }),
    format.printf((info) => ` ${info.label}  ${info.timestamp}  ${info.level} : ${info.message}`)
);

const logger = createLogger({
    level: "debug",

    transports: [
        new transports.Console({
            // format: format.simple(),
            format: alignColorsAndTime
        })
    ]
});

console.log("B");

setDebugLogger((...args: any[]) => {
    logger.debug(util.format(...args));
});
setWarningLogger((...args: any[]) => {
    logger.warn(util.format(...args));
});
setErrorLogger((...args: any[]) => {
    logger.error(util.format(...args));
});
console.log("C");

async function main() {
    console.log();
    debugLog("Hello World");
    errorLog("Hello", "World", { a: 1 });
    warningLog("Hello World");

    const client = OPCUAClient.create({
        endpoint_must_exist: false
    });

    const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
    await client.withSessionAsync(endpointUrl, async (session) => {
        warningLog("Connected");
    });
    errorLog(new Error("Cannot do this !"));
}
main();
