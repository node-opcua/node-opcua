import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import { makeSHA1Thumbprint, readCertificateChain } from "node-opcua-crypto";
import { make_debugLog } from "node-opcua-debug";
import type { ServerCapabilitiesOptions } from "node-opcua-server";

const debugLog = make_debugLog("TEST");

export interface ServerHandle {
    process: ChildProcess;
    pid_collected: number;
    endpointUrl: string;
    serverCertificate: Buffer;
}

export interface IStartServerOptions {
    silent?: boolean;
    env?: Record<string, string | undefined>;
    port?: number;
    server_sourcefile: string;
    maxConnectionsPerEndpoint?: number;
    nodeset_filename?: string[];
    serverCapabilities?: ServerCapabilitiesOptions;
}
export async function start_simple_server(options: IStartServerOptions): Promise<ServerHandle> {
    const maxRetries = 5;
    const retryDelay = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await _start_simple_server_once({ ...options });
        } catch (err) {
            const isRetryable = attempt < maxRetries && /code=3/.test((err as Error).message);
            if (isRetryable) {
                console.log(
                    `start_simple_server: attempt ${attempt} failed (${(err as Error).message}), retrying in ${retryDelay}ms...`
                );
                await new Promise((r) => setTimeout(r, retryDelay));
                continue;
            }
            throw err;
        }
    }
    throw new Error("start_simple_server: all retries exhausted");
}

async function _start_simple_server_once(options: {
    silent?: boolean;
    env?: Record<string, string | undefined>;
    port?: string | number;
    server_sourcefile: string;
}): Promise<ServerHandle> {
    options = options || {};

    options.silent = false;

    const serverScript = options.server_sourcefile || path.join(__dirname, "./bin/simple_server.js");

    if (!fs.existsSync(serverScript)) {
        throw new Error(`start_simple_server : cannot find server script : ${options.server_sourcefile}`);
    }
    const port = options.port || "2222";

    delete (options as unknown as { server_sourcefile?: string }).server_sourcefile;
    delete options.port;

    options.env = options.env || {};
    options.env = {
        ...options.env,
        ...process.env
    };

    options.env.DEBUG = options.env.DEBUG2 || "";
    options.env.NODEOPCUADEBUG = "";

    //xx options.env.DEBUG = "ALL";

    const server_exec = spawn("node", [serverScript, "-p", `${port}`], options);

    const serverCertificateFilename = path.join(__dirname, "../../node-opcua-samples/certificates/server_cert_2048.pem");

    if (process.env.DEBUG2 || process.env.DEBUG) {
        console.log(" node ", serverScript);
        console.log(server_exec.spawnargs.join(" "));
    }

    return await new Promise((resolve, reject) => {
        function detect_early_termination(code: number, signal: string | null) {
            console.log(`child process terminated due to receipt of signal ${signal} code = ${code}`);
            console.log("serverScript: ", serverScript);
            console.log(" -p ", port);
            reject(new Error(`Process has terminated unexpectedly with code=${code} signal=${signal}`));
        }

        let callback_called = false;
        let pid_collected = 0;

        function detect_ready_message(data: string) {
            if (!callback_called) {
                if (/server PID/.test(data)) {
                    // note : on windows , when using nodist, the process.id might not correspond to the
                    //        actual process id of our server. We collect here the real PID of our process
                    //        as output by the server on the console.
                    const m = data.match(/([0-9]+)$/);
                    pid_collected = parseInt(m?.[1] ?? "0", 10);
                }
                if (/server now waiting for connections./.test(data)) {
                    server_exec.removeListener("close", detect_early_termination);
                    callback_called = true;

                    setTimeout(() => {
                        const data = {
                            process: server_exec,
                            pid_collected: pid_collected,
                            endpointUrl: `opc.tcp://${os.hostname()}:${port}`,
                            serverCertificate: readCertificateChain(serverCertificateFilename)[0]
                        };
                        debugLog("data", data.endpointUrl);

                        const thumbprint = makeSHA1Thumbprint(data.serverCertificate);
                        debugLog("certificate", `${thumbprint.toString("hex").substring(0, 32)}...`);
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
            data = `${data}`;
            const data2 = data.split("\n");
            data2
                .filter((a) => a.length > 0)
                .forEach((line) => {
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
export async function stop_simple_server(serverHandle: ServerHandle) {
    return await crash_simple_server(serverHandle);
}
export async function crash_simple_server(serverHandle: ServerHandle) {
    if (!serverHandle) {
        return;
    }
    await new Promise<void>((resolve) => {
        serverHandle.process.once("close", (_code: number, _signal: string) => {
            debugLog("process killed");
            resolve();
        });
        serverHandle.process.kill("SIGTERM");
        serverHandle.process.kill("SIGKILL");
    });
}
