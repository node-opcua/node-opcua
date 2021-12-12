"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const { make_debugLog } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");

const chalk = require("chalk");
const crypto_utils = require("node-opcua-crypto");

/**
 * @method start_simple_server
 * @param options
 * @param options.env
 * @param options.server_sourcefile {String} the path to the server source file
 * @return Handle
 */
async function start_simple_server(options) {
    options = options || {};

    const serverScript = options.server_sourcefile || path.join(__dirname, "./bin/simple_server.js");

    if (!fs.existsSync(serverScript)) {
        throw new Error("start_simple_server : cannot find server script : " + options.server_sourcefile);
    }
    const port = options.port || "2222";

    delete options.server_sourcefile;
    delete options.port;

    options.env = options.env || {};
    options.env = {
        ...options.env,
        ...process.env
    };

    options.env.DEBUG = options.env.DEBUG2 || "";
    options.env.NODEOPCUADEBUG = "";

    //xx options.env.DEBUG = "ALL";

    const server_exec = spawn("node", [serverScript, "-p", port], options);

    const serverCertificateFilename = path.join(__dirname, "../../node-opcua-samples/certificates/server_cert_2048.pem");

    if (process.env.DEBUG2 || process.env.DEBUG) {
        console.log(" node ", serverScript);
    }

    return await new Promise((resolve, reject) => {
        function detect_early_termination(code, signal) {
            console.log("child process terminated due to receipt of signal " + signal + " code = " + code);
            reject(new Error("Process has terminated unexpectedly with code=" + code + " signal=" + signal));
        }

        let callback_called = false;
        let pid_collected = 0;

        function detect_ready_message(data) {
            if (!callback_called) {
                if (/server PID/.test(data)) {
                    // note : on windows , when using nodist, the process.id might not correspond to the
                    //        actual process id of our server. We collect here the real PID of our process
                    //        as output by the server on the console.
                    const m = data.match(/([0-9]+)$/);
                    pid_collected = parseInt(m[1], 10);
                }
                if (/server now waiting for connections./.test(data)) {
                    server_exec.removeListener("close", detect_early_termination);
                    callback_called = true;

                    setTimeout(function () {
                        const data = {
                            process: server_exec,
                            pid_collected: pid_collected,
                            endpointUrl: "opc.tcp://" + os.hostname() + ":" + port,
                            serverCertificate: crypto_utils.readCertificate(serverCertificateFilename)
                        };
                        debugLog("data", data.endpointUrl);
                        debugLog("certificate", data.serverCertificate.toString("base64").substring(0, 32) + "...");
                        debugLog("pid", data.pid_collected);

                        resolve(data);
                    }, 100);
                }
            }
        }

        server_exec.on("close", detect_early_termination);

        server_exec.on("error", (err) => {
            console.log("xxxx child process terminated due to receipt of signal ", err);
        });

        function dumpData(prolog, data) {
            data = "" + data;
            data = data.split("\n");

            data.filter(function (a) {
                return a.length > 0;
            }).forEach(function (data) {
                detect_ready_message(data);
                if (!options.silent) {
                    console.log(prolog + data);
                }
            });
        }

        server_exec.stdout.on("data", (data) => {
            dumpData(chalk.cyan("stdout:  "), data.toString("utf8"));
        });
        server_exec.stderr.on("data", (data) => {
            dumpData(chalk.red("stderr: "), data.toString("utf8"));
        });
    });
}

async function crash_simple_server(serverHandle) {
    if (!serverHandle) {
        return;
    }
    await new Promise((resolve) => {
        serverHandle.process.once("exit", (err) => {
            debugLog("process killed");
            resolve();
        });
        serverHandle.process.kill("SIGTERM");
        serverHandle = null;
    });
}
// async function stop_simple_server(serverHandle) {
//     // note : it looks like kill is not working on windows

//     if (!serverHandle) {
//         return;
//     }
//     console.log(
//         " SHUTTING DOWN : killed = ",
//         serverHandle.process.killed,
//         " pid = ",
//         serverHandle.process.pid,
//         "collected pid=",
//         serverHandle.pid_collected
//     );

//     await new Promise((resolve) => {
//         serverHandle.process.on("close", function (/*err*/) {
//             //xx console.log("XXXXX child process terminated due to receipt of signal ");
//             resolve();
//         });

//         process.kill(serverHandle.process.pid, "SIGKILL");
//         if (serverHandle.process.pid !== serverHandle.pid_collected) {
//             try {
//                 process.kill(serverHandle.pid_collected, "SIGKILL");
//             } catch (err) {
//                 /**/
//             }
//         }

//         /* istanbul ignore next */
//         if (process.platform === "win32" && false) {
//             // under windows, we can also kill a process this way...
//             spawn("taskkill", ["/pid", serverHandle.pid_collected, "/f", "/t"]);
//         }
//     });
// }

exports.start_simple_server = start_simple_server;
exports.stop_simple_server = crash_simple_server;
exports.crash_simple_server = crash_simple_server;
