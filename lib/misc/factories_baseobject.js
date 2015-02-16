"use strict";
/**
 * @module opcua.address_space.types
 */

require("requirish")._(module);
var BinaryStreamSizeCalculator = require("lib/misc/binaryStream").BinaryStreamSizeCalculator;
var assert=require("assert");
var  _ = require("underscore");
var hexDump = require("lib/misc/utils").hexDump;

var getFactory = require("lib/misc/factories_factories").getFactory;
var _defaultTypeMap = require("lib/misc/factories_builtin_types")._defaultTypeMap;

var get_base_schema =  require("lib/misc/factories_schema_helpers").get_base_schema;

    /**
 * @class BaseUAObject
 * @constructor
 */
function BaseUAObject()
{

}

/**
 * Encode the object to the binary stream.
 * @class BaseUAObject
 * @method encode
 * @param stream {BinaryStream}
 * @param options {BinaryStream}
 */
BaseUAObject.prototype.encode = function(stream,options) {

};

/**
 * Decode the object from the binary stream.
 * @class BaseUAObject
 * @method decode
 * @param stream {BinaryStream}
 * @param options {Object}
 */
BaseUAObject.prototype.decode = function(stream,options) {

};

/**
 * Calculate the required size to store this object in a binary stream.
 * @method binaryStoreSize
 * @return {Number}
 */
BaseUAObject.prototype.binaryStoreSize = function (options) {

    var stream = new BinaryStreamSizeCalculator();
    this.encode(stream,options);
    return stream.length;
};

//var util = require("util");
//function w(s,w) {
//    return (s+"                                          ").substring(0,w);
//}
//
//function value_transform(str) {
//
//    var data;
//    var s = str.split("\n");
//    if (s.length ===1 ) {
//        data =  s[0];
//    } else {
//        data = s.join("\n   ");
//    }
//    return data;
//}
//function value_toString(value) {
//
//    var data;
//    if ( value instanceof Buffer) {
//
//        data = "\n"+ hexDump(value);
//
//    } else  if ( value instanceof Array ){
//        data = "ARRAY[\n";
//        var arr = [];
//        for (var i =0;i<value.length ; i++) {
//            arr.push(value_transform(value_toString(value[i])));
//        }
//        data += arr.join(",\n");
//        data += "\n]( length = " + value.length + " )";
//
//    } else if (value === null ) {
//        data = "<null>";
//    } else   if (typeof value === "string") {
//        data = '"' + value +'"' + "  (String)";
//    } else if (typeof value === "object") {
//        value = value.toString();
//        if (value === undefined ) {
//            data = "<undefined>";
//        } else if (value === null ) {
//            data = "<null>";
//        } else {
//            data = value_transform(value.toString());
//
//        }
//    } else {
//        data = value.toString();
//    }
//    return data;
//}
//function BaseUAObject_toString() {
//
//    var self = this;
//
//    var arr = Object.keys(self).map(function(key){
//        var value =  self[key];
//        var data = value_transform(value_toString(value));
//        return "\n"+ w(key + ": ",30) + data;
//    });
//    return arr.join();
//}

/**
 * @method toString
 * @return {String}
 */
BaseUAObject.prototype.toString = function () {

    var self = this;
    assert(self._schema);
    if (self._schema.hasOwnProperty("toString")) {

        return self._schema.toString.apply(self,arguments);

    } else {
        return self.explore();
        //xx return BaseUAObject_toString.apply(self,arguments);
    }
};


/**
 *
 * verify that all object attributes values are valid according to schema
 * @method isValid
 * @return {Boolean}
 */
BaseUAObject.prototype.isValid = function () {
    assert(this._schema);
    if (this._schema.toString) {
        return this._schema.isValid(this);
    } else {
        return true;
    }
};


function _decode_member_(value,field, stream, options) {

    var tracer = options.tracer;
    var cursor_before = stream.length;
    var fieldType = field.fieldType;

    if (field.category === "basic") {

        value = field.schema.decode(stream);
        tracer.trace("member", options.name, value, cursor_before, stream.length,fieldType);

    } else if (field.category === "enumeration") {

        value = field.schema.decode(stream);
        tracer.trace("member", options.name, value, cursor_before, stream.length,fieldType);

    } else  {
        assert(field.category === "complex");
        assert(_.isFunction(field.schema));
        value = new field.schema();
        value.decode_debug(stream, options);

    }
    return value;
}

/**
 * @method decode_debug
 *
 */
BaseUAObject.prototype.decode_debug = function (stream,options) {

    var tracer = options.tracer;
    var schema = this._schema;

    tracer.trace("start", options.name + "(" + schema.name + ")", stream.length, stream.length);
    var self = this;
    schema.fields.forEach(function(field){

        var value = self[field.name];

        if (field.isArray) {

            var cursor_before = stream.length;
            var nb = stream.readUInt32();
            if (nb === 0xFFFFFFFF) { nb = 0; }
            options.name = field.name + [];

            tracer.trace("start_array", field.name, nb, cursor_before, stream.length);
            for (var i = 0; i < nb; i++) {
                tracer.trace("start_element", field.name, i);
                options.name = "element #" + i;

                 _decode_member_(value,field, stream, options);

                tracer.trace("end_element", field.name, i);

            }
            tracer.trace("end_array", field.name, stream.length - 4);
        } else {

            options.name = field.name;
             _decode_member_(value,field, stream, options);

        }

    });

    tracer.trace("end", schema.name, stream.length, stream.length);
};


function r(str) {
    return (str + "                                ").substr(0, 30);
}

function apply_on_all_schema_fields(self, schema, data, callback) {

    assert(schema);
    var fields =schema.fields;
    var field, i ,n = fields.length;
    for( i =0; i< n ; i++ ) {
        field =fields[i];
        callback(self, field, data);
    }
}



var _exploreObject = function (self, field,  data) {

    if (!self) return;
    assert(self);

    var fieldType = field.fieldType;
    var fieldName = field.name;
    var category  = field.category;

    var padding = data.padding;

    var value = self[fieldName];

    var str;

    switch (category) {

        case "enumeration":
            str = r(padding + fieldName, 30) + " " + r(fieldType, 15) + " " + value.key + " ( " + value.value + ")";
            data.lines.push(str);
            break;

        case "basic":
            if (value instanceof Buffer) {

                var _hexDump = hexDump(value);
                value = "<BUFFER>";
                data.lines.push(r(padding + fieldName, 30) + " " + r(fieldType, 15));
                data.lines.push(_hexDump);
            } else {
                if (fieldType === "IntegerId" || fieldType === "UInt32") {
                    value = "" + value + "               0x" + value.toString(16);
                }
                str = r(padding + fieldName, 30) + " " + r(fieldType, 15) + " " + value;
                data.lines.push(str);
            }
            break;

        case "complex":
            if (field.subtype) {
                // this is a synonymous
                fieldType = field.subType;
                str = r(padding + fieldName, 30) + " " + r(fieldType, 15) + " " + value;
                data.lines.push(str);
            } else {
                var _new_desc = getFactory(fieldType).prototype._schema;
                if (field.isArray) {
                    data.lines.push(r(padding + fieldName, 30) + r(fieldType, 15) + ': [');
                    var i = 0;
                    value.forEach(function (element) {
                        var data1 = { padding: padding + " ", lines: []};
                        apply_on_all_schema_fields(element, _new_desc, data1, _exploreObject);
                        data.lines.push(padding + i + ": {");
                        data.lines = data.lines.concat(data1.lines);
                        data.lines.push(padding + "}");
                        i++;
                    });

                    data.lines.push(r(padding + "", 30) + "]");
                } else {
                    data.lines.push(r(padding + fieldName, 30) + r(fieldType, 15) + "{");
                    var data1 = { padding: padding + "  ", lines: []};
                    apply_on_all_schema_fields(value, _new_desc, data1, _exploreObject);
                    data.lines = data.lines.concat(data1.lines);
                    data.lines.push(padding + "}");
                }
            }

            break;
        default:
            throw new Error("internal error: unknown kind_of_field");
    }
};





BaseUAObject.prototype.explore = function() {

    var self = this;
    var data = { padding: ' ', lines: []};
    data.lines.push('message /*' + this._schema.name + '*/ : {');
    apply_on_all_schema_fields(self, self._schema, data, _exploreObject);
    data.lines.push(" };");
    return data.lines.join("\n");
};



function _visit_schema_chain(self,schema,options,func, extra_data) {
    assert(_.isFunction(func));

    // apply also construct to baseType schema first
    var base_schema = get_base_schema(schema);
    if (base_schema) {
        _visit_schema_chain(self,base_schema,options,func,extra_data);
    }
    func.call(self,schema,options,extra_data);
}

function _JSONify(schema, options) {

    var self = this;
    schema.fields.forEach(function (field) {
        var f = self[field.name];
        if (f === null || f === undefined) {
            return;
        }

        var t = _defaultTypeMap[field.fieldType];

        function jsonify(value) {

            if (_.isFunction(field.toJSON)) {
                return field.toJSON(value);
            } else if (t && t.toJSON) {
                return t.toJSON(value);
            } else if (value.toJSON) {
                return value.toJSON();
            } else {
                return f;
            }

        }

        if (field.isArray) {
            options[field.name] =  f.map(jsonify);
        } else {
            options[field.name] =  jsonify(f);
        }
    });
}

BaseUAObject.prototype.toJSON = function () {

    var self = this;

    assert(this._schema);
    if (this._schema.toJSON) {
        return this._schema.toJSON.apply(this,arguments);
    } else {
        //xx return Object.toJSON.apply(this,arguments);
        assert(self._schema);
        var schema =self._schema;
        var options = {};
        _visit_schema_chain(self,schema,options,_JSONify);
        return options;
    }
};

exports.BaseUAObject = BaseUAObject;