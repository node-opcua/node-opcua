"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");
var ec = require("lib/misc/encode_decode");
var assert = require("better-assert");

function getLocalizeText_EncodingByte(localizedText) {
    var encoding_mask = 0;
    if (localizedText.locale) {
        encoding_mask += 1;
    }
    if (localizedText.text) {
        encoding_mask += 2;
    }
    return encoding_mask;
}

// see Part 3 - $8.5 page 63
var LocalizedText_Schema = {
    name: "LocalizedText",
    id: factories.next_available_id(),
    fields: [
        { name: "text", fieldType: "String", defaultValue : function () { return null; } },
        { name: "locale", fieldType: "LocaleId" }
    ],

    // OPCUA Part 6 $ 5.2.2.14 : localizedText have a special encoding
    encode: function (localizedText, stream) {
        var encoding_mask = getLocalizeText_EncodingByte(localizedText);
        ec.encodeByte(encoding_mask, stream);
        if ((encoding_mask & 0x01) === 0x01) {
            ec.encodeString(localizedText.locale, stream);
        }
        if ((encoding_mask & 0x02) === 0x02) {
            ec.encodeString(localizedText.text, stream);
        }
    },
    decode_debug: function (self, stream , options) {

        var cursor_before;
        var tracer = options.tracer;
        tracer.trace("start", options.name + "(" + "LocalizedText" + ")", stream.length, stream.length);
        cursor_before = stream.length;

        var encoding_mask = ec.decodeByte(stream);
        tracer.trace("member", "encodingByte", "0x" + encoding_mask.toString(16), cursor_before, stream.length, "Mask");
        cursor_before = stream.length;

        if ((encoding_mask & 0x01) === 0x01) {
            self.locale = ec.decodeString(stream);
            tracer.trace("member", "locale", self.locale, cursor_before, stream.length, "locale");
            cursor_before = stream.length;
        } else {
            self.locale = null;
        }
        if ((encoding_mask & 0x02) === 0x02) {
            self.text = ec.decodeString(stream);
            tracer.trace("member", "text", self.text, cursor_before, stream.length, "text");
            //cursor_before = stream.length;
        } else {
            self.text = null;
        }
        tracer.trace("end", options.name, stream.length, stream.length);
    },
    decode: function (self, stream) {

        var encoding_mask = ec.decodeByte(stream);
        if ((encoding_mask & 0x01) === 0x01) {
            self.locale = ec.decodeString(stream);
        } else {
            self.locale = null;
        }
        if ((encoding_mask & 0x02) === 0x02) {
            self.text = ec.decodeString(stream);
        } else {
            self.text = null;
        }
    },
    toString: function () {
        return "locale=" + this.locale + " text=" + this.text;
    }

};
exports.LocalizedText_Schema = LocalizedText_Schema;
