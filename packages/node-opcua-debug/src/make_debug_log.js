"use strict";
var path = require("path");
var _ = require("underscore");

var debug_flags = {};

function w(str,l) {
    return (str+"                                    ").substr(0,l);
}

function setDebugFlag(script_fullpath, flag) {
    var filename = path.basename(script_fullpath, ".js");
    if (process.env.DEBUG) {
        var decorated_filename = w(filename,30).yellow;
        console.log(" Setting debug for ",decorated_filename, " to ", flag.toString()[flag ? "cyan" : "red"]);
    }
    debug_flags[filename] = flag;
}

function checkDebugFlag(script_fullpath) {

    var filename = path.basename(script_fullpath, ".js");
    var doDebug = debug_flags[filename] ? true : false;
    if (process.env.DEBUG && !debug_flags.hasOwnProperty(filename) ) {
        doDebug = process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0;
        setDebugFlag(filename,doDebug);
    }
    return doDebug;
}
/**
 * @method make_debugLog
 * @param script_fullpath
 * @return returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
function make_debugLog(script_fullpath) {

    function file_line(filename,caller_line) {
        return (w(filename,30)+ ":" + w(caller_line,5)).bgWhite.cyan;
    }
    var doDebug = checkDebugFlag(script_fullpath);
    var filename = path.basename(script_fullpath, ".js");
    function debugLogFunc() {
        if (debug_flags[filename] ) {

            // caller line number
            var l = (new Error()).stack.split("\n")[2].split(":");
            var caller_line = l[l.length-2];
            var args = [].concat([file_line(filename,caller_line)]  ,_.values(arguments)           );
            console.log.apply(console, args);
        }
    }

    return debugLogFunc;
}

exports.make_debugLog = make_debugLog;
exports.checkDebugFlag = checkDebugFlag;
exports.setDebugFlag = setDebugFlag;
