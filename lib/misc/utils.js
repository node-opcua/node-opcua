"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

require("colors");
var assert = require("better-assert");
var _ = require("underscore");
var fs = require("fs");
var util = require("util");

/**
 * set a flag
 * @method set_flag
 * @param value
 * @param mask
 * @return {number}
 */
function set_flag(value, mask) {
    assert(mask !== undefined);
    return (value | mask.value);
}
exports.set_flag = set_flag;
/**
 * check if a set of bits are set in the values
 * @method check_flag
 *
 * @param value
 * @param mask
 * @return {boolean}
 */
function check_flag(value, mask) {
    assert(mask !== undefined && mask.value);
    return ((value & mask.value) === mask.value);
}
exports.check_flag = check_flag;

/**
 * @method getObjectClassName
 * @param obj
 * @return {string}
 */
function getObjectClassName(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}


function buffer_ellipsis(buffer, start, end) {
    start = start || 0;
    end = end || buffer.length;
    if (end - start < 40) {
        return buffer.slice(start, end).toString("hex");
    }
    return buffer.slice(start, start + 10).toString("hex") + " ... " +
        buffer.slice(end - 10, end).toString("hex");

}

function toHex(i, nb) {
    return ("000000000000000" + i.toString(16)).substr(-nb);
}
function hexDump(buffer, width) {
    if (!buffer) {
        return "<>";
    }
    width = width || 32;
    var hexy = require("hexy");
    if (buffer.length > 1024) {

        return hexy.hexy(buffer.slice(0, 1024), {width: width, format: "twos"}) + "\n .... ( " + buffer.length + ")";
    } else {
        return hexy.hexy(buffer, {width: width, format: "twos"});
    }
}

function compare_buffers(buf1, buf2, max_length) {

    max_length = max_length || buf2.length;
    var block_length = 80;
    var cursor = 0;
    while (cursor < max_length) {
        var slice1 = buf1.slice(cursor, cursor + block_length);
        var slice2 = buf2.slice(cursor, cursor + block_length);
        if (slice2.toString("hex") !== slice1.toString("hex")) {
            console.log("pos = ", cursor);
            console.log("slice1 :", buffer_ellipsis(slice1).yellow);
            console.log("slice2 :", buffer_ellipsis(slice2).blue);
        }
        cursor += block_length;
    }
    // xx buf1.length.should.equal(max_length);

}


var debug_flags = {};
function setDebugFlag(script_fullpath, flag) {
    debug_flags[script_fullpath] = flag;
}

function checkDebugFlag(script_fullpath) {

    var doDebug = debug_flags[script_fullpath] ? true : false;
    if (process.env.DEBUG) {
        var path = require("path");
        var filename = path.basename(script_fullpath, ".js");
        doDebug = process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0;
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

    var doDebug = checkDebugFlag(script_fullpath);

    function debugLogFunc() {
        if (doDebug) {
            console.log.apply(console, arguments);
        }
    }

    return debugLogFunc;
}


var path = require("path");
function getTempFilename(tmpfile) {
    tmpfile = tmpfile || "";
    return path.normalize(path.join(__dirname,'../../tmp/',tmpfile));

}
exports.getTempFilename = getTempFilename;


/**
 * @method redirectToFile
 * @param tmpfile {String} log file name to redirect console output.
 * @param action_func {Function} - the inner function to execute
 * @param callback
 */
function redirectToFile(tmpfile, action_func, callback) {

    assert(_.isFunction(action_func));
    assert(!callback || _.isFunction(callback));

    var is_async = action_func && action_func.length;

    var log_file = getTempFilename(tmpfile);

    var f = fs.createWriteStream(log_file, {flags: 'w', encoding: "ascii"});

    function _write_to_file(d) { //

        var msg = util.format.apply(null, arguments);
        f.write(msg + '\n');
        if (process.env.DEBUG) {
            old_console_log.call(this, msg);
        }
    }

    f.on('finish', function () {
        //xx console.log("done");
        //xx console.log(fs.readFileSync(log_file,"ascii"));
        if (callback) {
            callback();
        }
    });

    if (!is_async) {

        var old_console_log = console.log;

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
            console.log("err = ",err);
        });


    }


//    f.write("", callback);
    // f.close();
}

/**
 * @method makeBuffer
 * turn a string make of hexadecimal bytes into a buffer
 *
 * @example
 *     var buffer = makeBuffer("BE EF");
 *
 * @param listOfBytes
 * @return {Buffer}
 */
function makeBuffer(listOfBytes) {
    var l = listOfBytes.split(" ");
    var b = new Buffer(l.length);
    var i = 0;
    l.forEach(function (value) {
        b.writeUInt8(parseInt(value, 16), i);
        i += 1;
    });
    return b;
}

function replaceBufferWithHexDump(obj) {
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            if (obj[p] instanceof Buffer) {
                obj[p] = "<BUFFER>" + obj[p].toString("hex") + "</BUFFER>";
            } else if (typeof obj[p] === "object") {
                replaceBufferWithHexDump(obj[p]);
            }
        }
    }
    return obj;
}

function display_trace_from_this_projet_only(err) {

    console.log(" display_trace_from_this_projet_only = ".cyan.bold);
    if (err) {
        console.log(err.message);
    }
    err = err || new Error();
    var stack = err.stack;
    if (stack) {
        stack = (stack.split("\n").filter(function (el) {
            return el.match(/node-opcua/) && !el.match(/node_modules/);
        }));
        //xx stack.shift();
        console.log(stack.join("\n").yellow);
    } else {
        console.log(" NO STACK TO TRACE !!!!".red);
    }

}

function dump(obj) {
    console.log("\n", util.inspect(JSON.parse(JSON.stringify(obj)), {colors: true, depth: 10}));
}
function dumpIf(condition, obj) {

    if (condition) {
        dump(obj);
    }
}

function get_clock_tick() {
    return Date.now();
}

function clone_buffer(buffer) {
    var clone = new Buffer(buffer.length);
    buffer.copy(clone, 0, 0);
    return clone;
}
exports.clone_buffer = clone_buffer;


exports.getObjectClassName = getObjectClassName;
exports.buffer_ellipsis = buffer_ellipsis;
exports.compare_buffers = compare_buffers;
exports.make_debugLog = make_debugLog;
exports.checkDebugFlag = checkDebugFlag;
exports.setDebugFlag = setDebugFlag;
exports.redirectToFile = redirectToFile;
exports.makebuffer = makeBuffer;
exports.replaceBufferWithHexDump = replaceBufferWithHexDump;
exports.hexDump = hexDump;
exports.toHex = toHex;
exports.display_trace_from_this_projet_only = display_trace_from_this_projet_only;
exports.dumpIf = dumpIf;
exports.dump = dump;
exports.get_clock_tick = get_clock_tick;


/**
 * @method normalize_require_file
 * @param baseFolder
 * @param full_path_to_file
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
function normalize_require_file(baseFolder, full_path_to_file) {
    var local_file = path.relative(baseFolder, full_path_to_file).replace(/\\/g, "/");
    // append ./ if necessary
    if (local_file.substr(0, 1) !== ".") {
        local_file = "./" + local_file;
    }
    // remove extension
    local_file = local_file.substr(0, local_file.length - path.extname(local_file).length);

    return local_file;

}
exports.normalize_require_file = normalize_require_file;


function capitalizeFirstLetter(str)  {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
}
exports.capitalizeFirstLetter = capitalizeFirstLetter;
function lowerFirstLetter(str) {
    return str.substr(0, 1).toLowerCase() + str.substr(1);
}
exports.lowerFirstLetter = lowerFirstLetter;

var $_$ = require("../../root");
exports.constructFilename = function (dir) {

    var dirname = $_$.dirname;
    var file = path.join(dirname, dir);
    return file;
};


// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(predicate) {
        if (this === null) {
            throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return i;
            }
        }
        return -1;
    };
}
