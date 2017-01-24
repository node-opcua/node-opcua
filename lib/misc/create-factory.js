/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */

import assert from "better-assert";


import { produce_code } from "lib/misc/factory_code_generator";
import { get_class_javascript_filename, require_class } from "lib/misc/factory_code_generator";

import { make_debugLog, checkDebugFlag } from "lib/misc/utils";

import fs from "fs";

import path from "path";
import { normalize_require_file } from "lib/misc/utils";


import { registerType as registerBuiltInType } from "lib/misc/factories_builtin_types";

import dirName from './dirName';

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
/**
 * create a new object type from a schema
 * @method registerObject
 * @param schema
 * @param optional_folder {String}
 */
function createObject(schema, optional_folder, postFix) {
  console.log('creating', { schema, optional_folder, postFix });
  const myDir = `${dirName}/lib/misc`;
  let createdSchema, 
    schema_file, 
    schema_name;
  if (typeof schema === "string") {
    const hint_schema = schema.split("|");
    if (hint_schema.length === 1) {
      hint_schema.unshift("schemas");
    }
    const folder_hint = path.join("../..", hint_schema[0]);
    const mySchema = hint_schema[1];
    schema_name = `${mySchema}_Schema`;
    //
    schema_file = path.normalize(path.join(myDir, folder_hint, `${mySchema}_schema.js`));
    const local_schema_file = normalize_require_file('../../', schema_file);
    createdSchema = require(schema_file)[schema_name];
  } else {
    const err = new Error();
    const re = /.*\((.*):[0-9]*:[0-9]*\)/g;
    schema_file = re.exec(err.stack.split("\n")[2])[1];
    if (postFix) {
      schema_file = schema_file.replace(".js", `${postFix}.js`);
    }
    if (!optional_folder) {
      console.log(" MIGRATED OLD SCHEME FILE ".red, schema, schema_file);
    }
    createdSchema = schema;
  }

  assert(createdSchema.generate_source === undefined);

  schema_name = `${createdSchema.name}_Schema`;

  const generated_source = get_class_javascript_filename(createdSchema.name, optional_folder || "_generated_");

  produce_code(schema_file, schema_name, generated_source);
  require(generated_source)[createdSchema.name];
}


export default createObject;

