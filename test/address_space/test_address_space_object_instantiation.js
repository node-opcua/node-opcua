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
    it("should instantiate a objectType that uses custom HasChild Property",function() {

        // ------------ Add a new aggregate
        var weezbeChildType = addressSpace.addReferenceType({
            browseName: "HasWeezbe",
            inverseName: "WeezbeOf",
            isAbstract: false,
            subtypeOf: "Aggregates"
        });

        var myObjectType = addressSpace.addObjectType({
            browseName: "MyObjectType"
        });

        var weezbeChild = addressSpace.addObject({
            browseName:    "MyWeezBe",
            modellingRule:"Mandatory"
        });

        myObjectType.addReference({
            referenceType: weezbeChildType.nodeId, nodeId: weezbeChild
        });

        var aggregates = myObjectType.getAggregates();
        console.log("myObjectType aggregates=  ",aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);


        var instance= myObjectType.instantiate({
            browseName: "Instance"
        });
        instance.browseName.toString().should.eql("Instance");

        var aggregates = instance.getAggregates();
        console.log("equipmentType children=  ",aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);


        instance.findReferencesEx("HasWeezbe",BrowseDirection.Forward).length.should.eql(1);

        var c = instance.getChildByName("MyWeezBe");
        should(c).not.eql(null)

    });


});
