require("colors");
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



function dump_block(buf,block_length) {

    var hexy = require("hexy");

    console.log(hexy.hexy(buf,{ width: block_length}));


    if (false) {
        console.log("length = ",buf.length);
        block_length = block_length || 16;
        var cursor = 0;
        while ( cursor< buf.length) {
            var slice1 =buf.slice(cursor, cursor+ block_length);
            console.log(" :",slice1.toString("hex").cyan);
            cursor+=block_length;
        }

    }
}

function compare_buffers(buf1,buf2,max_length) {

    max_length = max_length || buf2.length;
    block_length = 80;
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

function should_debug(script_fullpath){
    if (!process.env.DEBUG) return false;
    var path=require("path");
    var filename = path.basename(script_fullpath,".js");
    return process.env.DEBUG.indexOf(filename)>=0 ||  process.env.DEBUG.indexOf("ALL")>=0;
}

function redirectToFile(tmpfile,action_func,callback)
{
    var fs = require('fs');
    var log_file = fs.createWriteStream(__dirname + '/../tmp/' + tmpfile, {flags : 'w'});
    var old_console_log = console.log;
    var util = require('util');

    console.log = function(d) { //
        log_file.write(util.format(d) + '\n');
    };

    if (callback) {
        // async version
        action_func(function() {
            console.log = old_console_log;
            callback.call(arguments);
        });
    } else {
        // synchrone version
        action_func();
        console.log = old_console_log;
    }

}

function makebuffer(listOfBytes)
{
    var l = listOfBytes.split(" ");
    var b = new Buffer(l.length);
    var i=0;
    l.forEach(function(value) {
        b.writeUInt8(parseInt(value,16),i);
        i+=1;
    })
    return b;
}

exports.getObjectClassName = getObjectClassName;
exports.create = create;
exports.buffer_ellipsis = buffer_ellipsis;
exports.chunk_ellipsis = chunk_ellipsis;
exports.dump_block = dump_block;
exports.compare_buffers = compare_buffers;
exports.should_debug = should_debug;
exports.redirectToFile = redirectToFile;
exports.makebuffer = makebuffer;



