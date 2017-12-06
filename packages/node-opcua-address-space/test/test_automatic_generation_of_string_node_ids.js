"use strict";
/* global describe,it,before*/
var should = require("should");

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

describe("Automatic Generation of  string nodeId", function () {

    var addressSpace;
    before(function (done) {
        get_mini_address_space(function (err,__addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });

    });
    after(function(done){
        addressSpace.dispose();
        done();
    });


    it(
        "testing default string node creation (NodeOPCUA specified)\n\n"+
        "      Given".cyan + " a Node with a String Node ( for instance : ns=1;s=abcdef )  \n"+
        "      When ".cyan + " I add a component or a property to this node, without specifying a nodeId\n"+
        "      Then ".cyan + " NodeOPCUA should assign a string nodeId to the property or the component derived from\n"+
        "            the nodeId of the parent node and the browse name of the child.\n"
        ,function() {

            var objNode1 = addressSpace.addObject({
                nodeId: "ns=1;s=abcdef",
                browseName: "MyObject"
            });

            var comp1 = addressSpace.addVariable({
                componentOf: objNode1,
                browseName:  "Component1",
                dataType:"Double"
            });
            comp1.browseName.toString().should.eql("Component1");
            comp1.nodeId.toString().should.eql("ns=1;s=abcdef-Component1");

            var prop1 = addressSpace.addVariable({
                propertyOf: objNode1,
                browseName: "Property1",
                dataType:"Double"
            });
            prop1.browseName.toString().should.eql("Property1");
            prop1.nodeId.toString().should.eql("ns=1;s=abcdef-Property1");


            // but it should not work for organizedBy references
            var elementInFolder = addressSpace.addVariable({
                organizedBy: objNode1,
                browseName: "ElementInFolder",
                dataType:"Double"
            });
            elementInFolder.browseName.toString().should.eql("ElementInFolder");
            elementInFolder.nodeId.toString().should.not.eql("ns=1;s=abcdef-ElementInFolder");
        });

    it("should generate string NodeIds on components and properties when instantiating an object type that have a string nodeId (node-opcua specific)", function (done) {

        var createCameraType = require("../test/fixture_camera_type").createCameraType;
        var cameraType = createCameraType(addressSpace);

        var camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            nodeId: "ns=1;s=MYCAMERA",
            browseName: "Camera2"
        });
        camera1.nodeId.toString().should.eql("ns=1;s=MYCAMERA");
        camera1.trigger.nodeId.toString().should.eql("ns=1;s=MYCAMERA-1:Trigger");
        done();
    });


    it("should generate string NodeIds on components and properties when instantiating an VariableType that have a string nodeId (node-opcua specific)", function (done) {


        var serverStatusType = addressSpace.findVariableType("ServerStatusType");

        var serverStatus = serverStatusType.instantiate({
            organizedBy: "RootFolder",
            nodeId: "ns=1;s=MyServerStatus",
            browseName: "MyServerStatus"
        });
        serverStatus.nodeId.toString().should.eql("ns=1;s=MyServerStatus");
        serverStatus.buildInfo.nodeId.toString().should.eql("ns=1;s=MyServerStatus-BuildInfo");
        serverStatus.buildInfo.productUri.nodeId.toString().should.eql("ns=1;s=MyServerStatus-BuildInfo-ProductUri");

        //xx console.log(serverStatus.toString());

        serverStatus.getComponentByName("BuildInfo").should.eql(serverStatus.buildInfo);

        //xx console.log(serverStatus.toString());
        //xx console.log(serverStatus.buildInfo.toString());
        done();
    });

    describe("Given a derived ObjectType ",function() {

        var objectType,objectType2;
        before(function() {
            objectType = addressSpace.addObjectType({
                browseName:  "MyObjectType",
            });

            addressSpace.addObject({
                componentOf: objectType,
                browseName: "PropertySet",
                modellingRule: "Mandatory"
            });
            addressSpace.addObject({
                componentOf: objectType,
                browseName:    "Status",
                modellingRule: "Optional"
            });

            objectType2 = addressSpace.addObjectType({
                subtypeOf: objectType,
                browseName: "MyObjectType2"
            });
            addressSpace.addObject({
                componentOf: objectType2,
                browseName:    "Status",
                description: "overridden status",
                modellingRule: "Optional"
            });
            addressSpace.addObject({
                componentOf: objectType2,
                browseName:    "OnlyInObjetType2",
                modellingRule: "Mandatory"
            });
        });

        it("When instantiating a derived ObjectType, unwanted optional components should not be instantiated",function() {
            var obj = objectType2.instantiate({
                browseName: "MyInstance1"
            });
            obj.browseName.toString().should.eql("MyInstance1");

            should(obj.getComponentByName("Status")).eql(null,"We didn't ask for optional component Status");
        });
        it("When instantiating a derived ObjectType, wanted optional components should be instantiated",function() {
            var obj = objectType2.instantiate({
                browseName: "MyInstance2",
                optionals: ["Status"]
            });
            obj.browseName.toString().should.eql("MyInstance2");

            //xx console.log(obj.toString());

            should(obj.getComponentByName("Status")).not.eql(null,"We asked for optional component Status");

        });
    });
});
