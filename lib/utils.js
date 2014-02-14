require("colors");
var assert = require("assert");


/**
 * set a flag
 * @param value
 * @param mask
 * @returns {number}
 */
function set_flag(value,mask) {
    assert(mask!==undefined);
    return (value | mask.value);
}
exports.set_flag = set_flag;
/**
 * check if a set of bits are set in the values
 *
 * @param value
 * @param mask
 * @returns {boolean}
 */
function check_flag(value,mask) {
    assert(mask!==undefined);
    return ((value & mask.value) === mask.value);
}
exports.check_flag = check_flag;

/**
 *
 * @param obj
 * @returns {string}
 */
function getObjectClassName(obj){
    return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * invoke a constructor without new
 * @param constructor
 * @returns {factory}
 */
function create(constructor) {
    var factory = constructor.bind.apply(constructor, arguments);
    return new factory();
}


function buffer_ellipsis(buffer,start,end) {
    start = start || 0 ;
    end = end || buffer.length ;
    if (end-start < 40) {
      return  buffer.slice(start,end).toString("hex");
    }
    return buffer.slice(start,start+10).toString("hex") + " ... " +
           buffer.slice(end-10,end).toString("hex");

}
function chunk_ellipsis(messageChunk,bodyOffset){

    return buffer_ellipsis(messageChunk,0,bodyOffset).yellow + " " +
           buffer_ellipsis(messageChunk,bodyOffset,messageChunk.length).cyan;
}

function hexDump(buffer,width) {
    if (!buffer) { return "<>" ;}
    width = width || 32;
    var hexy = require("hexy");
    return hexy.hexy(buffer,{ width: width , format: "twos"})
}

function compare_buffers(buf1,buf2,max_length) {

    max_length = max_length || buf2.length;
    var block_length = 80;
    var cursor = 0;
    while ( cursor< max_length) {
        var slice1 =buf1.slice(cursor, cursor+ block_length);
        var slice2 =buf2.slice(cursor, cursor+ block_length);
        if (slice2.toString("hex") !=slice1.toString("hex")) {
            console.log("pos = ",cursor);
            console.log("slice1 :",buffer_ellipsis(slice1).yellow);
            console.log("slice2 :",buffer_ellipsis(slice2).blue);
        }
        cursor+=block_length;
    }
    // xx buf1.length.should.equal(max_length);

}

/**
 * @param script_fullpath
 * @returns returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
function make_debugLog(script_fullpath) {

    var doDebug = false;
    if (process.env.DEBUG) {
        var path=require("path");
        var filename = path.basename(script_fullpath,".js");
        doDebug =  process.env.DEBUG.indexOf(filename)>=0 ||  process.env.DEBUG.indexOf("ALL")>=0;
    }
    function debugLogFunc() {
        if (doDebug) {
            console.log.apply(console,arguments);
        }
    }
    return debugLogFunc;
}

function redirectToFile(tmpfile,action_func,callback)
{
    assert(callback);

    var log_file =__dirname + '/../tmp/' + tmpfile;
    var fs = require('fs');
    var f = fs.createWriteStream(log_file, {flags : 'w'});
    var old_console_log = console.log;
    var util = require('util');

    console.log = function(d) { //

        var msg = util.format.apply(null,arguments);
        f.write(msg+ '\n');
        if (process.env.DEBUG) {
            old_console_log.call(this,msg);
        }
    };
    // async version
    action_func();
    console.log = old_console_log;
    f.write("",callback);

}

function makeBuffer(listOfBytes) {
    var l = listOfBytes.split(" ");
    var b = new Buffer(l.length);
    var i=0;
    l.forEach(function(value) {
        b.writeUInt8(parseInt(value,16),i);
        i+=1;
    });
    return b;
}

function replaceBufferWithHexDump(obj) {
    for ( var p in obj) {
        if (obj.hasOwnProperty(p)) {
            if (obj[p] instanceof Buffer) {
                obj[p]  = "<BUFFER>"+ obj[p].toString("hex")+ "</BUFFER>";
            } else if ( typeof(obj[p]) === "object" ) {
                replaceBufferWithHexDump(obj[p]);
            }
        }
    }
    return obj;
}

function display_trace_from_this_projet_only() {
    var stack = new Error().stack;
    stack = (stack.split("\n").filter(function(el){ return el.match(/node-opcua/)  && !el.match(/node_modules/);})).join("\n");
    console.log( stack.yellow );

}

exports.getObjectClassName = getObjectClassName;
exports.create = create;
exports.buffer_ellipsis = buffer_ellipsis;
exports.chunk_ellipsis = chunk_ellipsis;
exports.compare_buffers = compare_buffers;
exports.make_debugLog = make_debugLog;
exports.redirectToFile = redirectToFile;
exports.makebuffer = makeBuffer;
exports.replaceBufferWithHexDump = replaceBufferWithHexDump;
exports.hexDump = hexDump;
exports.display_trace_from_this_projet_only = display_trace_from_this_projet_only;

