/* istanbul ignore next */

/**
 * @module opcua.miscellaneous
 */
import assert from "better-assert";
import fs from "fs";
import path from "path";
import { 
  extract_all_fields,
  resolve_schema_field_types,
  check_schema_correctness
} from "lib/misc/factories_schema_helpers";
import { getFactory } from "lib/misc/factories_factories";
import _ from "underscore";
import { ObjectIds as objectNodeIds } from "lib/opcua_node_ids";
import * as ec from "lib/misc/encode_decode";
import { 
  make_debugLog,
  getTempFilename,
  normalize_require_file,
  capitalizeFirstLetter
} from "lib/misc/utils";

import dirName from './dirName';

import { LineFile } from "lib/misc/linefile";

const debugLog = make_debugLog(__filename);


const folder_for_generated_file = // "_generated_";
  path.normalize(getTempFilename("../_generated_"));

if (fs.existsSync && !fs.existsSync(folder_for_generated_file)) {
  fs.mkdirSync(folder_for_generated_file);
}

function require_class(schema_name, optional_folder = '_generated_') {
  // have to think about this - see webpack dynamic requires..
  if (optional_folder === '_generated_') {
    return require(`../../_generated_/_auto_generated_${schema_name}.js`);
  }
  if (optional_folder === 'tmp') {
    return require(`../../tmp/_auto_generated_${schema_name}.js`);
  }
  // return require(`../../${optional_folder}/_auto_generated_${schema_name}.js`);
}

function get_class_javascript_filename(schema_name, optional_folder) {
  let folder = folder_for_generated_file;
  if (optional_folder || optional_folder === "") {
    folder = path.normalize(path.join(process.cwd(), optional_folder));
  }
  return path.join(folder, `_auto_generated_${schema_name}.js`);
}

function get_class_javascript_filename_local(schema_name) {
  let generate_source = getFactory(schema_name).prototype._schema.generate_source;
  if (!generate_source) {
    const folder = folder_for_generated_file;
    generate_source = path.join(folder, `_auto_generated_${schema_name}.js`);
  }
  return generate_source;
}

const RUNTIME_GENERATED_ID = -1;


function write_enumeration_setter(f, schema, field, member, i) {
  assert(f instanceof LineFile);
  function write(...args) {
    f.write(...args);
  }
  const className = schema.name;
  const capMember = capitalizeFirstLetter(member);
  write(`${className}.prototype.set${capMember} = function(value) {`);
  write(`   var coercedValue = _enumerations.${field.fieldType}.typedEnum.get(value);`);
  write("   /* istanbul ignore next */");
  write("   if (coercedValue === undefined || coercedValue === null) {");
  write(`      throw new Error("value cannot be coerced to ${field.fieldType}: " + value);`);
  write("   }");
  write(`   this.${member} = coercedValue;`);
  write("};");
}
function write_enumeration(f, schema, field, member, i) {
  assert(f instanceof LineFile);
  function write(...args) {
    f.write(...args);
  }

  // xx var __member = "$" + member;

  assert(!field.isArray); // would not work in this case

  const capMember = capitalizeFirstLetter(member);
  write(`    self.set${capMember}(initialize_field(schema.fields[${i}], options.${field.name}));`);
}

function write_complex(f, schema, field, member/* , i*/) {
  assert(f instanceof LineFile);
  function write(...args) {
    f.write(...args);
  }

  if (field.isArray) {
    if (field.hasOwnProperty("defaultValue")) {
      // todo: fix me => should call field defaultValue in the live version
      write(`    self.${member} = null;`);
    } else {
      write(`    self.${member} = [];`);
    }
    write(`    if (options.${member}) {`);
    write(`        assert(_.isArray(options.${member}));`);
    write(`        self.${member} = options.${member}.map(function(e){ return new ${field.fieldType}(e); } );`);
    write("    }");
  } else if (field.defaultValue === null || field.fieldType === schema.name) {
    write(`    self.${member} = (options.${member}) ? new ${field.fieldType}( options.${member}) : null;`);
  } else {
    write(`    self.${member} =  new ${field.fieldType}( options.${member});`);
  }
}

function write_basic(f, schema, field, member, i) {
  assert(f instanceof LineFile);
  function write(...args) {
    f.write(...args);
  }

  assert(field.category === "basic");

  if (field.isArray) {
    write(`    self.${member} = initialize_field_array(schema.fields[${i}], options.${field.name});`);
  } else {
    write(`    self.${member} = initialize_field(schema.fields[${i}], options.${field.name});`);
  }
}


/* eslint complexity:[0,50],  max-statements: [1, 250]*/
function produce_code(schema_file, schema_name, source_file) {
  let is_complex_type;
  let i;
  let field;
  let fieldType;
  let member;
  let __member;


  const full_path_to_schema = path.resolve(schema_file).replace(/\\/g, "/");

  debugLog("\nfull_path_to_schema    ".red, full_path_to_schema);

  const relative_path_to_schema = normalize_require_file(`${dirName}/lib/misc`, full_path_to_schema);
  debugLog("relative_path_to_schema".red, relative_path_to_schema);

  const local_schema_file = normalize_require_file(path.dirname(source_file), full_path_to_schema);
  debugLog("local_schema_file      ".red, local_schema_file);
  // const s = require(relative_path_to_schema)
  const truncatedForWebpack = relative_path_to_schema.replace('_schema', ''); 
  const schema = require(`${truncatedForWebpack}_schema.js`)[schema_name];

  check_schema_correctness(schema);

  if (!schema) {
    throw new Error(` Cannot find schema ${schema_name} in ${relative_path_to_schema}`);
  }
  const name = schema.name;

  // check the id of the object binary encoding
  let encoding_BinaryId = schema.id;
  let encoding_XmlId;
  if (encoding_BinaryId === undefined) {
    encoding_BinaryId = objectNodeIds[`${name}_Encoding_DefaultBinary`];
    encoding_XmlId = objectNodeIds[`${name}_Encoding_DefaultXml`];
  } else {
    // xx debugLog(schema_file,schema.name, id);
    // xx  assert(id === RUNTIME_GENERATED_ID);
  }
  if (!encoding_BinaryId) {
    throw new Error(`${name} has no _Encoding_DefaultBinary id\nplease add a Id field in the structure definition`);
  }


  const encodingBinaryNodeId = (encoding_BinaryId === RUNTIME_GENERATED_ID) ? encoding_BinaryId : ec.makeExpandedNodeId(encoding_BinaryId);
  const encodingXmlNodeId = (encoding_XmlId) ? ec.makeExpandedNodeId(encoding_XmlId) : null;


  schema.baseType = schema.baseType || "BaseUAObject";

  const baseclass = schema.baseType;


  const classname = schema.name;


  const f = new LineFile();

  function write(...args) {
    f.write(...args);
  }

  resolve_schema_field_types(schema);
  const complexTypes = schema.fields.filter(field => field.category === "complex" && field.fieldType !== schema.name);

  const folder_for_source_file = path.dirname(source_file);

  // -------------------------------------------------------------------------
  // - insert common require's
  // -------------------------------------------------------------------------
  write("\"use strict\";");
  write("require(\"requirish\")._(module);");
  write("/**");
  write(" * @module opcua.address_space.types");
  write(" */");
  write("var assert = require(\"better-assert\");");
  write("var util = require(\"util\");");
  write("var _  = require(\"underscore\");");
  write("var makeNodeId = require(\"lib/datamodel/nodeid\").makeNodeId;");
  write("import {");
  write("  doDebug,");
  write("  extract_all_fields,");
  write("  resolve_schema_field_types,");
  write("  initialize_field,");
  write("  initialize_field_array,");
  write("  check_options_correctness_against_schema");
  write("} from \"lib/misc/factories_schema_helpers\";");

  write("var _defaultTypeMap = require(\"lib/misc/factories_builtin_types\")._defaultTypeMap;");

  write("var ec = require(\"lib/misc/encode_decode\");");
  write("var encodeArray = ec.encodeArray;");
  write("var decodeArray = ec.decodeArray;");
  write("var makeExpandedNodeId = ec.makeExpandedNodeId;");

  write("var generate_new_id = require(\"lib/misc/factories\").generate_new_id;");
  write("var _enumerations = require(\"lib/misc/factories_enumerations\")._private._enumerations;");

  // -------------------------------------------------------------------------
  // - insert schema
  // -------------------------------------------------------------------------

  write(`var schema = require("${local_schema_file}").${classname}_Schema;`);

  // -------------------------------------------------------------------------
  // - insert definition of complex type used by this class
  // -------------------------------------------------------------------------

  const tmp_map = {};
  complexTypes.forEach((field) => {
    const filename = get_class_javascript_filename_local(field.fieldType);
    if (tmp_map.hasOwnProperty(filename)) {
      return;
    }
    tmp_map[filename] = 1;

    const local_filename = normalize_require_file(folder_for_source_file, filename);
    write('// complex type');
    write(`var ${field.fieldType} = require("${local_filename}").${field.fieldType};`);
  });

  // -------------------------------------------------------------------------
  // - insert definition of base class
  // -------------------------------------------------------------------------
  write("var BaseUAObject = require(\"lib/misc/factories_baseobject\").BaseUAObject;");
  if (baseclass !== "BaseUAObject") {
    const filename = get_class_javascript_filename_local(baseclass);

    const local_filename = normalize_require_file(folder_for_source_file, filename);
    write('// base class');
    
    write(`var ${baseclass} = require("${local_filename}").${baseclass};`);
  }

  function makeFieldType(field) {
    return `{${field.fieldType}${field.isArray ? "[" : ""}${field.isArray ? "]" : ""}}`;
  }

  // -------------------------------------------------------------------------
  // - insert class enumeration properties
  // -------------------------------------------------------------------------
  let has_enumeration = false;
  let n = schema.fields.length;
  for (i = 0; i < n; i++) {
    if (schema.fields[i].category === "enumeration") {
      has_enumeration = true;
      break;
    }
  }


  // -------------------------------------------------------------------------
  // - insert class constructor
  // -------------------------------------------------------------------------

  write("");
  write("/**");
  if (schema.documentation) {
    write(` * ${schema.documentation}`);
  }
  write(" * ");
  write(` * @class ${classname}`);
  write(" * @constructor");
  write(` * @extends ${baseclass}`);
  // dump parameters

  write(" * @param  options {Object}");
  let def = "";
  for (i = 0; i < n; i++) {
    field = schema.fields[i];
    fieldType = field.fieldType;
    var documentation = field.documentation ? field.documentation : "";
    def = "";
    if (field.defaultValue !== undefined) {
      if (_.isFunction(field.defaultValue)) {
        def = ` = ${field.defaultValue()}`;
      } else {
        def = ` = ${field.defaultValue}`;
      }
    }
    const ft = makeFieldType(field);
    write(` * @param  [options.${field.name}${def}] ${ft} ${documentation}`);
  }

  write(" */");

  write(`function ${classname}(options)`);
  write("{");
  // write("    var value;");
  write("    options = options || {};");
  write("    /* istanbul ignore next */");
  write("    if (doDebug()) { check_options_correctness_against_schema(this,schema,options); }");
  write("    var self = this;");
  write("    assert(this instanceof BaseUAObject); //  ' keyword \"new\" is required for constructor call')");
  write("    resolve_schema_field_types(schema);");
  write("");

  if (_.isFunction(schema.construct_hook)) {
    write("    //construction hook");
    write("    options = schema.construct_hook(options); ");
  }
  if (baseclass) {
    write(`    ${baseclass}.call(this,options);`);
  }

  for (i = 0; i < n; i++) {
    field = schema.fields[i];

    fieldType = field.fieldType;

    member = field.name;
    __member = `__${member}`;

    write("");
    write("    /**");
    documentation = field.documentation ? field.documentation : "";
    write("      * ", documentation);
    write("      * @property ", field.name);
    // write("      * @type {", (field.isArray ? "Array[" : "") + field.fieldType + (field.isArray ? " ]" : "")+"}");
    write(`      * @type ${makeFieldType(field)}`);

    if (field.defaultValue !== undefined) {
      write("      * @default  ", field.defaultValue);
    }

    write("      */");


    if (field.category === "enumeration") {
      write_enumeration(f, schema, field, member, i);
    } else if (field.category === "complex") {
      write_complex(f, schema, field, member, i);
    } else {
      write_basic(f, schema, field, member, i);
    }
  }

  write("");
  write("   // Object.preventExtensions(self);");
  write("}");


  // -------------------------------------------------------------------------
  // - inheritance chain
  // -------------------------------------------------------------------------


  write(`util.inherits(${classname},${baseclass});`);


  // -------------------------------------------------------------------------
  // - Enumeration
  // -------------------------------------------------------------------------
  if (has_enumeration) {
    write("");
    write("//## Define Enumeration setters");

    for (i = 0; i < n; i++) {
      field = schema.fields[i];
      member = field.name;
      if (field.category === "enumeration") {
        write_enumeration_setter(f, schema, field, member, i);
      }
    }
  }


  // -------------------------------------------------------------------------
  // - encodingDefaultBinary
  // -------------------------------------------------------------------------

  if (RUNTIME_GENERATED_ID === encodingBinaryNodeId) {
    write("schema.id = generate_new_id();");
    write(`${classname}.prototype.encodingDefaultBinary = makeExpandedNodeId(schema.id);`);
  } else {
    write(`${classname}.prototype.encodingDefaultBinary = makeExpandedNodeId(${encodingBinaryNodeId.value},`, encodingBinaryNodeId.namespace, ");");
  }


  if (encodingXmlNodeId) {
    write(`${classname}.prototype.encodingDefaultXml = makeExpandedNodeId(${encodingXmlNodeId.value},`, encodingXmlNodeId.namespace, ");");
  }
  write(`${classname}.prototype._schema = schema;`);

  //  --------------------------------------------------------------
  //   expose encoder and decoder func for basic type that we need
  //  --------------------------------------------------------------
  write("");
  n = schema.fields.length;
  const done = {};
  for (i = 0; i < n; i++) {
    field = schema.fields[i];
    fieldType = field.fieldType;
    if (!(fieldType in done)) {
      done[fieldType] = field;
      if (field.category === "enumeration") {
        write(`var encode_${field.fieldType} = _enumerations.${field.fieldType}.encode;`);
        write(`var decode_${field.fieldType} = _enumerations.${field.fieldType}.decode;`);
      } else if (field.category === "complex") {
        //
      } else {
        write(`var encode_${field.fieldType} = _defaultTypeMap.${field.fieldType}.encode;`);
        write(`var decode_${field.fieldType} = _defaultTypeMap.${field.fieldType}.decode;`);
      }
    }
  }

  //  --------------------------------------------------------------
  //   implement encode
  //  ---------------------------------------------------------------
  if (_.isFunction(schema.encode)) {
    write(`${classname}.prototype.encode = function(stream,options) {`);
    write("   schema.encode(this,stream,options); ");
    write("};");
  } else {
    write("/**");
    write(" * encode the object into a binary stream");
    write(" * @method encode");
    write(" *");
    write(" * @param stream {BinaryStream} ");
    write(" */");

    write(`${classname}.prototype.encode = function(stream,options) {`);
    write("    // call base class implementation first");
    write(`    ${baseclass}.prototype.encode.call(this,stream,options);`);

    n = schema.fields.length;
    for (i = 0; i < n; i++) {
      field = schema.fields[i];
      fieldType = field.fieldType;
      member = field.name;

      if (field.category === "enumeration" || field.category === "basic") {
        if (field.isArray) {
          write(`    encodeArray(this.${member}, stream, encode_${field.fieldType});`);
        } else {
          write(`    encode_${field.fieldType}(this.${member},stream);`);
        }
      } else if (field.category === "complex") {
        if (field.isArray) {
          write(`    encodeArray(this.${member},stream,function(obj,stream){ obj.encode(stream,options); }); `);
        } else {
          write(`   this.${member}.encode(stream,options);`);
        }
      }
    }
    write("};");
  }

  //  --------------------------------------------------------------
  //   implement decode
  //  ---------------------------------------------------------------
  if (_.isFunction(schema.decode)) {
    write("/**");
    write(" * decode the object from a binary stream");
    write(" * @method decode");
    write(" *");
    write(" * @param stream {BinaryStream} ");
    write(" * @param [option] {object} ");
    write(" */");

    write(`${classname}.prototype.decode = function(stream,options) {`);
    write("   schema.decode(this,stream,options); ");
    write("};");

    if (!_.isFunction(schema.decode_debug)) {
      throw new Error(`schema decode requires also to provide a decode_debug ${schema.name}`);
    }
    write(`${classname}.prototype.decode_debug = function(stream,options) {`);
    write("   schema.decode_debug(this,stream,options); ");
    write("};");
  } else {
    write("/**");
    write(" * decode the object from a binary stream");
    write(" * @method decode");
    write(" *");
    write(" * @param stream {BinaryStream} ");
    write(" * @param [option] {object} ");
    write(" */");
    write(`${classname}.prototype.decode = function(stream,options) {`);
    write("    // call base class implementation first");
    write(`    ${baseclass}.prototype.decode.call(this,stream,options);`);

    n = schema.fields.length;
    for (i = 0; i < n; i++) {
      field = schema.fields[i];
      fieldType = field.fieldType;
      member = field.name;
      if (field.category === "enumeration" || field.category === "basic") {
        if (field.isArray) {
          write(`    this.${member} = decodeArray(stream, decode_${field.fieldType});`);
        } else if (is_complex_type) {
          write(`    this.${member}.decode(stream,options);`);
        } else if (_.isFunction(field.decode)) {
          write(`    this.${member} = schema.fields[${i}].decode(stream,options);`);
        } else {
          write(`    this.${member} = decode_${field.fieldType}(stream,options);`);
        }
      } else {
        assert(field.category === "complex");
        if (field.isArray) {
          write(`    this.${member} = decodeArray(stream, function(stream) { `);
          write(`       var obj = new ${field.fieldType}();`);
          write("       obj.decode(stream,options);");
          write("       return obj; ");
          write("    });");
        } else {
          write(`    this.${member}.decode(stream,options);`);
          // xx write("    this." + member + ".decode(stream,options);");
        }
      }
    }
    write("};");
  }

  //  --------------------------------------------------------------
  //   implement explore
  //  ---------------------------------------------------------------
  //    write("/**");
  //    write(" *");
  //    write(" * pretty print the object");
  //    write(" * @method explore");
  //    write(" *");
  //    write(" */");
  //    write(classname + ".prototype.explore = function() {");
  //    write("};");

  // ---------------------------------------
  if (_.isFunction(schema.isValid)) {
    write("/**");
    write(" *");
    write(" * verify that all object attributes values are valid according to schema");
    write(" * @method isValid");
    write(" * @return {Boolean}");
    write(" */");
    write(`${classname}.prototype.isValid = function() { return schema.isValid(this); };`);
  }


  function quotify(str) {
    return `"${str}"`;
  }

  const possible_fields = extract_all_fields(schema);

  write(`${classname}.possibleFields = [`);
  write(`  ${possible_fields.map(quotify).join(",\n         ")}`);
  write("];");
  write("\n");


  write(`exports.${classname} = ${classname};`);
  write("var register_class_definition = require(\"lib/misc/factories_factories\").register_class_definition;");
  write(`register_class_definition("${classname}",${classname});`);
  write("");

  f.save(source_file);
}

export { 
  produce_code,
  folder_for_generated_file,
  get_class_javascript_filename,
  require_class };
