import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import os from "os";
import { make_debugLog } from "node-opcua-debug";
import chalk from "chalk";
import { readCertificate } from "node-opcua-crypto";
import { OPCUAServerOptions } from "node-opcua-server";

const debugLog = make_debugLog("TEST");

/**
 * @method start_simple_server
 * @param options
 * @param options.env
 * @param options.server_sourcefile {String} the path to the server source file
 * @return Handle
 */
export async function start_simple_server(options: { 
    silent?: boolean, 
    env?: any, 
    port?: string | number, 
    server_sourcefile: string 
}) {
    options = options || {};

    options.silent = false;

    const serverScript = options.server_sourcefile || path.join(__dirname, "./bin/simple_server.js");

    if (!fs.existsSync(serverScript)) {
        throw new Error("start_simple_server : cannot find server script : " + options.server_sourcefile);
    }
    const port = options.port || "2222";

    delete (options as any).server_sourcefile;
    delete options.port;

    options.env = options.env || {};
    options.env = {
        ...options.env,
        ...process.env
    };

    options.env.DEBUG = options.env.DEBUG2 || "";
    options.env.NODEOPCUADEBUG = "";

    //xx options.env.DEBUG = "ALL";

    const server_exec = spawn("node", [serverScript, "-p", "" + port ], options);

    const serverCertificateFilename = path.join(__dirname, "../../node-opcua-samples/certificates/server_cert_2048.pem");

    if (process.env.DEBUG2 || process.env.DEBUG) {
        console.log(" node ", serverScript);
        console.log(server_exec.spawnargs.join(" "));
    }

    return await new Promise((resolve, reject) => {
        function detect_early_termination(code: number, signal: any) {
            console.log("child process terminated due to receipt of signal " + signal + " code = " + code);
            console.log("serverScript: ", serverScript);
            console.log(" -p ", port);
            reject(new Error("Process has terminated unexpectedly with code=" + code + " signal=" + signal));
        }

        let callback_called = false;
        let pid_collected = 0;

        function detect_ready_message(data: string) {
            if (!callback_called) {
                if (/server PID/.test(data)) {
                    // note : on windows , when using nodist, the process.id might not correspond to the
                    //        actual process id of our server. We collect here the real PID of our process
                    //        as output by the server on the console.
                    const m = data.match(/([0-9]+)$/)!;
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
                            serverCertificate: readCertificate(serverCertificateFilename)
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

        function dumpData(prolog: string, data: string) {
            data = "" + data;
            const data2 = data.split("\n") ;
            data2.filter(function (a) {
                return a.length > 0;
            }).forEach( (line) =>{
                detect_ready_message(line);
                if (!options.silent) {
                    console.log(prolog + line);
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
export async function stop_simple_server(serverHandle: any) {
    return await crash_simple_server(serverHandle);
}
export async function crash_simple_server(serverHandle: any) {
    if (!serverHandle) {
        return;
    }
    await new Promise<void>((resolve) => {
        serverHandle.process.once("exit", (err: Error) => {
            debugLog("process killed");
            resolve();
        });
        serverHandle.process.kill("SIGTERM");
        serverHandle.process.kill("SIGKILL");
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