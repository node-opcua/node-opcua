var factories = require("../lib/misc/factories");
var ec = require("../lib/misc/encode_decode");


var BaseDataType_Schema = {
    name: "BaseDataType",
    id: factories.next_available_id(),
    fields : [
        {name: "dataType" , fieldType: "DataType"},
        {name: "isArray" , fieldType: "Boolean" , defaultValue: false},
        {name: "value" , fieldType: "Any"}
    ],
    encode: function(self,stream) {

        var encodeFunc = factories.findBuiltInType(self.dataType.key).encode;
        if (self.isArray) {
            ec.encodeArray(self.value,stream,encodeFunc);
        } else {
            encodeFunc(self.value,stream);
        }
    },
    decode: function(self,stream) {

        var decodeFunc = factories.findBuiltInType(self.dataType.key).decode;
        if (self.isArray) {
            self.value = ec.decodeArray(stream,decodeFunc);
        } else {
            self.value = decodeFunc(stream);
        }
    },
    decode_debug: function(self,stream,option) {

    },
    construct_hook: function(options) {
        if (_.isArray(options.value)) {
            options.isArray = true;
        }
        return options;
    }
};
exports.BaseDataType_Schema = BaseDataType_Schema;