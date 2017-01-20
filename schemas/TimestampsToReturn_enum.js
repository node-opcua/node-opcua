import { registerEnumeration } from "lib/misc/factories";
import assert from "better-assert";
import {BinaryStream} from "lib/misc/binaryStream";

const TimestampsToReturn_Schema = {
    name: "TimestampsToReturn",
    enumValues: {
        Invalid:      -1,
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    },
    decode: function(stream) {

        assert(stream instanceof BinaryStream);
        const value = stream.readInteger();
        if (value<0 || value>3) {
            return TimestampsToReturn.Invalid;
        }
        return TimestampsToReturn.get(value);
    }
};
export {TimestampsToReturn_Schema};
var TimestampsToReturn = exports.TimestampsToReturn = registerEnumeration(TimestampsToReturn_Schema);