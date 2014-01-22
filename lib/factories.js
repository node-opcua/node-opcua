var assert = require("assert");
var ec = require("./encode_decode");

factories = {};


var _defaultType = [

    { name: "UAString" , encode: ec.encodeUAString, decode: ec.decodeUAString  , defaultValue: ""},
    { name: "Integer", encode: ec.encodeInt32, decode: ec.decodeInt32, defaultValue: 0 },
    { name: "Int32", encode: ec.encodeInt32, decode: ec.decodeInt32, defaultValue: 0 },
    { name: "UInt32", encode: ec.encodeUInt32, decode: ec.decodeUInt32, defaultValue: 0 },
    { name: "Double", encode: ec.encodeDouble, decode: ec.decodeDouble, defaultValue: 0.0 },
    { name: "Float", encode: ec.encodeFloat, decode: ec.decodeFloat, defaultValue: 0.0 }

];

var _defaultTypeMap = {}; _defaultType.forEach(function(d) {_defaultTypeMap[d.name] = d;});


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

    var classConstructor;
    classConstructor = function (options) {
        var self = this;
        // construct default properties

        var sub_option_to_ignore = [];

        description.fields.forEach( function(field) {

            if ( field.fieldType in _defaultTypeMap) {

                _defaultType = _defaultTypeMap[field.fieldType];

                defaultValue = "defaultValue" in field ? field["defaultValue"] : _defaultType.defaultValue;

                // this is a default type such as UAString or Integer
                self[field.name] = defaultValue;

            } else if (field.fieldType in factories) {
                // this is a  complex type
                // find options related to this filed in options
                sub_options = {};
                if (field.name in options) {
                    sub_options = options[field.name];
                    sub_option_to_ignore.push(field.name);
                }
                _constructor = factories[field.fieldType];
                self[field.name] = callConstructor(_constructor, sub_options);
            } else {
                throw "Invalid field type : " + field.fieldType + " is not a default type nor a registered complex struct";
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