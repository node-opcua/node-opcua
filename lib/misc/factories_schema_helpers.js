"use strict";
/**
 * @module opcua.miscellaneous
 */



var _ = require("underscore");
var assert = require("better-assert");
var util = require('util');

var _defaultTypeMap = require("./factories_builtin_types")._defaultTypeMap;
var TypeSchema =require("./factories_builtin_types").TypeSchema;

var _enumerations = require("./factories_enumerations")._private._enumerations;
var factories  = require("./factories_factories")._private.factories;

var debugLog = require("./utils").make_debugLog(__filename);


/**
 * ensure correctness of a schema object.
 *
 * @method check_schema_correctness
 * @param schema
 *
 */
function check_schema_correctness(schema) {
    assert(schema.name ,   " expecting schema to have a name");
    assert(schema.fields ,  " expecting schema to provide a set of fields " + schema.name);
    assert(schema.baseType === undefined || typeof(schema.baseType) === 'string');
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

    if (schema.baseType && schema.baseType !== "BaseUAObject" ) {
        var baseType = factories[schema.baseType];
        if (!baseType) {
            throw new Error( " cannot find factory for " + schema.baseType);
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
    if (schema._possible_fields) {
        return schema._possible_fields;
    }
    // extract the possible fields from the schema.
    var possible_fields = schema.fields.map(function (field) { return field.name;});

    var base_schema = get_base_schema(schema);
    if (base_schema) {
        var fields = extract_all_fields(base_schema);
        possible_fields  = fields.concat(possible_fields);
    }

    // put in cache to speed up
    schema._possible_fields = possible_fields;

    return possible_fields;
}
exports.extract_all_fields = extract_all_fields;



///**
// * return the initial value of a constructed field.
// * @method install_initial_value
// * @param field
// * @param options
// *
// * if the field is not specified in the options, the default value will be used
// */
//function install_initial_value(field,options) {
//
//    if (field.isArray) {
//        var arr = [];
//        if (options[field.name]) {
//            assert(_.isArray(options[field.name]));
//            options[field.name].forEach(function(el){
//                var init_data = {};
//                init_data[field.name]=el;
//                var value =___install_single_initial_value(field,init_data);
//                arr.push(value);
//            });
//        }
//        return arr;
//    }
//    return ___install_single_initial_value(field,options);
//}
//
//exports.install_initial_value = install_initial_value;
//
//function ___install_single_initial_value(field,options) {
//
//    if (typeof options !== "object")  {
//        debugLog({ field: field , options: options} );
//        throw new Error(" expecting options for field " + util.inspect(field));
//    }
//
//    var value = null;
//
//    var typeDef = _defaultTypeMap[field.fieldType];
//
//    // what is the default value we should be using here ...
//    var defaultValue = field.defaultValue;
//    if (defaultValue === undefined ) {
//        if (typeDef) {
//            defaultValue = typeDef.defaultValue;
//        }
//    }
//
//    value = options[field.name ];
//    if ( value !== undefined ) {
//        // the user has specified a value for this field
//
//        if (field.defaultValue === null && value === null) {
//            // special case when null defaultValue is allowed
//            return value;
//        }
//        // if there is a coercion method  for this field, use it
//        if (field.coerce) {
//            value = field.coerce(value);
//        } else if (typeDef && typeDef.coerce) {
//            value = typeDef.coerce(value);
//        }
//
//    } else {
//        // let fall back to the default value
//        if (_.isFunction(defaultValue)) {
//            value = defaultValue.call();
//        } else {
//            value = defaultValue;
//        }
//        // don't coerce
//    }
//
//    if (field.validate) {
//        assert(_.isFunction(field.validate));
//        if (!field.validate(value)) {
//            throw Error(" invalid value " + value + " for field " + field.name + " in " + options  );
//        }
//    }
//    return value;
//
//}



/**
 * check correctness of option fields against scheme
 *
 * @method  check_options_correctness_against_schema
 *
 */
function check_options_correctness_against_schema(obj,schema, options) {

    if (!_.isObject(options)) {
        var message = " Invalid options specified while trying to construct a ".red.bold  + " " + schema.name.yellow;
        message += " expecting a ".red.bold + " Object ".yellow;
        message += " and got a ".red.bold +  typeof(options).yellow  + " instead ".red.bold;
        console.log(" Schema  = ",schema);
        console.log(" options = ",options);
        throw new Error(message);
    }

    // extract the possible fields from the schema.
    var possible_fields =  obj.constructor.possibleFields;

    // extracts the fields exposed by the option object
    var current_fields = Object.keys(options);

    // get a list of field that are in the 'options' object but not in schema
    var invalid_options_fields = _.difference(current_fields, possible_fields);

    if (invalid_options_fields.length > 0) {
        console.log("expected schema", schema.name);
        console.log("schema",schema);
        console.log("possible_fields", possible_fields);
        require("./utils").display_trace_from_this_projet_only();
        console.log("invalid_options_fields= ", invalid_options_fields);
    }
    assert(invalid_options_fields.length === 0 && " invalid field found in option");

}
exports.check_options_correctness_against_schema = check_options_correctness_against_schema;



function __field_category(field) {

    if (!field.category) {
        var fieldType = field.fieldType;

        if (_enumerations[fieldType]) {

            field.category = "enumeration";
            field.schema = _enumerations[fieldType];

            assert(field.schema instanceof TypeSchema);


        } else if (factories[fieldType]) {

            field.category = "complex";
            field.schema = factories[fieldType];

        } else if (_defaultTypeMap[fieldType]) {

            field.category = "basic";
            field.schema = _defaultTypeMap[fieldType];
            assert(field.schema instanceof TypeSchema);

        } else {
            throw new Error("Invalid field type : " + fieldType
                + JSON.stringify(field) + " is not a default type nor a registered complex struct");
        }
    }
    return field.category;
}
function resolve_schema_field_types(schema) {

    if (schema.resolved) return;
    schema.fields.forEach(function(field){
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
 * @param defaultValue
 * @return {*}
 */
exports.initialize_field = function(field,value) {

    var _t =field.schema;
    assert(_t instanceof TypeSchema);
    assert(_.isObject(_t), "expecting a object here ");
    assert(_.isObject(field));
    assert(!field.isArray);

    var defaultValue = _t.computer_default_value(field.defaultValue);

    value =  _t.initialize_value(value,defaultValue);

    if (field.validate) {
        if (!field.validate(value)) {
            throw Error(" invalid value " + value + " for field " + field.name + " of type " + field.fieldType );
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
exports.initialize_field_array= function(field,valueArray) {

    var _t =field.schema;

    var value,i;
    assert(_.isObject(field));
    assert(field.isArray);

    valueArray = valueArray || [];
    var defaultValue = _t.computer_default_value(field.defaultValue);

    var arr = [];
    for (i =0;i< valueArray.length; i++ ){
        value = _t.initialize_value(valueArray[i],defaultValue);
        arr.push(value);
    }
    if (field.validate) {
        for(i=0;i<arr.length;i++){
            if (!field.validate(arr[i])) {
                throw Error(" invalid value " + arr[i] + " for field " + field.name + " of type " + field.fieldType );
            }
        }
    }
    return arr;
};
