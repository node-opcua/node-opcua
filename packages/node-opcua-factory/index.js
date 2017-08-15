
exports.generate_new_id = require("./src/factories_id_generator").generate_new_id;
exports.next_available_id = require("./src/factories_id_generator").next_available_id;
exports.is_internal_id  = require("./src/factories_id_generator").is_internal_id;

exports.registerEnumeration = require("./src/factories_enumerations").registerEnumeration;
exports.hasEnumeration = require("./src/factories_enumerations").hasEnumeration;
exports.getEnumeration = require("./src/factories_enumerations").getEnumeration;

exports.registerBasicType = require("./src/factories_basic_type").registerBasicType;

exports.findSimpleType = require("./src/factories_builtin_types").findSimpleType;
exports.findBuiltInType  = require("./src/factories_builtin_types").findBuiltInType;
exports.registerBuiltInType = require("./src/factories_builtin_types").registerType;

exports.registerSpecialVariantEncoder = require("./src/factories_builtin_types_special").registerSpecialVariantEncoder;


exports.hasConstructor = require("./src/factories_factories").hasConstructor;
exports.getConstructor = require("./src/factories_factories").getConstructor;
exports.constructObject = require("./src/factories_factories").constructObject;

