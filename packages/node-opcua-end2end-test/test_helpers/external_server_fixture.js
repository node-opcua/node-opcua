"use strict";
const chalk = require("chalk");
const crypto_utils = require("node-opcua-crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
function constructFilename(p) {
    const filename = path.join(__dirname, "..", p);
    //xx console.log("fi = ",filename);
    if (!fs.existsSync(filename)) {
        throw new Error("Cannot find " + filename);
    }
    return filename;
}

/**
 * @method start_simple_server
 * @param options
 * @param options.env
 * @param [options.server_sourcefile {String} ="./bin/simple_server"]
 * @param [options.port {String} = 2223]
 * @param callback {Function}
 * @param callback.error {Error|Null}
 * @param callback.data
 * @param callback.data.process
 * @param callback.data.endpointUrl
 * @param callback.data.serverCertificate
 *
 */
function start_simple_server(options, callback) {

    if (typeof options === "function") {
        callback = options;
        options = null;
    }
    options = options || {};

    const server_script = options.server_sourcefile || "./bin/simple_server.js";

    if (!fs.existsSync(server_script)) {
        throw new Error("start_simple_server : cannot find server script : " + server_script);

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

    const server_exec = spawn("node", [server_script, "-p", port], options);

    const serverCertificateFilename = constructFilename("certificates/server_cert_2048.pem");

    console.log(" node ", server_script);

    function detect_early_termination(code, signal) {
        console.log("child process terminated due to receipt of signal " + signal);
        callback(new Error("Process has terminated unexpectedly with code=" + code + " signal=" + signal));
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

                setTimeout(function() {

                    callback(null, {
                        process: server_exec,
                        pid_collected: pid_collected,
                        endpointUrl: "opc.tcp://" + os.hostname() + ":" + port,
                        serverCertificate: crypto_utils.readCertificate(serverCertificateFilename)
                    });

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

        data.filter(function(a) {
            return a.length > 0;
        }).forEach(function(data) {

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

}

function stop_simple_server(serverHandle, callback) {

    // note : it looks like kill is not working on windows

    if (!serverHandle) {
        return callback(null);
    }
    console.log(" SHUTTING DOWN : killed = ", serverHandle.process.killed,
        " pid = ", serverHandle.process.pid,
        "collected pid=", serverHandle.pid_collected);

    serverHandle.process.on("close", function(/*err*/) {
        //xx console.log("XXXXX child process terminated due to receipt of signal ");
        setTimeout(callback, 100);
    });

    process.kill(serverHandle.process.pid, "SIGKILL");
    if (serverHandle.process.pid !== serverHandle.pid_collected) {
        try {
            process.kill(serverHandle.pid_collected, "SIGKILL");

        }
        catch (err) {/**/ }
    }

    /* istanbul ignore next */
    if (process.platform === "win32" && false) {
        // under windows, we can also kill a process this way...
        spawn("taskkill", ["/pid", serverHandle.pid_collected, "/f", "/t"]);
    }

}


exports.start_simple_server = start_simple_server;
exports.stop_simple_server = stop_simple_server;
