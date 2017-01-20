import { registerEnumeration } from "lib/misc/factories";
import {BinaryStream} from "lib/misc/binaryStream";
import assert from "better-assert";

const EnumBrowseDirection_Schema = {
    name: "BrowseDirection",
    enumValues: {
        Invalid: -1, //
        Forward: 0, // Return forward references.
        Inverse: 1, //Return inverse references.
        Both: 2  // Return forward and inverse references.
    },
    decode: function(stream) {

        assert(stream instanceof BinaryStream);
        const value = stream.readInteger();
        if (value<0 || value>2) {
            return exports.BrowseDirection.Invalid;
        }
        return exports.BrowseDirection.get(value);
    }
};
export {EnumBrowseDirection_Schema};
export const BrowseDirection = registerEnumeration(EnumBrowseDirection_Schema);

