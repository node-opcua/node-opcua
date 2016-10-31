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
        //xx console.log("myObjectType aggregates=  ",aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);


        var instance= myObjectType.instantiate({
            browseName: "Instance"
        });
        instance.browseName.toString().should.eql("Instance");

        var aggregates = instance.getAggregates();
        //xx console.log("equipmentType children=  ",aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);


        instance.findReferencesEx("HasWeezbe",BrowseDirection.Forward).length.should.eql(1);

        var c = instance.getChildByName("MyWeezBe");
        should(c).not.eql(null)

    });


    it("should be possible to choose which optional item to instantiate in sub objects",function() {

        function constructObjectType() {

            var mySubObjectType1 = addressSpace.addObjectType({
                browseName: "MySubObjectType1"
            });
            var prop1 = addressSpace.addVariable({
                propertyOf: mySubObjectType1,
                browseName: "Property1",
                dataType: "Double",
                modellingRule: "Mandatory"
            });

            mySubObjectType1.property1.browseName.toString().should.eql("Property1");

            var prop2 = addressSpace.addVariable({
                propertyOf: mySubObjectType1,
                browseName: "Property2",
                dataType: "Double",
                modellingRule: "Optional"
            });
            var prop3 = addressSpace.addVariable({
                propertyOf: mySubObjectType1,
                browseName: "Property3",
                dataType: "Double",
                modellingRule: "Optional"
            });

            var myObjectType1 = addressSpace.addObjectType({
                browseName: "MyObjectType1"
            });

            var subObj = mySubObjectType1.instantiate({
                browseName: "SubObj",
                modellingRule: "Optional",
                componentOf: myObjectType1,
                optionals: ["Property2","Property3"]
            });

            myObjectType1.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");
            myObjectType1.subObj.getPropertyByName("Property1").browseName.toString().should.eql("Property1");
            myObjectType1.subObj.getPropertyByName("Property2").browseName.toString().should.eql("Property2");
            myObjectType1.subObj.getPropertyByName("Property3").browseName.toString().should.eql("Property3");

        }
        constructObjectType();

        var myObjectType1 = addressSpace.findObjectType("MyObjectType1");

        // -----------------------------------------------
        var obj1 = myObjectType1.instantiate({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Obj1"
        });
        should(obj1.getComponentByName("SubObj")).eql(null);


        // -----------------------------------------------
        var obj2 = myObjectType1.instantiate({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Obj2",
            optionals: ["SubObj"]
        });
        should(obj2.getComponentByName("SubObj")).not.eql(null);
        obj2.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");

        should(obj2.subObj.getPropertyByName("Property1")).not.eql(null);
        should(obj2.subObj.getPropertyByName("Property2")).eql(null);
        should(obj2.subObj.getPropertyByName("Property3")).eql(null);

        // -----------------------------------------------
        var obj3 = myObjectType1.instantiate({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Obj3",
            optionals: [
                "SubObj.Property2",
                "SubObj.Property3"
            ]
        });
        obj3.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");

        should(obj3.subObj.getPropertyByName("Property1")).not.eql(null);
        should(obj3.subObj.getPropertyByName("Property2")).not.eql(null);
        should(obj3.subObj.getPropertyByName("Property3")).not.eql(null);

        // -----------------------------------------------
        var obj4 = myObjectType1.instantiate({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Obj4",
            optionals: [
                "SubObj.Property3"
            ]
        });
        obj4.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");

        should(obj4.subObj.getPropertyByName("Property1")).not.eql(null);
        should(obj4.subObj.getPropertyByName("Property2")).eql(null);
        should(obj4.subObj.getPropertyByName("Property3")).not.eql(null);
    });

});
