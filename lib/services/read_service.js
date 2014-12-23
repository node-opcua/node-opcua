//--------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//--------------------------------------------------------------------------------
var factories = require("./../misc/factories");
var assert = require('better-assert');
var DataValue = require("./../datamodel/datavalue").DataValue;
var Variant   = require("./../datamodel/variant").Variant;
var _ = require("underscore");

require("./../datamodel/part_8_structures");

exports.TimestampsToReturn = require("../../schemas/TimestampsToReturn_enum").TimestampsToReturn;
exports.AttributeIds = require("../datamodel/attributeIds").AttributeIds;
exports.ReadValueId = require("../../_generated_/_auto_generated_ReadValueId").ReadValueId;
exports.ReadRequest = require("../../_generated_/_auto_generated_ReadRequest").ReadRequest;
exports.ReadResponse = require("../../_generated_/_auto_generated_ReadResponse").ReadResponse;


