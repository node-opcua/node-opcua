"use strict";
/**
 * @module services.register-server
 */

/**
 * @class RegisteredServer
 */
exports.RegisteredServer  = require("./_generated_/_auto_generated_RegisteredServer").RegisteredServer;
/**
 * @class RegisterServerRequest
 */
exports.RegisterServerRequest  = require("./_generated_/_auto_generated_RegisterServerRequest").RegisterServerRequest;
/**
 * @class RegisterServerResponse
 */
exports.RegisterServerResponse  = require("./_generated_/_auto_generated_RegisterServerResponse").RegisterServerResponse;

exports.MdnsDiscoveryConfiguration = require("./_generated_/_auto_generated_MdnsDiscoveryConfiguration").MdnsDiscoveryConfiguration;
/**
 * @class RegisterServerRequest
 */
exports.RegisterServer2Request  = require("./_generated_/_auto_generated_RegisterServer2Request").RegisterServer2Request;
/**
 * @class RegisterServerResponse
 */
exports.RegisterServer2Response  = require("./_generated_/_auto_generated_RegisterServer2Response").RegisterServer2Response;

// ----------------------------------------------------
// Discovery :  FindServers
// ----------------------------------------------------

/**
 * @class FindServersRequest
 */
exports.FindServersRequest  = require("./_generated_/_auto_generated_FindServersRequest").FindServersRequest;

/**
 * @class FindServersResponse
 */
exports.FindServersResponse  = require("./_generated_/_auto_generated_FindServersResponse").FindServersResponse;

exports.FindServersOnNetworkRequest  = require("./_generated_/_auto_generated_FindServersOnNetworkRequest").FindServersOnNetworkRequest;
exports.FindServersOnNetworkResponse  = require("./_generated_/_auto_generated_FindServersOnNetworkResponse").FindServersOnNetworkResponse;
exports.ServerOnNetwork = require("./_generated_/_auto_generated_ServerOnNetwork").ServerOnNetwork;

exports.serverCapapbilities = require("./src/server_capabilities").serverCapapbilities;


exports.acquireBonjour = require("./src/bonjour").acquireBonjour;
exports.releaseBonjour = require("./src/bonjour").releaseBonjour;
exports._stop_announcedOnMulticastSubnet = require("./src/bonjour")._stop_announcedOnMulticastSubnet;
exports._announcedOnMulticastSubnet = require("./src/bonjour")._announcedOnMulticastSubnet;
