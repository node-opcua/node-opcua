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

    var f = fs.createWriteStream(log_file, {flags: 'w', encoding: "ascii"});

    function _write_to_file(d) { //

        var msg = util.format.apply(null, arguments);
        f.write(msg + '\n');
        if (process.env.DEBUG) {
            old_console_log.call(old_console_log, msg);
        }
    }

    f.on('finish', function () {
        if (callback) {
            callback();
        }
    });

    if (!is_async) {

        old_console_log = console.log;

        console.log = _write_to_file;

        // async version
        try{
            action_func();
        }
        catch(err){
            console.log = old_console_log;

            console.log("redirectToFile  has intercepted an error");
            // we don't want the callback anymore since we got an error
            callback = function() {
                // display file on screen  for insvestigation
                console.log(fs.readFileSync(log_file).toString("ascii"));
                // rethrow exception
                throw err;
            };
            f.end();

        }
        console.log = old_console_log;

        f.end();

    } else {

        old_console_log = console.log;
        console.log = _write_to_file;

        // async version
        action_func(function (err) {
            assert(callback);
            f.end();
            console.log = old_console_log;
        });
    }
}
exports.redirectToFile = redirectToFile;