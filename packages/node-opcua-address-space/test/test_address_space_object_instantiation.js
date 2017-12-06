"use strict";
/* global describe,it,before*/

var should = require("should");

var _ = require("underscore");

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var browse_service = require("node-opcua-service-browse");
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing add new ObjectType ", function () {

    var addressSpace;

    before(function (done) {
        get_mini_address_space(function (err,__addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });
    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
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
        should.exist(c);

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
                optionals: ["Property2", "Property3"]
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
        should.exist(obj2.getComponentByName("SubObj"));
        obj2.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");

        should.exist(obj2.subObj.getPropertyByName("Property1"));
        should.not.exist(obj2.subObj.getPropertyByName("Property2"));
        should.not.exist(obj2.subObj.getPropertyByName("Property3"));

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

        should.exist(obj3.subObj.getPropertyByName("Property1"));
        should.exist(obj3.subObj.getPropertyByName("Property2"));
        should.exist(obj3.subObj.getPropertyByName("Property3"));

        // -----------------------------------------------
        var obj4 = myObjectType1.instantiate({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Obj4",
            optionals: [
                "SubObj.Property3"
            ]
        });
        obj4.getComponentByName("SubObj").browseName.toString().should.eql("SubObj");

        should.exist(obj4.subObj.getPropertyByName("Property1"));
        should.not.exist(obj4.subObj.getPropertyByName("Property2"));
        should.exist(obj4.subObj.getPropertyByName("Property3"));
    });

});
