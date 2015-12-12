require("requirish")._(module);
var assert = require("better-assert");

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
var UAObject = require("lib/address_space/ua_object").UAObject;

var util = require("util");
var _ = require("underscore");



exports.install = function (AddressSpace) {

    var makeStructure = require("lib/address_space/convert_nodeset_to_types").makeStructure;
    /**
     * @method constructExtensionObject
     * @param dataType {UADataType}
     * @param [options {Object} =null]
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
