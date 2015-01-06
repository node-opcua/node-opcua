"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);
var assert = require("better-assert");
var fs = require("fs");
var path = require("path");

var schema_helpers =  require("lib/misc/factories_schema_helpers");
var getFactory = require("lib/misc/factories_factories").getFactory;

var extract_all_fields = schema_helpers.extract_all_fields;
var resolve_schema_field_types = schema_helpers.resolve_schema_field_types;
var check_schema_correctness = schema_helpers.check_schema_correctness;

var _ = require("underscore");

var factories = require("lib/misc/factories");

var objectNodeIds = require("lib/opcua_node_ids").ObjectIds;

var ec = require("lib/misc/encode_decode");

var BaseUAObject = require("lib/misc/factories_baseobject").BaseUAObject;


var utils = require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);
var getTempFilename = utils.getTempFilename;
var normalize_require_file = utils.normalize_require_file;



exports.folder_for_generated_file =path.normalize(getTempFilename("../_generated_"));

if (!fs.existsSync(exports.folder_for_generated_file)) {
    fs.mkdirSync(exports.folder_for_generated_file);
}


function get_class_javascript_filename(schema_name,optional_folder) {

     var folder =exports.folder_for_generated_file;
     if (optional_folder) {
         folder = path.normalize(path.join(process.cwd(),optional_folder));
     }
    return path.join(folder,"_auto_generated_" + schema_name + ".js");
}

exports.get_class_javascript_filename = get_class_javascript_filename;


function get_class_javascript_filename_local(schema_name) {

    var generate_source = getFactory(schema_name).prototype._schema.generate_source;
    if (!generate_source) {
        var folder =exports.folder_for_generated_file;
        generate_source = path.join(folder,"_auto_generated_" + schema_name + ".js");
    }
    return generate_source;

}
var RUNTIME_GENERATED_ID = -1;



function produce_code(schema_file, schema_name, source_file) {

    var is_complex_type;
    var i, field, fieldType, member, __member;


    var full_path_to_schema = path.resolve(schema_file).replace(/\\/g, "/");

    debugLog("\nfull_path_to_schema    ".red, full_path_to_schema);

    var relative_path_to_schema = normalize_require_file(__dirname, full_path_to_schema);
    debugLog("relative_path_to_schema".red, relative_path_to_schema);

    var local_schema_file =normalize_require_file(path.dirname(source_file),full_path_to_schema);
    debugLog("local_schema_file      ".red, local_schema_file);

    var schema = require(relative_path_to_schema)[schema_name];

    check_schema_correctness(schema);

    if (!schema) {
        throw new Error(" Cannot find schema " + schema_name + " in " + relative_path_to_schema);
    }
    var name = schema.name;

    // check the unique id of the object
    var id = schema.id;
    if (id === undefined) {
        var encode_name = name + "_Encoding_DefaultBinary";
        id = objectNodeIds[encode_name];
    } else {
        //xx debugLog(schema_file,schema.name, id);
        //xx  assert(id === RUNTIME_GENERATED_ID);
    }
    assert(id, "" + name + " has no _Encoding_DefaultBinary id\nplease add a Id field in the structure definition");

    var expandedNodeId = (id === RUNTIME_GENERATED_ID ) ? id : ec.makeExpandedNodeId(id);


    schema.baseType = schema.baseType || "BaseUAObject";

    var baseclass = schema.baseType;


    var classname = schema.name;


    var __line = [];

    function write() {
        var str = "";
        for (var i = 0; i < arguments.length; i++) {
            str += arguments[i];
        }
        __line.push(str);
    }


    resolve_schema_field_types(schema);
    var complexTypes = schema.fields.filter(function (field) {
        return field.category === "complex" && field.fieldType !== schema.name;
    });

    var folder_for_source_file = path.dirname(source_file);

// -------------------------------------------------------------------------
// - insert common require's
// -------------------------------------------------------------------------
    write("// --------- This code has been automatically generated !!!");

    write("/**");
    write(" * @module opcua.address_space.types");
    write(" */");

    write("var assert = require(\"better-assert\");");
    write("var util = require(\"util\");");
    write("var _  = require(\"underscore\");");
    write("var makeNodeId = require(\"../lib/datamodel/nodeid\").makeNodeId;");
    write("var schema_helpers =  require(\"../lib/misc/factories_schema_helpers\");");

    write("var extract_all_fields                       = schema_helpers.extract_all_fields;");
    write("var resolve_schema_field_types               = schema_helpers.resolve_schema_field_types;");
    write("var initialize_field                         = schema_helpers.initialize_field;");
    write("var initialize_field_array                   = schema_helpers.initialize_field_array;");
    write("var check_options_correctness_against_schema = schema_helpers.check_options_correctness_against_schema;");
    write("var _defaultTypeMap = require(\"../lib/misc/factories_builtin_types\")._defaultTypeMap;");

    write("var ec= require(\"../lib/misc/encode_decode\");");
    write("var encodeArray= ec.encodeArray;");
    write("var decodeArray= ec.decodeArray;");
    write("var makeExpandedNodeId= ec.makeExpandedNodeId;");

    write("var generate_new_id = require(\"../lib/misc/factories\").generate_new_id;");
    write("var _enumerations = require(\"../lib/misc/factories_enumerations\")._private._enumerations;");

// -------------------------------------------------------------------------
// - insert schema
// -------------------------------------------------------------------------

    write("var schema = require(\"" + local_schema_file + "\")." + classname + "_Schema;");

// -------------------------------------------------------------------------
// - insert definition of complex type used by this class
// -------------------------------------------------------------------------

    complexTypes.forEach(function (field) {
        var filename = get_class_javascript_filename_local(field.fieldType);
        var local_filename = normalize_require_file(folder_for_source_file,filename);
        write("var " + field.fieldType + "= require(\"" + local_filename + "\")." + field.fieldType + ";");
    });

// -------------------------------------------------------------------------
// - insert definition of base class
// -------------------------------------------------------------------------
    write("var BaseUAObject = require(\"../lib/misc/factories_baseobject\").BaseUAObject;");
    if (baseclass !== "BaseUAObject") {
        var filename = get_class_javascript_filename_local(baseclass);

        var local_filename = normalize_require_file(folder_for_source_file,filename);

        write("var " + baseclass + "= require(\"" + local_filename + "\")." + baseclass + ";");
    }


// -------------------------------------------------------------------------
// - insert class constructor
// -------------------------------------------------------------------------

    write("");
    write("/**");
    if (schema.documentation) {
        write(" * " + schema.documentation);
    }
    write(" * @class " + classname);
    write(" * @constructor");
    write(" * @extends " + baseclass);
    write(" */");

    write("function " + classname + "(options)");
    write("{");
    // write("    var value;");
    write("    options = options || {};");
    write("    check_options_correctness_against_schema(this,schema,options);");
    write("    var self = this;");
    write("    assert(this instanceof BaseUAObject); //  ' keyword \"new\" is required for constructor call')");
    write("    resolve_schema_field_types(schema);");
    write("");

    if (_.isFunction(schema.construct_hook)) {
        write("    //construction hook");
        write("    options = schema.construct_hook(options); ");

    }
    if (baseclass) {
        write("    " + baseclass + ".call(this,options);");
    }
    var n = schema.fields.length;
    for (i = 0; i < n; i++) {

        field = schema.fields[i];
        fieldType = field.fieldType;
        member = field.name;
        __member = "__" + member;

        var field_source = "_defaultTypeMap";
        write("");
        write("    /**");
        if (field.documentation) {
            write("      * ",field.documentation);
        }
        write("      * @property ", field.name);
        // write("      * @type {", (field.isArray ? "Array[" : "") + field.fieldType + (field.isArray ? " ]" : "")+"}");
        write("      * @type {",field.fieldType + (field.isArray ? "[" : "") +  (field.isArray ? "]" : "")+"}");

        if (field.defaultValue !== undefined) {
            write("      * @default  ", field.defaultValue);
        }

        write("      */");
        if (field.category === "enumeration") {

            field_source = "_enumerations";

            assert(!field.isArray); // would not work in this case

            write("    //## Define special behavior for Enumeration");
            write("    Object.defineProperties(this,{");
            write("        \"" + member + "\": {");
            write("            hidden: false,");
            write("            enumerable: true,");
            write("            configurable: true,");
            write("                get: function () {");
            write("                    return this." + __member + ";");
            write("                },");
            write("                set: function (value) {");
            write("                    var coercedValue = _enumerations." + field.fieldType + ".typedEnum.get(value);");
            write("                    if ( coercedValue === undefined || coercedValue === null) {");
            write("                          throw new Error(\"value cannot be coerced to " + field.fieldType + ": \" + value);");
            write("                    }");
            write("                    this." + __member + " = coercedValue;");
            write("                }");
            write("        },");
            write("        \"" + __member + "\": {");
            write("             hidden: true,");
            write("             writable: true,");
            write("             enumerable: false");
            write("        }");
            write("    });");
            write("    self." + member + " = initialize_field(schema.fields[" + i + "]" + ", options." + field.name + ");");

        } else if (field.category === "complex") {

            if (field.isArray) {
                write("    self." + member + " = [];");
                write("    if(options." + member + ") {");
                write("        assert(_.isArray(options." + member + "));");
                write("        self." + member + " = options." + member + ".map(function(e){ return new " + field.fieldType + "(e);});");
                write("    }");
            } else {
                if (field.defaultValue === null || field.fieldType === schema.name ) {
                    write("    self." + member + " = (options." + member + ") ? new " + field.fieldType + "( options." + member + ') : null;');
                } else {
                    write("    self." + member + " =  new " + field.fieldType + "( options." + member + ');');

                }
            }

        } else {
            assert(field.category === "basic");

            if (field.isArray) {
                write("    self." + member + " = initialize_field_array(schema.fields[" + i + "]" + ", options." + field.name + ");");
            } else {
                write("    self." + member + " = initialize_field(schema.fields[" + i + "]" + ", options." + field.name + ");");
            }

        }
    }

    write("");
    write("   // Object.preventExtensions(self);");
    write("}");



// -------------------------------------------------------------------------
// - inheritance chain
// -------------------------------------------------------------------------


    write("util.inherits(" + classname + "," + baseclass + ");");


// -------------------------------------------------------------------------
// - encodingDefaultBinary
// -------------------------------------------------------------------------

    if (RUNTIME_GENERATED_ID === expandedNodeId) {

        write("schema.id = generate_new_id();");
        write(classname + ".prototype.encodingDefaultBinary =makeExpandedNodeId(schema.id);");
    } else {
        write(classname + ".prototype.encodingDefaultBinary =makeExpandedNodeId(" + expandedNodeId.value + ",", expandedNodeId.namespace, ");");
    }
    write(classname + ".prototype._schema = schema;");

//  --------------------------------------------------------------
//   expose encoder and decoder func for basic type that we need
//  --------------------------------------------------------------
    write("");
    n = schema.fields.length;
    var done = {};
    for (i = 0; i < n; i++) {
        field = schema.fields[i];
        fieldType = field.fieldType;
        if (!(fieldType in done)) {
            done[fieldType] = field;
            if (field.category === "enumeration") {
                write("var encode_" + field.fieldType + " = _enumerations." + field.fieldType + ".encode;");
                write("var decode_" + field.fieldType + " = _enumerations." + field.fieldType + ".decode;");
            } else if (field.category === "complex") {

            } else {
                write("var encode_" + field.fieldType + " = _defaultTypeMap." + field.fieldType + ".encode;");
                write("var decode_" + field.fieldType + " = _defaultTypeMap." + field.fieldType + ".decode;");
            }

        }
    }

//  --------------------------------------------------------------
//   implement encode
//  ---------------------------------------------------------------
    if (_.isFunction(schema.encode)) {

        write(classname + ".prototype.encode = function(stream) {");
        write("   schema.encode(this,stream); ");
        write("};");

    } else {

        write("/**");
        write(" * encode the object into a binary stream");
        write(" * @method encode");
        write(" *");
        write(" * @param stream {BinaryStream} ");
        write(" */");

        write(classname + ".prototype.encode = function(stream) {");
        write("    // call base class implementation first");
        write("    " + baseclass + ".prototype.encode.call(this,stream);");

        n = schema.fields.length;
        for (i = 0; i < n; i++) {
            field = schema.fields[i];
            fieldType = field.fieldType;
            member = field.name;

            if (field.category === "enumeration" || field.category === "basic") {

                if (field.isArray) {
                    write("    encodeArray(this." + member + ", stream, encode_" + field.fieldType + ");");
                } else {
                    write("    encode_" + field.fieldType + "(this." + member + ",stream);");
                }

            } else if (field.category === "complex") {

                if (field.isArray) {
                    write("    encodeArray(this." + member + ",stream,function(obj,stream){ obj.encode(stream); }); ");
                } else {
                    write("   this." + member + ".encode(stream);");
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
        write(" */");

        write(classname + ".prototype.decode = function(stream) {");
        write("   schema.decode(this,stream); ");
        write("};");

        if (!_.isFunction(schema.decode_debug)) {
            throw new Error("schema decode requires also to provide a decode_debug " + schema.name);
        }
        write(classname + ".prototype.decode_debug = function(stream,options) {");
        write("   schema.decode_debug(this,stream,options); ");
        write("};");

    } else {

        write(classname + ".prototype.decode = function(stream,options) {");
        write("    // call base class implementation first");
        write("    " + baseclass + ".prototype.decode.call(this,stream,options);");

        n = schema.fields.length;
        for (i = 0; i < n; i++) {
            field = schema.fields[i];
            fieldType = field.fieldType;
            member = field.name;
            if (field.category === "enumeration" || field.category === "basic") {

                if (field.isArray) {
                     write("    this." + member + " = decodeArray(stream, decode_" + field.fieldType + ");");
                } else {

                    if (is_complex_type) {
                        write("    this." + member + ".decode(stream,options);");
                    } else {
                        write("    this." + member + " = decode_" + field.fieldType + "(stream);");
                    }
                }
            } else {

                assert(field.category === "complex");
                if (field.isArray) {
                    write("    this." + member + " = decodeArray(stream, function(stream) { ");
                    write("       var obj = new " + field.fieldType + "();");
                    write("       obj.decode(stream);");
                    write("       return obj; ");
                    write("    });");
                } else {
                    write("    this." + member + ".decode(stream);");
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
    if (_.isFunction(schema.toString)) {
        write("// custom toString method");
        write(classname + ".prototype.toString = schema.toString;");
    }



    // ---------------------------------------
    if (_.isFunction(schema.isValid)) {
        write("/**");
        write(" *");
        write(" * verify that all object attributes values are valid according to schema");
        write(" * @method isValid");
        write(" * @return {Boolean}");
        write(" */");
        write(classname + ".prototype.isValid = function() { return schema.isValid(this); };");
    }


    var possible_fields = extract_all_fields(schema);

    write(classname + ".possibleFields = function() {");
    write("    return [");
    for (i = 0; i < possible_fields.length; i++) {
        write("      \"", possible_fields[i], "\",");
    }
    write("    ];");
    write("}();");
    write("\n");




    write("exports." + classname + " = " + classname + ";");
    write("var register_class_definition = require(\"../lib/misc/factories_factories\").register_class_definition;");
    write("register_class_definition(\"" + classname + "\"," + classname + ");");



    fs.writeFileSync(source_file, __line.join("\n"), "ascii");

}
exports.produce_code = produce_code;