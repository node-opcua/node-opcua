/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

import assert from "better-assert";


import { produce_code } from "lib/misc/factory_code_generator";
import { get_class_javascript_filename } from "lib/misc/factory_code_generator";
import { registerEnumeration } from "lib/misc/factories_enumerations";

import { make_debugLog, checkDebugFlag } from "lib/misc/utils"; 

import fs from "fs";

import path from "path";
import { normalize_require_file } from "lib/misc/utils";


import { registerBasicType } from "lib/misc/factories_basic_type";
import { registerType as registerBuiltInType } from "lib/misc/factories_builtin_types";
import { unregisterType } from "lib/misc/factories_builtin_types";
import { findSimpleType } from "lib/misc/factories_builtin_types";
import { findBuiltInType } from "lib/misc/factories_builtin_types";
import { constructObject } from "lib/misc/factories_factories";
import { getFactory } from "lib/misc/factories_factories";


require("lib/misc/factories_basic_type");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


/**
 * register a new object type from a schema
 * @method registerObject
 * @param schema
 * @param optional_folder {String}
 * @return {Function} the object constructor.
 */
function registerObject(schema, optional_folder) {
  let schema_file;
  if (typeof schema === "string") {
    const hint_schema = schema.split("|");
    if (hint_schema.length === 1) {
      hint_schema.unshift("schemas");
    }
    const folder_hint = path.join("../..", hint_schema[0]);
    schema = hint_schema[1];
    var schema_name = `${schema}_Schema`;
        //
    schema_file = path.normalize(path.join(__dirname, folder_hint, `${schema}_schema.js`));

        // schema_file = normalize_require_file(".",schema_file);
        // console.log("schema_file = ",schema_file);
    const local_schema_file = normalize_require_file(__dirname, schema_file);

        // xx console.log("schema_file = ",schema_file);
        // console.log("            = ",local_schema_file);
    schema = require(local_schema_file)[schema_name];
  } else {
    const err = new Error();
    const re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    schema_file = re.exec(err.stack.split("\n")[2])[1];

    if (!optional_folder) {
      console.log(" MIGRATED OLD SCHEME FILE ".red, schema, schema_file);
    }
  }

  assert(schema.generate_source === undefined);

  schema_name = `${schema.name}_Schema`;

  const generated_source = get_class_javascript_filename(schema.name, optional_folder);

    // xx debugLog(schema_name);
    // xx debugLog(schema_file);
    // xx debugLog(generate_source);


  const generated_source_exists = fs.existsSync(generated_source);

  let schema_file_is_newer = false;
  let code_generator_is_newer = false;

  if (generated_source_exists) {
    const generated_source_mtime = new Date(fs.statSync(generated_source).mtime).getTime();
    const schema_file_mtime = new Date(fs.statSync(schema_file).mtime).getTime();

        // xx debugLog(generated_source_mtime);
        // xx debugLog(schema_file_mtime);

    schema_file_is_newer = (generated_source_mtime <= schema_file_mtime);

    const code_generator_script = path.join(__dirname,"factory_code_generator.js");

    assert(fs.existsSync(code_generator_script), "cannot get code generator");

    const code_generator_script_mtime = new Date(fs.statSync(code_generator_script).mtime).getTime();
    code_generator_is_newer = (generated_source_mtime <= code_generator_script_mtime);
  }
  const generated_source_is_outdated = (!generated_source_exists || code_generator_is_newer || schema_file_is_newer);


  if (generated_source_is_outdated) {
    debugLog(" generated_source_is_outdated ", schema.name, " to ", generated_source);

    if (exports.verbose) {
      console.log(" generating ", schema.name, " in ", generated_source);
    }
    const code = produce_code(schema_file, schema_name, generated_source);
  }
    // else {
    // debugLog(" reusing  ",schema.name," from ",generated_source);
    // }
  schema.generate_source = generated_source;

  const local_generated_source = normalize_require_file(__dirname, generated_source);
  return require(local_generated_source)[schema.name];
}

export { registerObject };

export function unregisterObject(schema) {
  const generate_source = get_class_javascript_filename(schema.name);
  if (fs.existsSync(generate_source)) {
    fs.unlinkSync(generate_source);
    assert(!fs.existsSync(generate_source));
  }
}


const _FIRST_INTERNAL_ID = 0xFFFE0000;

let _next_available_id = _FIRST_INTERNAL_ID;

export function generate_new_id() {
  _next_available_id += 1;
  return _next_available_id;
}

export function next_available_id() {
  return -1;
}

export function is_internal_id(value) {
  return value >= _FIRST_INTERNAL_ID;
}

export { registerEnumeration };
export const verbose = false;

export { registerBasicType,
  registerBuiltInType,
  unregisterType,
  findSimpleType,
  findBuiltInType,
  constructObject,
  getFactory };


