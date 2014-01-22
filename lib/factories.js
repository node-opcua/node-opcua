var assert = require("assert");
var ec = require("./encode_decode");
var util =require("util");

factories = {};


var _defaultType = [

    { name: "UAString" , encode: ec.encodeUAString, decode: ec.decodeUAString  , defaultValue: ""},
    { name: "Integer",   encode: ec.encodeInt32, decode: ec.decodeInt32, defaultValue: 0 },
    { name: "Int32",     encode: ec.encodeInt32, decode: ec.decodeInt32, defaultValue: 0 },
    { name: "UInt32",    encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0 },
    { name: "Double",    encode: ec.encodeDouble, decode: ec.decodeDouble, defaultValue: 0.0 },
    { name: "Float",     encode: ec.encodeFloat, decode: ec.decodeFloat, defaultValue: 0.0 },
    // OPC Unified Architecture, part 3.0 $8.26 page 67
    { name: "UtcTime",   encode: ec.encodeDateTime, decode: ec.decodeDateTime, defaultValue: new Date() },

    // OPC Unified Architecture, part 4.0 $7.13
    // IntegerID: This primitive data type is an UInt32 that is used as an identifier, such as a handle. All values,
    // except for 0, are valid.
    { name: "IntegerId",   encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0xFFFFFFFF },

    { name: "NodeId",      encode: ec.encodeNodeId, decode: ec.decodeNodeId, defaultValue: ec.makeNodeId() }

];

var _defaultTypeMap = {}; _defaultType.forEach(function(d) {_defaultTypeMap[d.name] = d;});

function registerType(name,encodeFunc,decodeFunc,defaultValue)
{

    var obj = {
        name: name,encode:encodeFunc,decode:decodeFunc,defaultValue:defaultValue
        };
    _defaultType.push(obj);
    _defaultTypeMap[name] = obj;
}

exports.findSimpleType = function findSimpleType(name) {
    if (name in _defaultTypeMap) {
        return _defaultTypeMap[name];
    }
    throw "cannot find " + name + " in "+ util.inspect(_defaultTypeMap);
};

function _encode_by_type(obj,fieldType,stream)
{
    var _t = _defaultTypeMap[fieldType];
    _t.encode(obj,stream);
}

function _decode_by_type(obj,fieldType,stream)
{
    var _t = _defaultTypeMap[fieldType];
    obj = _t.decode(stream);
    return obj;
}


function _encode_(obj,objDesc,stream)
{
    objDesc.fields.forEach(function(field) {
        if (obj.hasOwnProperty(field.name)) {
            _encode_by_type(obj[field.name],field.fieldType,stream);
        }
    });
}
function _decode_(obj,objDesc,stream)
{
    objDesc.fields.forEach(function(field) {
        if (obj.hasOwnProperty(field.name)) {
            obj[field.name] = _decode_by_type(obj[field.name],field.fieldType,stream);
        }
    });
}


function callConstructor(constructor) {
    var factoryFunction = constructor.bind.apply(constructor, arguments);
    return new factoryFunction();
}


function UAObjectFactoryBuild(_description)
{
    var description =_description;
    var name = description.name;


    if (description.hasOwnProperty("subtype")) {

        //
        var t = _defaultTypeMap[description.subtype];
        if (t === undefined) {
            throw " "+ util.inspect(description,{color: true}) +" cannot find subtype " + description.subtype;
        }
        registerType(name, t.encode, t.decode, t.defaultValue);
        return;
    }


    var classConstructor;
    classConstructor = function (options) {

        var self = this;

        options = options || {};

        // construct default properties

        var sub_option_to_ignore = [];
        if (!description.fields) {
            console.log("description",description)
        }
        description.fields.forEach( function(field) {

            var fieldType = field.fieldType;
            var fieldName = field.name;


            function _addSimpleField(fieldType,isArray,defaultValue) {
                _type = _defaultTypeMap[fieldType];

                if(isArray)  {
                    return  [];
                } else {
                    defaultValue = defaultValue || _type.defaultValue;
                    // this is a default type such as UAString or Integer
                    return  defaultValue;
                }
            }

            if ( fieldType in _defaultTypeMap) {

                self[fieldName]  = _addSimpleField(fieldType,field.isArray, field.defaultValue);

            } else if (fieldType in factories) {

                if (field.subtype) {
                    // this is a synonymous
                    fieldType = field.subType;
                    self[fieldName]  = _addSimpleField(fieldType,field.isArray,field.defaultValue);

                } else {
                    // this is a  complex type
                    // find options related to this filed in options
                    sub_options = {};
                    if (fieldName in options) {
                        sub_options = options[fieldName];
                        sub_option_to_ignore.push(fieldName);
                    }
                    if(field.isArray)  {
                        console.log(" adding ", fieldName);
                        self[fieldName] = [];
                    } else {
                        _constructor = factories[fieldType];
                        self[fieldName] = callConstructor(_constructor, sub_options);
                    }
                }

            } else {
                throw "Invalid field type : " + fieldType + " is not a default type nor a registered complex struct";
            }

        });

        for (option in options) {
            if (options.hasOwnProperty(option) && sub_option_to_ignore.indexOf(option) == -1) {
                assert(!(this[options] instanceof Object)); //
                this[option] = options[option];
            }
        }
    };


    classConstructor.prototype.encode = function(stream) {
        _encode_(this,description,stream);
    };
    classConstructor.prototype.decode = function(stream) {
        _decode_(this,description,stream);
    };

    factories[name] = classConstructor;

    return classConstructor;
}


exports.UAObjectFactoryBuild = UAObjectFactoryBuild;