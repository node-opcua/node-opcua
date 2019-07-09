/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
// tslint:disable:ban-types
import * as fs from "fs";
import * as  _ from "underscore";
import * as util from "util";

import { assert } from "node-opcua-assert";
import { getTempFilename } from "./get_temp_filename";

/**
 * @method redirectToFile
 * @param tmpFile {String} log file name to redirect console output.
 * @param actionFct  the inner function to execute
 * @param callback
 */
export function redirectToFile(
  tmpFile: string,
  actionFct: Function,
  callback: ((err?: Error) => void) | null
): void {

    let oldConsoleLog: any;

    assert(_.isFunction(actionFct));
    assert(!callback || _.isFunction(callback));

    const isAsync = actionFct && actionFct.length;

    const logFile = getTempFilename(tmpFile);

    // xx    console.log(" log_file ",log_file);
    const f = fs.createWriteStream(logFile, { flags: "w", encoding: "ascii" });

    function _write_to_file(...args: [any, ...any[]]) {

        const msg = util.format.apply(null, args);
        f.write(msg + "\n");
        if (process.env.DEBUG) {
            oldConsoleLog.call(console, msg);
        }
    }

    if (!isAsync) {
        oldConsoleLog = console.log;

        console.log = _write_to_file;

        // async version
        try {
            actionFct();
        } catch (err) {
            console.log = oldConsoleLog;

            console.log(" log file = ", logFile);
            console.log("redirectToFile  has intercepted an error :", err);
            // we don't want the callback anymore since we got an error
            // display file on screen  for investigation

            console.log(fs.readFileSync(logFile).toString("ascii"));

            f.end(() => {
                if (callback) {
                    callback(err);
                }
            });
        }
        console.log = oldConsoleLog;
        f.end(callback);
    } else {
        oldConsoleLog = console.log;
        console.log = _write_to_file;

        // async version

        actionFct((err: Error) => {
            assert(_.isFunction(callback));
            console.log = oldConsoleLog;
            if (err) {
                console.log("redirectToFile  has intercepted an error");
                throw err;
            }
            f.end(callback);
        });
    }
}
