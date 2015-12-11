"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");

var _ = require("underscore");
var assert = require("better-assert");
var path = require("path");

var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

describe("testing add new ObjectType ", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                done(err);
            });
        });
        after(function () {
            addressSpace.dispose();
            addressSpace = null;
        });
    });
    it("should add a new ObjectType (=> BaseObjectType)",function() {

        var myObjectType = addressSpace.addObjectType({ browseName: "MyObjectType"});
        myObjectType.browseName.toString().should.eql("MyObjectType");
        myObjectType.subtypeOfObj.browseName.toString().should.eql("BaseObjectType");
        myObjectType.nodeClass.should.eql(NodeClass.ObjectType);
    });
    it("should add a new VariableType (=> BaseVariableType)",function() {

        var myVariableType = addressSpace.addVariableType({ browseName: "MyVariableType"});
        myVariableType.browseName.toString().should.eql("MyVariableType");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });
    it("should add a new VariableType (=> BaseDataVariableType)",function() {

        var myVariableType = addressSpace.addVariableType({
            browseName: "MyVariableType2",
            subtypeOf: "BaseDataVariableType"
        });
        myVariableType.browseName.toString().should.eql("MyVariableType2");
        myVariableType.subtypeOfObj.browseName.toString().should.eql("BaseDataVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);

    });

});
