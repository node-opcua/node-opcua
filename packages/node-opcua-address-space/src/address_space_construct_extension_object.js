"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */

const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");

const NodeId = require("node-opcua-nodeid").NodeId;

const UADataType = require("./ua_data_type").UADataType;
const eoan = require("./extension_object_array_node");


exports.install = function (AddressSpace) {


    AddressSpace.prototype.getExtensionObjectConstructor = function (dataType) {
        assert(dataType, "expecting a dataType");
        if (dataType instanceof NodeId) {
            const tmp = this.findNode(dataType);
            if (!tmp) {
                throw new Error("constructExtensionObject: cannot resolve dataType " + dataType);
            }
            dataType = tmp;
        }
        if (!(dataType instanceof UADataType)) {
            throw new Error("constructExtensionObject: dataType has unexpectedtype" + dataType);
        }
        eoan.prepareDataType(dataType);
        const Constructor = dataType._extensionObjectConstructor;
        return Constructor;
    };

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

        const Constructor = this.getExtensionObjectConstructor(dataType);
        return new Constructor(options);
    };
};
