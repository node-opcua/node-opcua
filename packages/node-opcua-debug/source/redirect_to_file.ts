const _ = require("underscore");
const fs = require("fs");
const util = require("util");

import { assert } from "node-opcua-assert";
import { getTempFilename } from "./get_temp_filename";

/**
 * @method redirectToFile
 * @param tmpfile {String} log file name to redirect console output.
 * @param action_func {Function} - the inner function to execute
 * @param callback
 */
declare function LogFunc(message: any): void;

export function redirectToFile(tmpfile: string, action_func: Function, callback: Function | null): void {
    let old_console_log: any;

    assert(_.isFunction(action_func));
    assert(!callback || _.isFunction(callback));

    const is_async = action_func && action_func.length;

    const log_file = getTempFilename(tmpfile);

    //xx    console.log(" log_file ",log_file);
    const f = fs.createWriteStream(log_file, { flags: "w", encoding: "ascii" });

    function _write_to_file(d: string) {
        //

        const msg = util.format.apply(null, arguments);

        f.write(msg + "\n");
        if (process.env.DEBUG) {
            old_console_log.call(console, msg);
        }
    }

    if (!is_async) {
        old_console_log = console.log;

        console.log = _write_to_file;

        // async version
        try {
            action_func();
        } catch (err) {
            console.log = old_console_log;

            console.log("redirectToFile  has intercepted an error :", err);
            // we don't want the callback anymore since we got an error
            // display file on screen  for insvestigation

            console.log(fs.readFileSync(log_file).toString("ascii"));

            f.end(function() {
                callback && callback(err);
            });
        }
        console.log = old_console_log;
        f.end(callback);
    } else {
        old_console_log = console.log;
        console.log = _write_to_file;

        // async version

        action_func(function(err: Error) {
            assert(_.isFunction(callback));
            console.log = old_console_log;
            if (err) {
                console.log("redirectToFile  has intercepted an error");
                throw err;
            }
            f.end(callback);
        });
    }
}
