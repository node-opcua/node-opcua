var factories = require("../lib/misc/factories");

var TimestampsToReturn_Schema = {
    name: "TimestampsToReturn",
    enumValues: {
        Invalid:      -1,
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    },
    decode: function(stream) {

        var v = stream.readInt32();
        if (y<0 || y>3) {
            return TimestampsToReturn.Invalid;
        }
        return TimestampsToReturn.get(value);
    }
};
exports.TimestampsToReturn_Schema = TimestampsToReturn_Schema;
var TimestampsToReturn = exports.TimestampsToReturn = factories.registerEnumeration(TimestampsToReturn_Schema);