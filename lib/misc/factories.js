"use strict";
/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

var assert = require("better-assert");

require("./factories_basic_type");

var produce_code = require("../../lib/misc/factory_code_generator").produce_code;
var get_class_javascript_filename = require("../../lib/misc/factory_code_generator").get_class_javascript_filename;

var registerEnumeration = require("./factories_enumerations").registerEnumeration;

exports.registerEnumeration = registerEnumeration;

var debugLog  = require("./utils").make_debugLog(__filename);
var doDebug = require("./utils").checkDebugFlag(__filename);




// var re = /.*\((.*):[0-9]*:[0-9]*\)/g;
// var str = 'at Object.<anonymous> (D:\projet\node-opcua\test\fixtures\fixture_dummy_object_schema.js:30:33)';
//var m = re.exec(str));

var fs = require("fs");

var normalize_require_file = require("./utils").normalize_require_file;

/**
 * register a new object type from a scheme
 * @method registerObject
 * @param schema
 * @return {Function} the object constructor.
 */
function registerObject(schema,optional_folder) {


    var err = new Error();
    var re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    var schema_file = re.exec(err.stack.split("\n")[2])[1];

    assert( schema.generate_source === undefined);

    var schema_name = schema.name+"_Schema";

    var generate_source = get_class_javascript_filename(schema.name,optional_folder);

    debugLog(schema_name);
    debugLog(schema_file);
    debugLog(generate_source);



    var generate_source_exists = fs.existsSync(generate_source);

    var schema_file_is_newer = false;
    var code_generator_is_newer= false;

    if (generate_source_exists) {

        var generated_source_mtime = new Date(fs.statSync(generate_source).mtime).getTime();
        var schema_file_mtime = new Date(fs.statSync(schema_file).mtime).getTime();

        debugLog(generated_source_mtime);
        debugLog(schema_file_mtime);

        schema_file_is_newer = (generated_source_mtime <= schema_file_mtime );

        var code_generator_script = __dirname+"/factory_code_generator.js";

        assert(fs.existsSync(code_generator_script),"cannot get code generator");

        var code_generator_script_mtime = new Date(fs.statSync(code_generator_script).mtime).getTime();
        code_generator_is_newer=  (generated_source_mtime <= code_generator_script_mtime );

    }
    var generated_source_is_outdated = (!generate_source_exists || code_generator_is_newer  || schema_file_is_newer);


    if (generated_source_is_outdated) {
        debugLog(" generated_source_is_outdated ",schema.name," to ",generate_source);
        var code  = produce_code(schema_file,schema_name,generate_source);
    } else {
        debugLog(" reusing  ",schema.name," from ",generate_source);

    }
    schema.generate_source = generate_source;

    var local_generated_source = normalize_require_file(__dirname,generate_source);
    return require(local_generated_source)[schema.name];
}

exports.registerObject = registerObject;

exports.unregisterObject = function(schema) {

    var generate_source = get_class_javascript_filename(schema.name);
    if (fs.existsSync(generate_source)) {
        fs.unlinkSync(generate_source);
        assert(!fs.existsSync(generate_source));
    }
};

exports.registerBasicType    = require("./factories_basic_type").registerBasicType;
exports.registerBuiltInType  = require("./factories_builtin_types").registerType;
exports.unregisterType       = require("./factories_builtin_types").unregisterType;
exports.findSimpleType       = require("./factories_builtin_types").findSimpleType;
exports.findBuiltInType      = require("./factories_builtin_types").findBuiltInType;
exports.constructObject      = require("./factories_factories").constructObject;

var _next_available_id = 0xFFFE0000;
exports.generate_new_id = function() {
    _next_available_id +=1;
    return _next_available_id;
};

exports.next_available_id = function(){
    return -1;
};

