import util from "node:util";
import { OPCUAClient } from "node-opcua-client";
import { make_debugLog, make_errorLog, make_warningLog, setDebugLogger, setErrorLogger, setWarningLogger } from "node-opcua-debug";
import { createLogger, format, transports } from "winston";

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");
const warningLog = make_warningLog("TEST");

const stripColorFormat = format(function stripColor(info) {
    //   info.message = info.message[0];
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matches ANSI escape codes to strip color from log output
    const code = /\u001b\[(\d+(;\d+)*)?m/g;
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

setDebugLogger((...args: unknown[]) => {
    logger.debug(util.format(...args));
});
setWarningLogger((...args: unknown[]) => {
    logger.warn(util.format(...args));
});
setErrorLogger((...args: unknown[]) => {
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
    await client.withSessionAsync(endpointUrl, async (_session) => {
        warningLog("Connected");
    });
    errorLog(new Error("Cannot do this !"));
}
main();
