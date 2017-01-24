/**
 * @module opcua.address_space
 * @class AddressSpace
 */
import assert from "better-assert";
import util from "util";
import _ from "underscore";
import { NodeId } from "lib/datamodel/nodeid";
import { UADataType } from "lib/address_space/ua_data_type";
import { makeStructure } from "lib/address_space/convert_nodeset_to_types";

export function install(AddressSpace) {
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
  AddressSpace.prototype.constructExtensionObject = function (dataType,options) {
    if (dataType instanceof NodeId) {
      dataType = this.findNode(dataType);
    }
    assert(dataType instanceof UADataType);

    if (!dataType._extensionObjectConstructor) {
      dataType._extensionObjectConstructor = makeStructure(dataType);
      if (!dataType._extensionObjectConstructor) {
        console.log(`AddressSpace#constructExtensionObject : cannot make structure for ${dataType.toString()}`);
      }
    }
    const Constructor =  dataType._extensionObjectConstructor;
    return new Constructor(options);
  };
}
