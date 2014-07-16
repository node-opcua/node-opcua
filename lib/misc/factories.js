"use strict";

/**
 * @module opcua.miscellaneous
 */

var assert = require('better-assert');
var ec = require("./encode_decode");
var util = require("util");
require('enum').register();
var _ = require("underscore");
var hexDump = require("./utils").hexDump;
var dumpIf = require("./utils").dumpIf;
var objectNodeIds = require("./../opcua_node_ids").ObjectIds;
var sc = require("./../datamodel/opcua_status_code");
var BinaryStreamSizeCalculator = require("../misc/binaryStream").BinaryStreamSizeCalculator;
var Enum = require("enum");

assert(sc.StatusCodes.Good.value === 0);

var factories = {};
var _enumerations = {};

var  coerceNodeId = require("./../datamodel/nodeid").coerceNodeId;
var  coerceExpandedNodeId = require("./../datamodel/expanded_nodeid").coerceExpandedNodeId;

function coerceByteString(value) {

    if (_.isArray(value)) {
        return new Buffer(value);
    }
    if (typeof value === "string") {
        return new Buffer(value, "base64");
    }
    return value;
}

function coerceDateTime(value) {
    return new Date(value);
}

exports.minDate=  new Date(Date.UTC(1601, 0, 1, 0, 0));

//there are 4 types of DataTypes in opcua:
//   Built-In DataType
//   Simple DataType
//   Complex DataType
//   Enumeration


var defaultGuid = "00000000-0000-00000000";
var defaultXmlElement = "";

// Built-In Type
var _defaultType = [

    // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )

    { name: "Null",    encode: function(){},      decode: function(){return null; } },
    { name: "Boolean", encode: ec.encodeBoolean,  decode: ec.decodeBoolean,  defaultValue: false },
    { name: "Int8",    encode: ec.encodeInt8,     decode: ec.decodeInt8,     defaultValue: 0 },
    { name: "UInt8",   encode: ec.encodeUInt8,    decode: ec.decodeUInt8,    defaultValue: 0 },
    { name: "SByte",   encode: ec.encodeInt8,     decode: ec.decodeInt8,     defaultValue: 0 },
    { name: "Byte",    encode: ec.encodeUInt8,    decode: ec.decodeUInt8,    defaultValue: 0 },
    { name: "Int16",   encode: ec.encodeInt16,    decode: ec.decodeInt16,    defaultValue: 0 },
    { name: "UInt16",  encode: ec.encodeUInt16,   decode: ec.decodeUInt16,   defaultValue: 0 },
    { name: "Int32",   encode: ec.encodeInt32,    decode: ec.decodeInt32,    defaultValue: 0 },
    { name: "UInt32",  encode: ec.encodeUInt32,   decode: ec.decodeUInt32,   defaultValue: 0 },
    { name: "Int64",   encode: ec.encodeInt64,    decode: ec.decodeInt64,    defaultValue: 0 },
    { name: "UInt64",  encode: ec.encodeUInt64,   decode: ec.decodeUInt64,   defaultValue: 0 },
    { name: "Float",   encode: ec.encodeFloat,    decode: ec.decodeFloat,    defaultValue: 0.0 },
    { name: "Double",  encode: ec.encodeDouble,   decode: ec.decodeDouble,   defaultValue: 0.0 },
    { name: "String",  encode: ec.encodeString,   decode: ec.decodeString,   defaultValue: ""},
    // OPC Unified Architecture, part 3.0 $8.26 page 67
    { name: "DateTime", encode: ec.encodeDateTime, decode: ec.decodeDateTime, defaultValue: exports.minDate , coerce: coerceDateTime ,},
    { name: "Guid",     encode: ec.encodeGuid,     decode: ec.decodeGuid,     defaultValue: defaultGuid },

    { name: "ByteString", encode: ec.encodeByteString, decode: ec.decodeByteString,

        defaultValue: function () {return new Buffer(0); },

        coerce: coerceByteString,

        toJSON: function (value) {
            assert(value instanceof Buffer);
            return value.toString("base64");
        }
    },
    { name: "XmlElement",encode: ec.encodeString,     decode: ec.decodeString,     defaultValue: defaultXmlElement },

    // see OPCUA Part 3 - V1.02 $8.2.1
    {   name: "NodeId",
        encode: ec.encodeNodeId, decode: ec.decodeNodeId,
        defaultValue: ec.makeNodeId,
        coerce: coerceNodeId
    },

    {   name: "ExpandedNodeId",
        encode: ec.encodeExpandedNodeId, decode: ec.decodeExpandedNodeId,
        defaultValue: ec.makeExpandedNodeId,
        coerce: coerceExpandedNodeId
    },

    // ----------------------------------------------------------------------------------------
    // Simple  DataTypes
    // ( see OPCUA Part III v1.02 - $5.8.2 )
    // Simple DataTypes are subtypes of the Built-in DataTypes. They are handled on the wire like the
    // Built-in   DataType, i.e. they cannot be distinguished on the wire from their  Built-in supertypes.
    // Since they are handled like  Built-in   DataTypes  regarding the encoding they cannot have encodings
    // defined  in the  AddressSpace.  Clients  can read the  DataType  Attribute  of a  Variable  or  VariableType  to
    // identify the  Simple  DataType  of the  Value  Attribute. An example of a  Simple  DataType  is  Duration. It
    // is handled on the wire as a  Double   but the Client can read the  DataType  Attribute  and thus interpret
    // the value as defined by  Duration
    //


    // OPC Unified Architecture, part 4.0 $7.13
    // IntegerID: This primitive data type is an UInt32 that is used as an identifier, such as a handle. All values,
    // except for 0, are valid.
    { name: "IntegerId", encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0xFFFFFFFF },



    //The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
    //code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
    //that contain additional information but do not affect the meaning of the StatusCode.
    // 7.33 Part 4 - P 143
    {
        name:"StatusCode",
        encode: sc.encodeStatusCode,
        decode: sc.decodeStatusCode,
        defaultValue: sc.StatusCodes.Good
    }

];


var _defaultTypeMap = {};
_defaultType.forEach(function (d) {
    //xx console.log("-registerType " + d.name);
    _defaultTypeMap[d.name] = d;
});

function registerType(name, encodeFunc, decodeFunc, defaultValue, subType, coerceFunc) {

    assert(_.isFunction(encodeFunc));
    assert(_.isFunction(decodeFunc));
    assert(typeof name === "string");


    var obj = {
        name: name,
        encode: encodeFunc,
        decode: decodeFunc,
        defaultValue: defaultValue, // could be a fun or a basic value;
        coerce: coerceFunc,
        subType: subType
    };
    _defaultType.push(obj);
    _defaultTypeMap[name] = obj;
}

function findBuiltInType(datatypeName) {
    var t =  _defaultTypeMap[datatypeName];
    if (!t) {
        throw new Error( "datatype " + datatypeName + " must be registered");
    }
    if (t.subType) {
        return findBuiltInType(t.subType);
    }
    return t;
}
exports.findBuiltInType = findBuiltInType;


var constructorMap = {};


exports.findSimpleType = function findSimpleType(name) {
    assert(name in _defaultTypeMap);
    return _defaultTypeMap[name];
};


function _encode_by_type(obj, fieldType, stream) {
    try {
        var _t = _defaultTypeMap[fieldType];
        _t.encode(obj, stream);
    }
    catch (err) {
        console.error("ERROR in  _encode_by_type  ".red + "cannot encode " + fieldType + " on " + util.inspect(obj));
        console.log(JSON.stringify(obj,null," "));
        console.error(util.inspect(err));
        console.error(err.stack);
    }
}

function _decode_by_type(obj, fieldType, stream) {
    var _t = _defaultTypeMap[fieldType];
    if (!_t.hasOwnProperty("decode") || (!_t.decode instanceof Function)) {
        console.error(" _decode_by_type :" , util.inspect(_t), util.inspect(obj));
    }
    return  _t.decode(stream);
}

function _encode_member_(member, fieldType, stream) {

    assert(fieldType);

    if (_defaultTypeMap[fieldType]) {

        _encode_by_type(member, fieldType, stream);

    } else if (factories[fieldType]) {
        if (!member) {
            console.error(" cannot find encode method on type  " + fieldType);
        }
        if (!member.encode) {
        }
        member.encode(stream);

    } else if (_enumerations[fieldType]) {
        // OPC Unified Architecture, Part 3 page 34
        // Enumerations are always encoded as Int32 on the wire as defined in Part 6.
        stream.writeInteger(member.value);

    } else {

        throw new Error(" Invalid field" + fieldType);
    }
}

function _decode_member_(member, fieldType, stream, options) {

    var tracer = options ? options.tracer : null;

    var cursor_before = stream.length;


    if (_defaultTypeMap[fieldType]) {

        member = _decode_by_type(member, fieldType, stream);
        if (tracer) {
            tracer.trace("member", options.name, member, cursor_before, stream.length,fieldType);
        }

        return member;

    } else if (factories[fieldType]) {

        //xx console.log(" decoding fieldType=",fieldType);
        member.decode(stream, options);

    } else if (_enumerations[fieldType]) {

        var typedEnum = _enumerations[fieldType].typedEnum;
        member = typedEnum.get(stream.readInteger());
        if (tracer) {
            tracer.trace("member", options.name, member, cursor_before, stream.length,fieldType);
        }
        return member;

    } else {

        throw new Error(" Invalid field" + field.fieldType);
    }
    return member;
}

function _encode_(obj, objDesc, stream) {

    assert( objDesc );
    assert( objDesc.fields,"where are the fields ?"+ util.inspect(objDesc));
    objDesc.fields.forEach(function (field) {

        if (obj.hasOwnProperty(field.name)) {

            var member = obj[field.name];
            var fieldType = field.fieldType;
            if (_.isArray(member)) {

                stream.writeUInt32(member.length);
                member.forEach(function (element) {
                    _encode_member_(element, fieldType, stream);
                });
            } else {
                _encode_member_(member, fieldType, stream);
            }

        } else {
            throw new Error(" Missing field " + field.name + " in object " + util.inspect(obj));
        }
    });
}

function _resolve_defaultValue(type_userValue, defaultValue) {
    defaultValue = defaultValue || type_userValue;
    if (_.isFunction(defaultValue)) {
        defaultValue = defaultValue.call();
    }
    // this is a default type such as UAString or Integer
    return  defaultValue;
}

function _build_default_value(field, options) {

    var fieldType = field.fieldType;
    var  _constructor;

    if (_defaultTypeMap[fieldType]) {

        var _type = _defaultTypeMap[fieldType];
        return _resolve_defaultValue(_type.defaultValue, options);

    } else if (factories[fieldType]) {

        _constructor = factories[fieldType];
        return callConstructor(_constructor, options);
    }
    return;
}

function _decode_(obj, objDesc, stream, options) {

    var tracer = options ? options.tracer : null;

    if (tracer) {
        tracer.trace("start", options.name + "(" + objDesc.name + ")", stream.length, stream.length);
    }

    objDesc.fields.forEach(function (field) {

        if (obj.hasOwnProperty(field.name)) {

            var member = obj[field.name];
            var fieldType = field.fieldType;

            if (_.isArray(member)) {

                assert(member.length === 0);

                var cursor_before = stream.length;
                var nb = stream.readUInt32();

                if (nb === 0xFFFFFFFF) {
                    nb = 0;
                }

                if (options) {
                    options.name = field.name + [];
                }

                if (tracer) { tracer.trace("start_array", field.name, nb, cursor_before, stream.length); }

                for (var i = 0; i < nb; i++) {
                    var element = _build_default_value(field,{});

                    if (tracer) {tracer.trace("start_element", field.name, i); }

                    options = options ||{};
                    options.name = "element #" + i;
                    element = _decode_member_(element, fieldType, stream, options) || member;
                    member.push(element);

                    if (tracer) { tracer.trace("end_element", field.name, i);}

                }
                if (tracer) { tracer.trace("end_array", field.name, stream.length - 4); }

            } else {
                if (options) {
                    options.name = field.name;
                }
                var decoded = _decode_member_(member, fieldType, stream, options);
                obj[field.name] = ( decoded === null ) ? member : decoded;
            }

        }
    });

    if (tracer) { tracer.trace("end", objDesc.name, stream.length, stream.length);    }
}


function ___install_single_value_with_special_getter_and_setter(obj,fieldName,defaultValue,coerceFunc) {
    var private_name = "__" + fieldName;
    obj[private_name] = defaultValue;
    assert(!_.isFunction(obj[fieldName]),'enum has been already installed : cannot do it !!!');
    assert(!Object.getOwnPropertyDescriptor(obj,fieldName));

    var param = {};
    param[fieldName] = {
        set: function (value) {

            var coercedValue = coerceFunc(value);
            if ( coercedValue === undefined || coercedValue === null) {
                throw "value cannot be coerced " + fieldName + ": " + value;
            }
            this[private_name] = coercedValue;
        },
        get: function () {
            return this[private_name];
        },
        enumerable: true
    };
    Object.defineProperties(obj, param);
    Object.defineProperty(obj, private_name, { hidden: true, enumerable: false});

}

function installEnumProp(obj, fieldName, typedEnum) {

    var defaultValue = typedEnum.enums[0];
    function coerceFunc(value) {
        return typedEnum.get(value);
    }
    ___install_single_value_with_special_getter_and_setter(obj, fieldName, defaultValue, coerceFunc);
}

exports.installEnumProp = installEnumProp;

function callConstructor(constructor) {
    var factoryFunction = constructor.bind.apply(constructor, arguments);
    return new factoryFunction();
}


/**
 * return the initial value of a constructed field.
 * @method _install_initial_value
 * @param field
 * @param options
 * @private
 * if the field is not specified in the options, the default value will be used
 */
function _install_initial_value(field,options) {

    if (field.isArray) {
        var arr = [];
        if (options[field.name]) {
            assert(_.isArray(options[field.name]));
            options[field.name].forEach(function(el){
                var init_data = {};
                init_data[field.name]=el;
                var value =___install_single_initial_value(field,init_data);
                arr.push(value);
            });
        }
        return arr;
    }
    return ___install_single_initial_value(field,options);
}



function ___install_single_initial_value(field,options) {

    dumpIf( (typeof options !== "object"), { field: field , options: options} );
    assert( (typeof options === "object") ," expecting options for field " + util.inspect(field));
    var value = null;

    var typeDef = _defaultTypeMap[field.fieldType];

    // what is the default value we should be using here ...
    var defaultValue = field.defaultValue;
    if (defaultValue === undefined ) {
        if (typeDef) {
            defaultValue = typeDef.defaultValue;
        }
    }

    if ( field.name in options ) {
        // the user has specified a value for this field
        value = options[field.name ];

        if (field.defaultValue === null && value === null) {
            // special case when null defaultValue is allowed
            return value;
        }
        // if there is a coercion method  for this field, use it
        if (field.coerce) {
            value = field.coerce(value);
        } else if (typeDef && typeDef.coerce) {
            value = typeDef.coerce(value);
        }

    } else {
        // let fall back to the default value
        if (_.isFunction(defaultValue)) {
            value = defaultValue.call();
        } else {
            value = defaultValue;
        }
        // don't coerce
    }

    if (field.validate) {
        assert(_.isFunction(field.validate));
        if (!field.validate(value)) {
            throw Error(" invalid value " + value + " for field " + field.name + " in " + options  );
        }
    }
    return value;

}


function _construct_enumeration(self,fieldType,fieldName,field,data) {

    var typedEnum = _enumerations[fieldType].typedEnum;

    installEnumProp(self, fieldName, typedEnum);

    if (!field.defaultValue) {
        field.defaultValue =typedEnum.enums[0];
    }
    self[fieldName] = _install_initial_value(field,data.options);
}

var constructObject = function (kind_of_field, self, field, extra, data) {

    var fieldType = field.fieldType;
    var fieldName = field.name;
    var options = data.options;

    //xx if ( fieldName === "value") {
    //xx     console.log("XXXXXX ",kind_of_field," ",fieldType,fieldName)
    //xx }

    switch (kind_of_field) {

        case "enumeration":
            _construct_enumeration(self,fieldType,fieldName,field,data);
            break;
        case "basic":
            self[fieldName] = _install_initial_value(field,data.options);
            break;
        case "complex":
            var _constructor = factories[fieldType];

            if (field.isArray) {
                var arr = [];
                if (options[field.name]) {
                    assert(_.isArray(options[field.name]));
                    options[field.name].forEach(function(initializing_value){
                        arr.push(callConstructor(_constructor, initializing_value));
                    });
                }
                self[fieldName] = arr;

            } else {
                assert(!field.isArray);
                var initializing_value = options[fieldName];
                if (!initializing_value  &&   field.defaultValue === null) {
                    self[fieldName] = null;
                } else {
                    initializing_value = initializing_value || {};
                    self[fieldName]  = callConstructor(_constructor, initializing_value);
                }
            }
            break;
        default:
            throw new Error("internal error kind_of_field");
    }
};


function r(str) {
    return (str + "                                ").substr(0, 30);
}

var _exploreObject = function (kind_of_field, self, field, extra, data) {

    assert(self);

    var fieldType = field.fieldType;
    var fieldName = field.name;
    var padding = data.padding;
    var value = self[fieldName];
    var str;

    switch (kind_of_field) {

        case "enumeration":
            //xx var typedEnum = _enumerations[fieldType].typedEnum;
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

                var _new_desc = factories[fieldType].prototype._schema;
                if (field.isArray) {
                    data.lines.push(r(padding + fieldName, 30) + r(fieldType, 15) + ': [');
                    var i = 0;
                    value.forEach(function (element) {
                        var data1 = { padding: padding + " ", lines: []};
                        objectVisitor(element, _new_desc, data1, _exploreObject);
                        data.lines.push(padding + i + ": {");
                        data.lines = data.lines.concat(data1.lines);
                        data.lines.push(padding + "}");
                        i++;
                    });

                    data.lines.push(r(padding + "", 30) + "]");
                } else {
                    data.lines.push(r(padding + fieldName, 30) + r(fieldType, 15) + "{");
                    var data1 = { padding: padding + "  ", lines: []};
                    objectVisitor(value, _new_desc, data1, _exploreObject);
                    data.lines = data.lines.concat(data1.lines);
                    data.lines.push(padding + "}");
                }
            }

            break;
        default:
            throw new Error("internal error: unknown kind_of_field");
    }
};


var objectVisitor = function (self, schema, data, callback) {

    assert(schema);
    // ignore null objects
    if (!self) { return;  }

    schema.fields.forEach(function (field) {

        var fieldType = field.fieldType;

        if (fieldType in _enumerations) {

            var typedEnum = _enumerations[fieldType].typedEnum;
            callback("enumeration", self, field, typedEnum, data);

        } else if (fieldType in factories) {
            callback("complex", self, field, null, data);

        } else if (fieldType in _defaultTypeMap) {
            callback("basic", self, field, null, data);

        } else {
            console.error(schema);
            console.error("field = ",field);
            throw new Error("Invalid field type : " + fieldType + JSON.stringify(field) + " is not a default type nor a registered complex struct");
        }
    });

};


/**
 *
 * @method _get_base_schema
 * @param schema
 * @returns {*}
 * @private
 */
function _get_base_schema(schema) {

    if (schema.hasOwnProperty("_base_schema")) {
        return schema._base_schema;
    }

    var base_schema = null;
    if (schema.baseType) {
        var baseType = factories[schema.baseType];
        assert(baseType);
        if (baseType.prototype._schema) {
            base_schema = baseType.prototype._schema;
        }
    }
    // put in  cache for speedup
    schema._base_schema = base_schema;

    return base_schema;
}

/**
 * extract a list of all possible fields for a schema
 * (by walking up the inheritance chain)
 * @method _extract_all_fields
 * @private
 */
function _extract_all_fields(schema) {

   // returns cached result if any
   if (schema._possible_fields) {
       return schema._possible_fields;
   }
   // extract the possible fields from the schema.
   var possible_fields = schema.fields.map(function (field) { return field.name;});

   var base_schema = _get_base_schema(schema);
   if (base_schema) {
       var fields = _extract_all_fields(base_schema);
       possible_fields  = fields.concat(possible_fields);
   }

   // put in cache to speed up
   schema._possible_fields = possible_fields;

   return possible_fields;
}

/**
 * check correctness of option fields against scheme
 *
 * @method  check_options_correctness_against_schema
 * @private
 */
function check_options_correctness_against_schema(schema, options) {

    if (!_.isObject(options)) {
        var message = " Invalid options specified while trying to construct a ".red.bold  + " " + schema.name.yellow;
        message += " expecting a ".red.bold + " Object ".yellow;
        message += " and got a ".red.bold +  typeof(options).yellow  + " instead ".red.bold;
        console.log(" Schema  = ",schema);
        console.log(" options = ",options);
        throw new Error(message);
    }

    // extract the possible fields from the schema.
    var possible_fields = _extract_all_fields(schema);

    // extracts the fields exposed by the option object
    var current_fields = Object.keys(options);

    // get a list of field that are in the 'options' object but not in schema
    var invalid_options_fields = _.difference(current_fields, possible_fields);

    if (invalid_options_fields.length > 0) {
        var err = new Error();
        console.log("expected schema", schema.name);
        console.log("schema",schema);
        console.log("possible_fields", possible_fields);
        require("./utils").display_trace_from_this_projet_only();
        console.log("invalid_options_fields= ", invalid_options_fields);
    }
    assert(invalid_options_fields.length === 0 && " invalid field found in option");

}


/**
 * ensure correctness of a schema object.
 *
 * @method _check_schema_correctness
 * @param schema
 * @private
 */
function _check_schema_correctness(schema) {
    assert(schema.name &&    " expecting schema to have a name");
    assert(schema.fields &&  " expecting schema to provide a set of fields " + schema.name);
    assert(schema.baseType);
}


function visit_schema_chain(schema,options,func) {
    assert(_.isFunction(func));

    // apply also construct to baseType schema first
    var base_schema = _get_base_schema(schema);
    if (base_schema) {
        visit_schema_chain(base_schema,options,func);
    }
    func(schema,options);
}


/**
 * base constructor for all OPC-UA objects
 * @class BaseObject
 * @constructor
 * @param options {Object}
 *
 * OPC-UA objects are created against a schema and provide binary encode/decode facilities.
 *
 */
function BaseObject(options) {

    assert((this instanceof BaseObject)&& " keyword 'new' is required for a constructor call");

    var schema = this.__proto__._schema;
    _check_schema_correctness(schema);

    var self = this;
    assert(this.__proto__._schema === schema);
    assert(this._schema === schema);

    // it is time to ask the scheme construct_hook method,if any, to tweak the option object.
    if (schema.construct_hook) {
        options = schema.construct_hook.call(this,options);
    }

    options = options || {};
    check_options_correctness_against_schema(schema, options);


    function perform_construction(schema,options) {
        // then apply locally
        var data = {
            options: options,
            sub_option_to_ignore: []
        };
        objectVisitor(self, schema, data, constructObject);
    }

    visit_schema_chain(schema,options,perform_construction);

    //xx // Prevents code from adding or deleting properties, or changing the descriptors of any property on an object.
    //xx // Property values can be changed however.
    //xx Object.seal(this);
}

/**
 * Calculate the required size to store this object in a binary stream.
 * @method binaryStoreSize
 * @return {Number}
 */
BaseObject.prototype.binaryStoreSize = function () {

    var stream = new BinaryStreamSizeCalculator();
    this.encode(stream);
    return stream.length;
};

/**
 * encode the object in a stream
 * @method encode
 * @param stream {BinaryStream}
 */
BaseObject.prototype.encode = function(stream) {

    var self = this;
    assert(self._schema);
    var schema =self._schema;

    function _encode(schema,stream) {
        if (schema.encode) {
            // use the encode function specified in the description object instead of default one
            schema.encode(self, stream);
        } else {
            _encode_(self, schema, stream);
        }
    }
    visit_schema_chain(schema,stream,_encode);
};

/**
 * decode the object in a stream
 * @method decode
 * @param stream  {BinaryStream}
 * @param options
 */
BaseObject.prototype.decode = function (stream, options) {
    var self = this;
    assert(self._schema);
    var schema =self._schema;

    function _decode(schema,stream) {
        if (schema.decode) {
            // use the decode function specified in the description object instead of default one
            schema.decode(self, stream, options);
        } else {
            _decode_(self, schema, stream, options);
        }
    }
    visit_schema_chain(schema,stream,_decode);
};

/**
 * @method toString
 * @return {String}
 */
BaseObject.prototype.toString = function () {
    assert(this._schema);
    if (this._schema.toString) {
        return this._schema.toString.apply(this,arguments);
    } else {
        return Object.toString.apply(this,arguments);
    }
};


BaseObject.prototype.toJSON = function () {

    var self = this;


    function JSONify(schema,options) {

        schema.fields.forEach(function (field) {
            var f = self[field.name];
            if (f!==null && f!==undefined) {
              if (f.toJSON) {
                 options[field.name] = f.toJSON();
              } else {
                 options[field.name] = f;
              }
            }
        });
    }


    assert(this._schema);
    if (this._schema.toJSON) {
        return this._schema.toJSON.apply(this,arguments);
    } else {
        //xx return Object.toJSON.apply(this,arguments);
        assert(self._schema);
        var schema =self._schema;
        var options = {};
        visit_schema_chain(schema,options,JSONify);
        return options;
    }
};

/**
 *
 * verify that all object attributes values are valid according to schema
 * @method isValid
 * @return {Boolean}
 */
BaseObject.prototype.isValid = function () {
    assert(this._schema);
    if (this._schema.toString) {
        return this._schema.isValid(this);
    } else {
        return true;
    }
};

/**
 * @method explore
 *
 */
BaseObject.prototype.explore =  function () {
    var self = this;
    var data = { padding: " ", lines: []};
    data.lines.push("message /*" + this._schema.name + "*/ : {");
    objectVisitor(self, self._schema, data, _exploreObject);
    data.lines.push(" };");
    return data.lines.join("\n");
};


/**
 * @method registerEnumeration
 * @param schema
 * @param schema.name { string}
 * @param schema.enumValues {key:Name, value:value}
 * @returns {Enum}
 */
function registerEnumeration(schema) {

    assert(schema.hasOwnProperty("name"));
    assert(schema.hasOwnProperty("enumValues"));

    var name = schema.name;
    // create a new Enum
    var typedEnum = new Enum(schema.enumValues);
    if (_enumerations.hasOwnProperty(name)) {
        throw new Error("factories.registerEnumeration : Enumeration " + schema.name + " has been already inserted");
    }
    _enumerations[name] = schema;
    _enumerations[name].typedEnum = typedEnum;
    return typedEnum;
}

function registerBasicType(schema) {
    var name = schema.name;

    var t = _defaultTypeMap[schema.subtype];
    if ( !t) {
        throw new Error(" cannot find subtype " + schema.subtype);
    }
    assert (t !== undefined," " + util.inspect(schema, {color: true}) + " cannot find subtype " + schema.subtype);
    assert(_.isFunction(t.decode));

    var encodeFunc = schema.encode || t.encode;
    assert(_.isFunction(encodeFunc));

    var decodeFunc = schema.decode || t.decode;
    assert(_.isFunction(decodeFunc));

    var defaultValue = (schema.defaultValue === undefined ) ?  t.defaultValue :schema.defaultValue;
    // assert(_.isFunction(defaultValue));

    var coerceFunc = schema.coerce || t.coerce;
    registerType(name, encodeFunc,decodeFunc, defaultValue,schema.subtype,coerceFunc);
}

factories["BaseObject"] = BaseObject;

/**
 * @methode registerComplexType
 * @param schema
 * @param schema.name     {String} the class name
 * @param schema.baseType {String} [optional][default="BaseObject"] the Object BaseClass
 * @param schema.id       {UIntger} [optional] the value of the node id in namspace0 , if not specified
 *                        the system try to use the <name>__Encoding_DefaultBinary value.
 *
 *
 * @returns {ClassConstructor}
 */
function registerComplexType(schema) {


    var name = schema.name;

    if (name in factories) {
        throw new Error(" Class '" + name + "' already in factories");
    }

    schema.baseType = schema.baseType || "BaseObject";

    // check the unique id of the object
    var id = schema.id;
    if (!id) {
        var encode_name = name + "_Encoding_DefaultBinary";
        id =  objectNodeIds[encode_name];
    }
    assert(id, "" + name + " has no _Encoding_DefaultBinary id\nplease add a Id field in the structure definition");

    var expandedNodeId = ec.makeExpandedNodeId(id);

    var _BaseObject = BaseObject;

    // dealing with inheritance.
    if(schema.baseType) {
        assert(factories.hasOwnProperty(schema.baseType)," base type " + schema.baseType + " not registered in factory");
        _BaseObject = factories[schema.baseType];
    }

    // let's make a constructor
    var ClassConstructor = function(options) {
        assert((this instanceof BaseObject)&& " keyword 'new' is required for constructor call");
        _BaseObject.call(this,options);
    };

    util.inherits(ClassConstructor,_BaseObject);

    ClassConstructor.prototype.encodingDefaultBinary = expandedNodeId;

    ClassConstructor.prototype._schema = schema;
    ClassConstructor.possibleFields = function() {
        return _extract_all_fields(this.prototype._schema);
    };

    factories[name] = ClassConstructor;

    assert(!(expandedNodeId.value in constructorMap)," Class " + name + " with ID  " + expandedNodeId.value + " already in constructorMap");
    constructorMap[expandedNodeId.value] = ClassConstructor;
    return ClassConstructor;
}


/**
 * register a new type of object in the factory
 * @method registerObject
 * @static
 * @param schema {Object} the class schema
 * @return {Function} the created class constructor
 */
exports.registerObject = registerComplexType;

exports.registerBuiltInType = registerType;
exports.registerBasicType = registerBasicType;
exports.registerEnumeration = registerEnumeration;



var getConstructor = function (expandedId) {
    if (!(expandedId && (expandedId.value in constructorMap))) {
        console.log( "cannot find constructor for expandedId ".red.bold);
        console.log(expandedId);
    }
    return constructorMap[expandedId.value];
};

exports.constructObject = function (expandedId) {
    var constructor = getConstructor(expandedId);
    if (!constructor) return null;
    return new constructor();
};


var _next_available_id = 0xFFFE0000;
exports.next_available_id = function(){
    _next_available_id +=1;
    return _next_available_id;
};


registerBasicType({name:"Counter"    ,subtype:"UInt32"});
// OPC Unified Architecture, part 3.0 $8.13 page 65
registerBasicType({name:"Duration"   ,subtype:"Double"});
registerBasicType({name:"UAString"   ,subtype:"String"});
registerBasicType({name:"UtcTime"    ,subtype:"DateTime"});
registerBasicType({name:"Integer"    ,subtype:"Int32"   });
registerBasicType({name:"UInteger"   ,subtype:"UInt32"  });
registerBasicType({name:"Int8"       ,subtype:"SByte"   });
registerBasicType({name:"UInt8"      ,subtype:"Byte"    });
registerBasicType({name:"Number"     ,subtype:"Double"  });
//xx registerBasicType({name:"XmlElement" ,subtype:"String"  });
registerBasicType({name:"Time"       ,subtype:"String"  });
// string in the form "en-US" or "de-DE" or "fr" etc...
//xx registerBasicType({name:"LocaleId"   ,subtype:"String"  });
registerBasicType({
    name: "LocaleId",
    subtype: "String",
    encode: ec.encodeLocaleId,
    decode: ec.decodeLocaleId,
    validate: ec.validateLocaleId,
    defaultValue: null
});

