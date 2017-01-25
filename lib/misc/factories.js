/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

import assert from "better-assert";


import { produce_code } from "lib/misc/factory_code_generator";
import { get_class_javascript_filename, require_class } from "lib/misc/factory_code_generator";
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
import dirName from './dirName';


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
    const schema_name = schema.split("|")[1];
    const schema_root = schema.split("|")[0];
    schema_file = path.join(dirName, `${schema_root}/${schema_name}_schema.js`);
    const s = require(`../../${schema_root}/${schema_name}_schema.js`);
    schema = s[`${schema_name}_Schema`];
  } else {
    const err = new Error();
    const re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    schema_file = re.exec(err.stack.split("\n")[2])[1];
  }
  assert(schema.generate_source === undefined);
  const javascriptFilename = get_class_javascript_filename(schema.name, optional_folder);
  const generated_source = path.resolve(path.join(javascriptFilename));
  schema.generate_source = generated_source;
  const local_generated_source = normalize_require_file(dirName, generated_source);
  return require_class(schema.name, optional_folder)[schema.name];
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
  getFactory
 };

