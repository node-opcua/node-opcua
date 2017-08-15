"use strict";
/**
 * @module services.read
 */
//--------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//--------------------------------------------------------------------------------


/**
 * @class TimestampsToReturn
 */
exports.TimestampsToReturn = require("node-opcua-data-value").TimestampsToReturn;
/**
 * @class AttributeIds
 */
exports.AttributeIds = require("node-opcua-data-model").AttributeIds;
/**
 * @class AttributeNameById
 */
exports.AttributeNameById = require("node-opcua-data-model").AttributeNameById;
/**
 * @class ReadValueId
 */
exports.ReadValueId  = require("./_generated_/_auto_generated_ReadValueId").ReadValueId;
/**
 * @class ReadRequest
 */
exports.ReadRequest  = require("./_generated_/_auto_generated_ReadRequest").ReadRequest;
/**
 * @class ReadResponse
 */
exports.ReadResponse  = require("./_generated_/_auto_generated_ReadResponse").ReadResponse;


