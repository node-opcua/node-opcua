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
 */
BaseUAObject.prototype.encode = function(stream,options) {

};

/**
 * Decode the object from the binary stream.
 * @class BaseUAObject
 * @method decode
 * @param stream {BinaryStream}
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


/**
 * @method toString
 * @return {String}
 */
BaseUAObject.prototype.toString = function () {
    assert(this._schema);
    if (this._schema.toString) {
        return this._schema.toString.apply(this,arguments);
    } else {
        return Object.toString.apply(this,arguments);
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
        var fieldType = field.fieldType;

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






/**
 *
 * @method _get_base_schema
 * @param schema
 * @return {*}
 * @private
 */
function _get_base_schema(schema) {

    var base_schema = schema._base_schema;
    if (base_schema !== undefined) {
        return base_schema;
    }

    base_schema = null;
    if (schema.baseType && schema.baseType !== "BaseUAObject" ) {
        var baseType = getFactory(schema.baseType);
        if (!baseType) {
            console.log(schema.name + " cannot find schema for base type ",schema.baseType);
            assert(baseType);
        }
        if (baseType.prototype._schema) {
            base_schema = baseType.prototype._schema;
        }
    }
    // put in  cache for speedup
    schema._base_schema = base_schema;

    return base_schema;
}
function _visit_schema_chain(self,schema,options,func, extra_data) {
    assert(_.isFunction(func));

    // apply also construct to baseType schema first
    var base_schema = _get_base_schema(schema);
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