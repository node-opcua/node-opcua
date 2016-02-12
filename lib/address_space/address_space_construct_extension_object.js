"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");

var NodeId = require("lib/datamodel/nodeid").NodeId;
var UADataType = require("lib/address_space/ua_data_type").UADataType;



exports.install = function (AddressSpace) {

    var makeStructure = require("lib/address_space/convert_nodeset_to_types").makeStructure;
    /**
     * @method constructExtensionObject
     * @param dataType {UADataType}
     * @param [options {Object} =null]
     * @return {Object}
     *
     *
     * @example
     *
     *             // example 1
     *             var extObj = addressSpace.constructExtentionObject("BuildInfo",{ productName: "PRODUCTNAME"});
     *
     *             // example 2
     *             serverStatusDataType.should.be.instanceOf(UADataType);
     *             serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");
     *             var serverStatus  = addressSpace.constructExtensionObject(serverStatusDataType);
     *             serverStatus.constructor.name.should.eql("ServerStatus");
     */
    AddressSpace.prototype.constructExtensionObject = function(dataType,options){

        if (dataType instanceof NodeId) {
            dataType = this.findNode(dataType);
        }
        assert(dataType instanceof UADataType);

        if (!dataType._extensionObjectConstructor) {
            dataType._extensionObjectConstructor = makeStructure(dataType);
            if (!dataType._extensionObjectConstructor ) {
                console.log("AddressSpace#constructExtensionObject : cannot make structure for " + dataType.toString());
            }
        }

        var Constructor =  dataType._extensionObjectConstructor;
        return new Constructor(options);
    };
};
