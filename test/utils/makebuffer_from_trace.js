
var trim  = function(str) {
    return str.replace(/^\s+|\s+$/g, "");
};

function inlineText(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}
var makebuffer = require("../../lib/utils").makebuffer;

var hexString = function(str) {
    var hexline =""
    var lines = str.split("\n");
    lines.forEach(function(line){
        if (line.length > 80) {
            line = trim(line.substr(10,98));
            hexline = hexline ? hexline + " " + line : line;
        }
    });
    return hexline;
};

function makebuffer_from_trace(func) {
    return makebuffer(hexString(inlineText(func)));
}
exports.makebuffer_from_trace = makebuffer_from_trace;
