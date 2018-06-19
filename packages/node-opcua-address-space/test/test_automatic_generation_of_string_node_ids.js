"use strict";
/* global describe,it,before*/
const should = require("should");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

describe("Automatic Generation of  string nodeId", function () {

    let addressSpace;
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

            const namespace = addressSpace.getOwnNamespace();

            const objNode1 = namespace.addObject({
                nodeId: "s=abcdef",
                browseName: "MyObject"
            });

            const comp1 = namespace.addVariable({
                componentOf: objNode1,
                browseName:  "Component1",
                dataType:"Double"
            });
            comp1.browseName.toString().should.eql("1:Component1");
            comp1.nodeId.toString().should.eql("ns=1;s=abcdef-1:Component1");

            const prop1 = namespace.addVariable({
                propertyOf: objNode1,
                browseName: "Property1",
                dataType:"Double"
            });
            prop1.browseName.toString().should.eql("1:Property1");
            prop1.nodeId.toString().should.eql("ns=1;s=abcdef-1:Property1");


            // but it should not work for organizedBy references
            const elementInFolder = namespace.addVariable({
                organizedBy: objNode1,
                browseName: "ElementInFolder",
                dataType:"Double"
            });
            elementInFolder.browseName.toString().should.eql("1:ElementInFolder");
            elementInFolder.nodeId.toString().should.not.eql("ns=1;s=abcdef-1:ElementInFolder");
            elementInFolder.nodeId.toString().should.not.eql("ns=1;s=abcdef-ElementInFolder");
        });

    it("should generate string NodeIds on components and properties when instantiating an object type that have a string nodeId (node-opcua specific)", function (done) {

        const createCameraType = require("../test/fixture_camera_type").createCameraType;
        const cameraType = createCameraType(addressSpace);

        const namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);

        const camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            nodeId: "s=MYCAMERA",
            browseName: "Camera2"
        });
        camera1.nodeId.toString().should.eql("ns=1;s=MYCAMERA");
        camera1.trigger.nodeId.toString().should.eql("ns=1;s=MYCAMERA-1:Trigger");
        done();
    });


    it("should generate string NodeIds on components and properties when instantiating an VariableType that have a string nodeId (node-opcua specific)", function (done) {


        const serverStatusType = addressSpace.findVariableType("ServerStatusType");

        const serverStatus = serverStatusType.instantiate({
            organizedBy: "RootFolder",
            nodeId: "s=MyServerStatus",
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

        let objectType, objectType2;
        before(function() {
            const namespace = addressSpace.getOwnNamespace();

            objectType = namespace.addObjectType({
                browseName:  "MyObjectType",
            });

            namespace.addObject({
                componentOf: objectType,
                browseName: "PropertySet",
                modellingRule: "Mandatory"
            });
            namespace.addObject({
                componentOf: objectType,
                browseName:    "Status",
                modellingRule: "Optional"
            });

            objectType2 = namespace.addObjectType({
                subtypeOf: objectType,
                browseName: "MyObjectType2"
            });
            namespace.addObject({
                componentOf: objectType2,
                browseName:    "Status",
                description: "overridden status",
                modellingRule: "Optional"
            });
            namespace.addObject({
                componentOf: objectType2,
                browseName:    "OnlyInObjetType2",
                modellingRule: "Mandatory"
            });
        });

        it("When instantiating a derived ObjectType, unwanted optional components should not be instantiated",function() {
            const obj = objectType2.instantiate({
                browseName: "MyInstance1"
            });
            obj.browseName.toString().should.eql("1:MyInstance1");

            should(obj.getComponentByName("Status")).eql(null,"We didn't ask for optional component Status");
        });
        it("When instantiating a derived ObjectType, wanted optional components should be instantiated",function() {
            const obj = objectType2.instantiate({
                browseName: "MyInstance2",
                optionals: ["Status"]
            });
            obj.browseName.toString().should.eql("1:MyInstance2");

            //xx console.log(obj.toString());

            should(obj.getComponentByName("Status")).not.eql(null,"We asked for optional component Status");

        });
    });
});
