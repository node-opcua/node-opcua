var assert = require("assert");
var ec = require("./encode_decode");
var util =require("util");
require('enum').register();
var _ = require("underscore");

factories = {};
_enumerations = {};


var _defaultType = [

    { name: "UAString" , encode: ec.encodeUAString, decode: ec.decodeUAString  , defaultValue: ""},
    { name: "Byte",      encode: ec.encodeByte,   decode: ec.decodeByte, defaultValue: 0 },
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

    // string in the form "en-US" or "de-DE" or "fr" etc...
    { name: "LocaleId",    encode: ec.encodeLocaleId, decode: ec.decodeLocaleId, validate:ec.validateLocaleId, defaultValue: "en" },

    { name: "NodeId",      encode: ec.encodeNodeId, decode: ec.decodeNodeId, defaultValue: ec.makeNodeId() },

    { name: "ByteString",  encode: ec.encodeByteString, decode: ec.decodeByteString, defaultValue: null }

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
    try {
        var _t = _defaultTypeMap[fieldType];
        _t.encode(obj,stream);
    }
    catch(err) {
        console.log(" cannot encode " + fieldType + " on " + util.inspect(obj));
    }
}

function _decode_by_type(obj,fieldType,stream)
{
    var _t = _defaultTypeMap[fieldType];
    var obj = _t.decode(stream);
    return obj;
}


function _encode_member_(member,fieldType,stream)
{
    if (_defaultTypeMap[fieldType]) {

        _encode_by_type(member,fieldType,stream);

    } else if (factories[fieldType]) {

        // assert(obj[field.name].hasOwnProperty("encode"));
        member.encode(stream);

    } else if (_enumerations[fieldType]) {

        console.log("Missing Enumeration");

    } else {

        throw new Error(" Invalid field" + fieldType);
    }
}
function _decode_member_(member,fieldType,stream)
{
    if (_defaultTypeMap[fieldType]) {

        member = _decode_by_type(member,fieldType,stream);
        return member;

    } else if (factories[fieldType]) {

        member.decode(stream);

    } else if (_enumerations[fieldType]) {

        console.log("Missing Enumeration");

    } else {

        throw new Error(" Invalid field" + field.fieldType);
    }
    return null;
}

function _encode_(obj,objDesc,stream) {
    objDesc.fields.forEach(function(field) {


        if (obj.hasOwnProperty(field.name)) {

            var member = obj[field.name];
            var fieldType = field.fieldType;
            if (_.isArray(member)) {

                stream.writeUInt32(member.length);
                member.forEach(function(element) {
                    _encode_member_(element,fieldType,stream);
                });
            } else {
                _encode_member_(member,fieldType,stream);
            }

        } else {
            throw new Error(" Missing field " + field.name + " in object "+ util.inspect(obj));
        }
    });
}


function _build_default_value(fieldType,isArray,defaultValue) {

    if (isArray) {
        return [];
    }

    if (_defaultTypeMap[fieldType]) {

        _type  = _defaultTypeMap[fieldType];

        defaultValue = defaultValue || _type.defaultValue;
        if (_.isFunction(defaultValue)) {
            defaultValue = defaultValue.call();
        }
        // this is a default type such as UAString or Integer
        return  defaultValue;


    } else if (factories[fieldType]) {

        sub_options = sub_options || {};
        _constructor = factories[fieldType];
        return callConstructor(_constructor, defaultValue);

    } else if (_enumerations[fieldType]) {

        console.log("Missing Enumeration");

    } else {

        throw new Error(" Invalid field" + field.fieldType);
    }
    return null;
}

function _decode_(obj,objDesc,stream) {
    objDesc.fields.forEach(function(field) {

        if (obj.hasOwnProperty(field.name)) {

            var member = obj[field.name];
            var fieldType = field.fieldType;

            if (_.isArray(member)) {

                assert(member.length===0);

                var nb = stream.readUInt32();
                for (var i =0;i<nb;i++) {
                    var element = _build_default_value(fieldType,false,field.defaultValue);
                    member.push(element);
                    member = _decode_member_(element,fieldType,stream) || member;
                }
            } else {
                obj[field.name] = _decode_member_(member,fieldType,stream) || member;
            }

        }
    });
}

function installEnumProp(obj,name,Enum){

    var private_name ="__"+name;
    obj[private_name] = Enum.enums[0];

    // create a array of possible value for the enum
    param = {};

    param[name] = {
        set : function (value){
            if (!(value in Enum )) {
                throw "Invalid value provided for Enum " + name+ ": " + value;
            }
            this[private_name] = value;
        },
        get : function() {
            return this[private_name];
        },
        enumerable: true

    };
    Object.defineProperties(obj,param);
    Object.defineProperty(obj,private_name,{ hidden: true, enumerable: false});
}

exports.installEnumProp = installEnumProp;


function callConstructor(constructor) {
    var factoryFunction = constructor.bind.apply(constructor, arguments);
    return new factoryFunction();
}


function UAObjectFactoryBuild(_description)
{
    var description =_description;
    var name = description.name;

    if (description.hasOwnProperty("isEnum")) {
        // create a new Enum
        var myEnum = new Enum(description.enumValues);
        // xx if ( name in enumerations) { throw " already inserted"; }
        _enumerations[name] = description;
        return myEnum;
    }

    if (description.hasOwnProperty("subtype")) {

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
            throw new Error("fields missing in description " + description)
        }
        description.fields.forEach( function(field) {

            var fieldType = field.fieldType;
            var fieldName = field.name;


            function _addSimpleField(fieldType,isArray,defaultValue) {

                _type  = _defaultTypeMap[fieldType];
                return _build_default_value(fieldType,isArray,defaultValue);
            }


            if ( fieldType in _enumerations ) {

                 var typedEnum  = new Enum(_enumerations[fieldType].enumValues);
                 installEnumProp(self,fieldName,typedEnum);

            } else if ( fieldType in _defaultTypeMap) {

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
                    self[fieldName] =  _build_default_value(fieldType,field.isArray,sub_options);
                }

            } else {
                throw new Error("Invalid field type : " + fieldType + " is not a default type nor a registered complex struct");
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