// a session worker that never answers "stop": it blocks in a synchronous child process, out of reach of terminate()
import { execFileSync } from "node:child_process";
import { parentPort } from "node:worker_threads";

parentPort.on("message", (message) => {
    if (message.kind === "stop") execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 15000)"]);
});
parentPort.postMessage({ kind: "ready", endpointUrl: "" });
