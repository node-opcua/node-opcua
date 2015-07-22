"use strict";
/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */
require("requirish")._(module);

var assert = require("better-assert");

require("lib/misc/factories_basic_type");

var produce_code = require("lib/misc/factory_code_generator").produce_code;
var get_class_javascript_filename = require("lib/misc/factory_code_generator").get_class_javascript_filename;

var registerEnumeration = require("lib/misc/factories_enumerations").registerEnumeration;

exports.registerEnumeration = registerEnumeration;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);


// var re = /.*\((.*):[0-9]*:[0-9]*\)/g;
// var str = 'at Object.<anonymous> (D:\projet\node-opcua\test\fixtures\fixture_dummy_object_schema.js:30:33)';
//var m = re.exec(str));

var fs = require("fs");
var path = require("path");
var normalize_require_file = require("lib/misc/utils").normalize_require_file;

exports.verbose = false;
/**
 * register a new object type from a schema
 * @method registerObject
 * @param schema
 * @param optional_folder {String}
 * @return {Function} the object constructor.
 */
function registerObject(schema, optional_folder) {

    var schema_file;
    if (typeof schema === "string") {

        var hint_schema = schema.split("|");
        if (hint_schema.length === 1) {
            hint_schema.unshift("schemas");
        }
        var folder_hint = path.join("../..", hint_schema[0]);
        schema = hint_schema[1];
        var schema_name = schema + "_Schema";
        //
        schema_file = path.normalize(path.join(__dirname, folder_hint, schema + "_schema.js"));

        // schema_file = normalize_require_file(".",schema_file);
        // console.log("schema_file = ",schema_file);
        var local_schema_file = normalize_require_file(__dirname, schema_file);

        //xx console.log("schema_file = ",schema_file);
        //console.log("            = ",local_schema_file);
        schema = require(local_schema_file)[schema_name];

    } else {


        var err = new Error();
        var re = /.*\((.*):[0-9]*:[0-9]*\)/g;
        schema_file = re.exec(err.stack.split("\n")[2])[1];

        if (!optional_folder) {
            console.log(" MIGRATED OLD SCHEME FILE ".red, schema, schema_file);
        }
    }

    assert(schema.generate_source === undefined);

    schema_name = schema.name + "_Schema";

    var generated_source = get_class_javascript_filename(schema.name, optional_folder);

    //xx debugLog(schema_name);
    //xx debugLog(schema_file);
    //xx debugLog(generate_source);


    var generated_source_exists = fs.existsSync(generated_source);

    var schema_file_is_newer = false;
    var code_generator_is_newer = false;

    if (generated_source_exists) {

        var generated_source_mtime = new Date(fs.statSync(generated_source).mtime).getTime();
        var schema_file_mtime = new Date(fs.statSync(schema_file).mtime).getTime();

        //xx debugLog(generated_source_mtime);
        //xx debugLog(schema_file_mtime);

        schema_file_is_newer = (generated_source_mtime <= schema_file_mtime );

        var code_generator_script = path.join(__dirname,"factory_code_generator.js");

        assert(fs.existsSync(code_generator_script), "cannot get code generator");

        var code_generator_script_mtime = new Date(fs.statSync(code_generator_script).mtime).getTime();
        code_generator_is_newer = (generated_source_mtime <= code_generator_script_mtime );

    }
    var generated_source_is_outdated = (!generated_source_exists || code_generator_is_newer || schema_file_is_newer);


    if (generated_source_is_outdated) {
        debugLog(" generated_source_is_outdated ", schema.name, " to ", generated_source);

        if (exports.verbose) {
            console.log(" generating ", schema.name, " in ", generated_source);
        }
        var code = produce_code(schema_file, schema_name, generated_source);
    }
    //else {
    // debugLog(" reusing  ",schema.name," from ",generated_source);
    //}
    schema.generate_source = generated_source;

    var local_generated_source = normalize_require_file(__dirname, generated_source);
    return require(local_generated_source)[schema.name];
}

exports.registerObject = registerObject;

exports.unregisterObject = function (schema) {

    var generate_source = get_class_javascript_filename(schema.name);
    if (fs.existsSync(generate_source)) {
        fs.unlinkSync(generate_source);
        assert(!fs.existsSync(generate_source));
    }
};

exports.registerBasicType = require("lib/misc/factories_basic_type").registerBasicType;
exports.registerBuiltInType = require("lib/misc/factories_builtin_types").registerType;
exports.unregisterType = require("lib/misc/factories_builtin_types").unregisterType;
exports.findSimpleType = require("lib/misc/factories_builtin_types").findSimpleType;
exports.findBuiltInType = require("lib/misc/factories_builtin_types").findBuiltInType;
exports.constructObject = require("lib/misc/factories_factories").constructObject;
exports.getFactory = require("lib/misc/factories_factories").getFactory;


var _FIRST_INTERNAL_ID = 0xFFFE0000;

var _next_available_id = _FIRST_INTERNAL_ID;
exports.generate_new_id = function () {
    _next_available_id += 1;
    return _next_available_id;
};

exports.next_available_id = function () {
    return -1;
};
exports.is_internal_id = function (value) {
    return value >= _FIRST_INTERNAL_ID;
};


