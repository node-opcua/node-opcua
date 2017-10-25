"use strict";

var fs = require("fs");
var path = require("path");
var assert = require("node-opcua-assert");

var normalize_require_file = require("node-opcua-utils").normalize_require_file;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);
var doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */


require("node-opcua-factory/src/factories_basic_type");


var produce_code = require("./factory_code_generator").produce_code;

var get_class_javascript_filename = require("./factory_code_generator").get_class_javascript_filename;

exports.verbose = false;

function get_caller_source_filename() {
    // let's find source code where schema file is described
    // to do make change this
    // the line has the following shape:
    //      'at blah (/home/toto/myfile.js:53:34)'
    var err = new Error();
    var re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    var schema_file = re.exec(err.stack.split("\n")[3])[1];
    return schema_file;
}

/**
 * register a new object type from a schema
 * @method registerObject
 * @param schema
 * @param optional_folder {String}
 * @return {Function} the object constructor.
 */
function registerObject(schema, optional_folder) {

    var schema_file,schema_name,code,local_schema_file;

    if (typeof schema === "string") {

        // we expect <schema>|<hint>
        var hint_schema = schema.split("|");
        if (hint_schema.length === 1) {
            // no hint provided
            var caller_folder = get_caller_source_filename();

            var  default_hint = path.join(path.dirname(caller_folder),"schemas");
            hint_schema.unshift(default_hint);

            optional_folder =  path.join(path.dirname(caller_folder),"_generated_");

        }

        var folder_hint = hint_schema[0];
        schema = hint_schema[1];

        schema_name = schema + "_Schema";
        schema_file = path.join(folder_hint, schema + "_schema.js");
        local_schema_file = schema_file;

        schema = require(local_schema_file)[schema_name];

    } else {

        schema_file = get_caller_source_filename();
        local_schema_file = schema_file;

        if (!optional_folder) {
            console.log(" MIGRATED OLD SCHEME FILE ".red, schema, schema_file);
        }
    }

    assert(schema.generate_source === undefined);

    schema_name = schema.name + "_Schema";

    var generated_source = get_class_javascript_filename(schema.name, optional_folder);

    var generated_source_exists = fs.existsSync(generated_source);

    var schema_file_is_newer = false;
    var code_generator_is_newer = false;

    if (generated_source_exists) {
        var generated_source_mtime = new Date(fs.statSync(generated_source).mtime).getTime();
        var schema_file_mtime = new Date(fs.statSync(local_schema_file).mtime).getTime();
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
    schema.generate_source = generated_source;

    var local_generated_source = normalize_require_file(__dirname, generated_source);
    return require(local_generated_source)[schema.name];
}

exports.registerObject = registerObject;

exports.unregisterObject = function (schema,folder) {

    assert(folder,"#unregisterObject: a folder must be provided");
    var generate_source = get_class_javascript_filename(schema.name,folder);
    if (fs.existsSync(generate_source)) {
        fs.unlinkSync(generate_source);
        assert(!fs.existsSync(generate_source));
    }
};




