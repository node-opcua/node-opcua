"use strict";
/**
 * @module opcua.variant
 */
exports.Variant = require("./src/variant").Variant;
exports.DataType = require("./src/variant").DataType;
exports.VariantArrayType = require("./src/variant").VariantArrayType;
exports.sameVariant = require("./src/variant_tools").sameVariant;
exports.buildVariantArray = require("./src/variant_tools").buildVariantArray;
exports.coerceVariantType = require("./src/variant_tools").coerceVariantType;
exports.isValidVariant = require("./src/variant_tools").isValidVariant;
