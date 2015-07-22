//if (false) {
//    require("requirish")._(module);
//
//var factories = require("lib/misc/factories");
//var ec = require("lib/misc/encode_decode");
//var DataType = require("lib/datamodel/variant").DataType;
//var NodeId = require("lib/datamodel/nodeid").NodeId;
//var _ = require("underscore");
//var assert = require("better-assert");
//
//function myfindBuiltInType(dataType) {
//
//    if (dataType instanceof NodeId) {
//        assert(dataType.namespace === 0);
//        dataType =DataType.get(dataType.value);
//    }
//    return factories.findBuiltInType(dataType.key);
//}
//
//var BaseDataType_Schema = {
//    name: "BaseDataType",
//    id: factories.next_available_id(),
//    fields : [
//        {name: "definition",  isArray: true, fieldType: "Argument" , defaultValue: [null]},
//        {name: "arguments" ,  fieldType: "Any" , defaultValue: null, isArray:true},
//    ],
//
//    encode: function(self,stream) {
//
//        assert(_.isArray(self.definition));
//        assert(_.isArray(self.arguments));
//        assert(self.definition.length === self.arguments.length);
//        assert(self.definition.length >0);
//
//        // we only encode arguments by following the definition
//
//        for(var i=0;i<self.definition.length;i++) {
//
//            var def   = self.definition[i];
//            var value = self.arguments[i];
//
//            var encodeFunc = myfindBuiltInType(def.dataType).encode;
//
//            // xx console.log(" cxxxxxxxxxxc ",def);
//            // assert((def.valueRank === -1) || (def.valueRank === 0));
//            var isArray = ( def.valueRank === 1 || def.valueRank === -1) ? true : false;
//
//            if (isArray) {
//                ec.encodeArray(value,stream,encodeFunc);
//            } else {
//                encodeFunc(value,stream);
//            }
//        }
//    },
//    decode: function(self,stream) {
//
//        if (!_.isArray(self.definition)) {
//            throw new Error(
//                "This BaseDataType cannot be decoded because it has no definition.\n" +
//                "Please construct a BaseDataType({definition : [{dataType: DataType.UInt32 }]});"
//            )
//        }
//
//        var args = [];
//        var value;
//
//        for(var i=0;i<self.definition.length;i++) {
//
//            var def = self.definition[i];
//
//            var decodeFunc = myfindBuiltInType(def.dataType).decode;
//
//            //xx assert(def.valueRank === -1 || def.valueRank==0);
//            var isArray = ( def.valueRank === 1 || def.valueRank === -1) ? true : false;
//
//            if (isArray) {
//                value = ec.decodeArray(stream, decodeFunc);
//            } else {
//                value = decodeFunc(stream);
//            }
//            args.push(value);
//        }
//        self.arguments = args;
//        assert(_.isArray(self.arguments));
//    },
//    decode_debug: function(self,stream,option) {
//        assert(false,"not implemented : please fix me");
//    }
//};
//exports.BaseDataType_Schema = BaseDataType_Schema;
//
//}