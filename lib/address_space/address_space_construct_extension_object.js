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
var eoan = require("./extension_object_array_node");


exports.install = function (AddressSpace) {

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
     *             var extObj = addressSpace.constructExtensionObject("BuildInfo",{ productName: "PRODUCTNAME"});
     *
     *             // example 2
     *             serverStatusDataType.should.be.instanceOf(UADataType);
     *             serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");
     *             var serverStatus  = addressSpace.constructExtensionObject(serverStatusDataType);
     *             serverStatus.constructor.name.should.eql("ServerStatus");
     */
    AddressSpace.prototype.constructExtensionObject = function(dataType,options){

        assert(dataType,"expecting a dataType");
        if (dataType instanceof NodeId) {
            var tmp = this.findNode(dataType);
            if (!tmp) {
                throw new Error("constructExtensionObject: cannot resolve dataType " + dataType);
            }
            dataType = tmp;
        }
        if (!(dataType instanceof UADataType)) {
            throw new Error("constructExtensionObject: dataType has unexpectedtype" + dataType);
        }

        eoan.prepareDataType(dataType);

        var Constructor =  dataType._extensionObjectConstructor;
        return new Constructor(options);
    };
};
