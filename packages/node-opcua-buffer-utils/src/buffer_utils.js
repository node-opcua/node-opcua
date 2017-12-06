"use strict";

//
// note: new Buffer(size)#  is deprecated since: v6.0. and is replaced with Buffer.allocUnsafe
//       to ensure backward compatibility we have to replace
//       new Buffer(size) with createFastUninitializedBuffer(size)
//
//       Buffer.alloc and Buffer.allocUnsafe have been introduced in nodejs 5.1.0
//  in node 0.11 new Buffer
//
exports.createFastUninitializedBuffer = Buffer.allocUnsafe ? Buffer.allocUnsafe :  function a (size) {
    return new Buffer(size);
};
if (!Buffer.from) {
    Buffer.from = function(a,b,c) {
        return new Buffer(a,b,c);
    };
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
    var b = exports.createFastUninitializedBuffer(l.length);
    var i = 0;
    l.forEach(function (value) {
        b.writeUInt8(parseInt(value, 16), i);
        i += 1;
    });
    return b;
}
exports.makeBuffer = makeBuffer;

function clone_buffer(buffer) {
    var clone = exports.createFastUninitializedBuffer(buffer.length);
    buffer.copy(clone, 0, 0);
    return clone;
}
exports.clone_buffer = clone_buffer;
