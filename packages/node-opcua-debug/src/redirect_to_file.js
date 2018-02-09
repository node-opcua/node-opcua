"use strict";

const _ = require("underscore");
const assert = require("node-opcua-assert");
const fs = require("fs");
const util = require("util");

const getTempFilename = require("./get_temp_filename").getTempFilename;

/**
 * @method redirectToFile
 * @param tmpfile {String} log file name to redirect console output.
 * @param action_func {Function} - the inner function to execute
 * @param callback
 */
function redirectToFile(tmpfile, action_func, callback) {

    var old_console_log;

    assert(_.isFunction(action_func));
    assert(!callback || _.isFunction(callback));

    var is_async = action_func && action_func.length;

    var log_file = getTempFilename(tmpfile);

    //xx    console.log(" log_file ",log_file);
    var f = fs.createWriteStream(log_file, {flags: 'w', encoding: "ascii"});

    function _write_to_file(d) { //

        var msg = util.format.apply(null, arguments);

        f.write(msg + '\n');
        if (process.env.DEBUG) {
            old_console_log.call(console, msg);
        }
    }


    if (!is_async) {

        old_console_log = console.log;

        console.log = _write_to_file;

        // async version
        try{
            action_func();
        }
        catch(err){
            console.log = old_console_log;

            console.log("redirectToFile  has intercepted an error :" , err);
            // we don't want the callback anymore since we got an error
            // display file on screen  for insvestigation

            console.log(fs.readFileSync(log_file).toString("ascii"));

            f.end(function() {
                callback(err);
            });

        }
        console.log = old_console_log;
        f.end(callback);

    } else {

        old_console_log = console.log;
        console.log = _write_to_file;

        // async version

        action_func(function (err) {
            assert(callback);
            console.log = old_console_log;
            if (err) {
                console.log("redirectToFile  has intercepted an error");
                throw err;
            }
            f.end(callback);
        });
    }
}
exports.redirectToFile = redirectToFile;