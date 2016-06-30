"use strict";
/**
 * @module opcua.miscellaneous
 */


require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var _defaultTypeMap = require("lib/misc/factories_builtin_types")._defaultTypeMap;
var TypeSchema = require("lib/misc/factories_builtin_types").TypeSchema;

var _enumerations = require("lib/misc/factories_enumerations")._private._enumerations;
var getFactory = require("lib/misc/factories_factories").getFactory;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
exports.doDebug = !!process.env.DEBUG_CLASS;



/**
 * ensure correctness of a schema object.
 *
 * @method check_schema_correctness
 * @param schema
 *
 */
function check_schema_correctness(schema) {
    assert(schema.name, " expecting schema to have a name");
    assert(schema.fields, " expecting schema to provide a set of fields " + schema.name);
    assert(schema.baseType === undefined || (typeof schema.baseType === "string"));
}
exports.check_schema_correctness = check_schema_correctness;

/**
 *
 * @method get_base_schema
 * @param schema
 * @return {*}
 *
 */
function get_base_schema(schema) {

    var base_schema = schema._base_schema;
    if (base_schema) {
        return base_schema;
    }

    if (schema.baseType && schema.baseType !== "BaseUAObject") {
        var baseType = getFactory(schema.baseType);

        // istanbul ignore next
        if (!baseType) {
            throw new Error(" cannot find factory for " + schema.baseType);
        }
        if (baseType.prototype._schema) {
            base_schema = baseType.prototype._schema;
        }
    }
    // put in  cache for speedup
    schema._base_schema = base_schema;

    return base_schema;
}
exports.get_base_schema = get_base_schema;

/**
 * extract a list of all possible fields for a schema
 * (by walking up the inheritance chain)
 * @method extract_all_fields
 *
 */
function extract_all_fields(schema) {

    // returns cached result if any
    // istanbul ignore next
    if (schema._possible_fields) {
        return schema._possible_fields;
    }
    // extract the possible fields from the schema.
    var possible_fields = schema.fields.map(function (field) {
        return field.name;
    });

    var base_schema = get_base_schema(schema);

    // istanbul ignore next
    if (base_schema) {
        var fields = extract_all_fields(base_schema);
        possible_fields = fields.concat(possible_fields);
    }

    // put in cache to speed up
    schema._possible_fields = possible_fields;

    return possible_fields;
}
exports.extract_all_fields = extract_all_fields;

/**
 * check correctness of option fields against scheme
 *
 * @method  check_options_correctness_against_schema
 *
 */
function check_options_correctness_against_schema(obj, schema, options) {

    if (!exports.doDebug) {
        return ; // ignoring set
    }

    // istanbul ignore next
    if (!_.isObject(options)) {
        var message = " Invalid options specified while trying to construct a ".red.bold + " " + schema.name.yellow;
        message += " expecting a ".red.bold + " Object ".yellow;
        message += " and got a ".red.bold + (typeof options).yellow + " instead ".red.bold;
        console.log(" Schema  = ", schema);
        console.log(" options = ", options);
        throw new Error(message);
    }

    // istanbul ignore next
    if (options instanceof obj.constructor) {
        return true;
    }

    // extract the possible fields from the schema.
    var possible_fields = obj.constructor.possibleFields;

    // extracts the fields exposed by the option object
    var current_fields = Object.keys(options);


    // get a list of field that are in the 'options' object but not in schema
    var invalid_options_fields = _.difference(current_fields, possible_fields);

    /* istanbul ignore next */
    if (invalid_options_fields.length > 0) {
        console.log("expected schema", schema.name);
        console.log("schema", schema);
        console.log("possible_fields", possible_fields);
        require("lib/misc/utils").display_trace_from_this_projet_only();
        console.log("invalid_options_fields= ", invalid_options_fields);
    }
    if (invalid_options_fields.length !== 0) {
        throw new Error(" invalid field found in option :" + JSON.stringify(invalid_options_fields));
    }
    return true;

}
exports.check_options_correctness_against_schema = check_options_correctness_against_schema;


function __field_category(field) {

    if (!field.category) {
        var fieldType = field.fieldType;

        if (_enumerations[fieldType]) {

            field.category = "enumeration";
            field.schema = _enumerations[fieldType];

            assert(field.schema instanceof TypeSchema);


        } else if (getFactory(fieldType)) {

            field.category = "complex";
            field.schema = getFactory(fieldType);

        } else if (_defaultTypeMap[fieldType]) {

            field.category = "basic";
            field.schema = _defaultTypeMap[fieldType];
            assert(field.schema instanceof TypeSchema);

        }
        // istanbul ignore next
        else {
            console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ERROR !".bgRed);
            require("lib/misc/factories_factories").dump();

            console.log("-------------------------------------------------------------");
            Object.keys(require.cache).sort().forEach(function (k) {
                console.log(k);
            });
            //xx console.log(f);
            throw new Error("Invalid field type : " + fieldType + " =( " + JSON.stringify(field) + ") is not a default type nor a registered complex struct");
        }
    }
    return field.category;
}
function resolve_schema_field_types(schema) {

    if (schema.resolved) {
        return;
    }
    schema.fields.forEach(function (field) {
        if (field.fieldType === schema.name) {
            // special case for structure recursion
            field.category = "complex";
            field.schema = schema;
        } else {
            __field_category(field);

        }
        assert(field.category);
    });
    schema.resolved = true;
}
exports.resolve_schema_field_types = resolve_schema_field_types;


/**
 * @method initialize_value
 * @param field
 * @param value
 * @return {*}
 */
exports.initialize_field = function (field, value) {

    var _t = field.schema;
    assert(_t instanceof TypeSchema);
    assert(_.isObject(_t), "expecting a object here ");
    assert(_.isObject(field));
    assert(!field.isArray);

    var defaultValue = _t.computer_default_value(field.defaultValue);

    value = _t.initialize_value(value, defaultValue);

    if (field.validate) {
        if (!field.validate(value)) {
            throw Error(" invalid value " + value + " for field " + field.name + " of type " + field.fieldType);
        }
    }
    return value;
};

///**
// * Initialize a array of object of a given type.
// * @method initialize_array
// * @param typeName {string} the type name of the objects ( must be in _defaultTypeMap)
// * @param values   {Array[Object] || null} a optional array with the parameters to pass to the object constructor
// * @return {Array[typeName]}
// *
// * @example:
// *
// *
// *
// */
//exports.initialize_array = function(typeName,values) {
//
//    var arr = [];
//
//    if (_.isArray(values)) {
//        var _t = _defaultTypeMap[typeName];
//        var defaultValue = _t.computer_default_value(undefined);
//        values.forEach(function(el){
//            arr.push(_t.initialize_value(el,defaultValue));
//        });
//    }
//    return arr;
//
//};

/**
 * @method initialize_field_array
 * @param field
 * @param valueArray
 * @return {Array}
 */
exports.initialize_field_array = function (field, valueArray) {

    var _t = field.schema;

    var value, i;
    assert(_.isObject(field));
    assert(field.isArray);

    if (!valueArray && field.defaultValue === null) {
        return null;
    }

    valueArray = valueArray || [];
    var defaultValue = _t.computer_default_value(field.defaultValue);

    var arr = [];
    for (i = 0; i < valueArray.length; i++) {
        value = _t.initialize_value(valueArray[i], defaultValue);
        arr.push(value);
    }
    if (field.validate) {
        for (i = 0; i < arr.length; i++) {
            if (!field.validate(arr[i])) {
                throw Error(" invalid value " + arr[i] + " for field " + field.name + " of type " + field.fieldType);
            }
        }
    }
    return arr;
};

