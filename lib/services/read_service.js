"use strict";
/**
 * @module services.read
 */
//--------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//--------------------------------------------------------------------------------

require("requirish")._(module);
/**
 * @class TimestampsToReturn
 */
exports.TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;
/**
 * @class AttributeIds
 */
exports.AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
/**
 * @class AttributeNameById
 */
exports.AttributeNameById = require("lib/datamodel/attributeIds").AttributeNameById;
/**
 * @class ReadValueId
 */
exports.ReadValueId = require("_generated_/_auto_generated_ReadValueId").ReadValueId;
/**
 * @class ReadRequest
 */
exports.ReadRequest = require("_generated_/_auto_generated_ReadRequest").ReadRequest;
/**
 * @class ReadResponse
 */
exports.ReadResponse = require("_generated_/_auto_generated_ReadResponse").ReadResponse;


