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
exports.hexDump = hexDump;
