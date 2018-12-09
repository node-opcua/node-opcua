"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node-opcua-assert").assert;

const normalize_require_file = require("node-opcua-utils").normalize_require_file;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */


require("node-opcua-factory/src/factories_basic_type");


const produce_code = require("./factory_code_generator").produce_code;

const get_class_javascript_filename = require("./factory_code_generator").get_class_javascript_filename;

exports.verbose = false;

function get_caller_source_filename() {
    // let's find source code where schema file is described
    // to do make change this
    // the line has the following shape:
    //      'at blah (/home/toto/myfile.js:53:34)'
    const err = new Error();
    const re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    const schema_file = re.exec(err.stack.split("\n")[3])[1];
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
    let schema_file;
    let schema_name;
    let code;
    let local_schema_file;

    if (typeof schema === "string") {

        // we expect <schema>|<hint>
        const hint_schema = schema.split("|");
        if (hint_schema.length === 1) {
            // no hint provided
            const caller_folder = get_caller_source_filename();

            const default_hint = path.join(path.dirname(caller_folder),"schemas");
            hint_schema.unshift(default_hint);

            optional_folder =  path.join(path.dirname(caller_folder),"_generated_");

        }

        const folder_hint = hint_schema[0];
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

    const generated_source = get_class_javascript_filename(schema.name, optional_folder);

    const generated_source_exists = fs.existsSync(generated_source);

    let schema_file_is_newer = false;
    let code_generator_is_newer = false;

    if (generated_source_exists) {
        const generated_source_mtime = new Date(fs.statSync(generated_source).mtime).getTime();
        const schema_file_mtime = new Date(fs.statSync(local_schema_file).mtime).getTime();
        schema_file_is_newer = (generated_source_mtime <= schema_file_mtime );
        const code_generator_script = path.join(__dirname,"factory_code_generator.js");
        assert(fs.existsSync(code_generator_script), "cannot get code generator");
        const code_generator_script_mtime = new Date(fs.statSync(code_generator_script).mtime).getTime();
        code_generator_is_newer = (generated_source_mtime <= code_generator_script_mtime );
    }
    const generated_source_is_outdated = (!generated_source_exists || code_generator_is_newer || schema_file_is_newer);

    if (generated_source_is_outdated) {
        debugLog(" generated_source_is_outdated ", schema.name, " to ", generated_source);
        if (exports.verbose) {
            console.log(" generating ", schema.name, " in ", generated_source);
        }
        code = produce_code(schema_file, schema_name, generated_source);
    }
    schema.generate_source = generated_source;

    const local_generated_source = normalize_require_file(__dirname, generated_source);
    return require(local_generated_source)[schema.name];
}

exports.registerObject = registerObject;

exports.unregisterObject = function (schema,folder) {

    assert(folder,"#unregisterObject: a folder must be provided");
    const generate_source = get_class_javascript_filename(schema.name,folder);
    if (fs.existsSync(generate_source)) {
        fs.unlinkSync(generate_source);
        assert(!fs.existsSync(generate_source));
    }
};




