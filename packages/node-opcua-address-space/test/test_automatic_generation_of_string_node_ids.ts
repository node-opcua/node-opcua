import * as chalk from "chalk";
import * as should from "should";

import { AddressSpace, UAObjectType, UAServerStatus, DTServerStatus } from "..";
import { getMiniAddressSpace } from "../testHelpers";
import { createCameraType, FakeCamera } from "./fixture_camera_type";

describe("Automatic Generation of  string nodeId", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it(
        "testing default string node creation (NodeOPCUA specified)\n\n" +
            chalk.cyan("      Given") +
            " a Node with a String Node ( for instance : ns=1;s=abcdef )  \n" +
            chalk.cyan("      When ") +
            " I add a component or a property to this node, without specifying a nodeId\n" +
            chalk.cyan("      Then ") +
            " NodeOPCUA should assign a string nodeId to the child node made from\n" +
            "            the nodeId of the parent node and the browse name of the child.\n",
        () => {
            const namespace = addressSpace.getOwnNamespace();

            const objNode1 = namespace.addObject({
                browseName: "MyObject",
                nodeId: "s=abcdef"
            });

            const comp1 = namespace.addVariable({
                browseName: "Component1",
                componentOf: objNode1,
                dataType: "Double"
            });
            comp1.browseName.toString().should.eql("1:Component1");
            comp1.nodeId.toString().should.eql("ns=1;s=abcdef-Component1");

            const prop1 = namespace.addVariable({
                browseName: "Property1",
                dataType: "Double",
                propertyOf: objNode1
            });
            prop1.browseName.toString().should.eql("1:Property1");
            prop1.nodeId.toString().should.eql("ns=1;s=abcdef-Property1");

            // but it should not work for organizedBy references
            const elementInFolder = namespace.addVariable({
                browseName: "ElementInFolder",
                dataType: "Double",
                organizedBy: objNode1
            });
            elementInFolder.browseName.toString().should.eql("1:ElementInFolder");
            elementInFolder.nodeId.toString().should.not.eql("ns=1;s=abcdef-1:ElementInFolder");
            elementInFolder.nodeId.toString().should.not.eql("ns=1;s=abcdef-ElementInFolder");
        }
    );

    it(
        "should generate string NodeIds on components and properties " +
            "when instantiating an object type that have a string nodeId (node-opcua specific)",
        () => {
            const cameraType = createCameraType(addressSpace);

            const namespace = addressSpace.getOwnNamespace();
            namespace.index.should.eql(1);

            const camera1 = cameraType.instantiate({
                browseName: "Camera2",
                nodeId: "s=MYCAMERA",
                organizedBy: "RootFolder"
            }) as FakeCamera;

            camera1.nodeId.toString().should.eql("ns=1;s=MYCAMERA");
            camera1.trigger.nodeId.toString().should.eql("ns=1;s=MYCAMERA-Trigger");
        }
    );

    it(
        "should generate string NodeIds on components and properties " +
            "when instantiating an VariableType that have a string nodeId (node-opcua specific)",
        async () => {
            const serverStatusType = addressSpace.findVariableType("ServerStatusType")!;

            const serverStatus = serverStatusType.instantiate({
                browseName: "MyServerStatus",
                nodeId: "s=MyServerStatus",
                organizedBy: "RootFolder"
            }) as UAServerStatus<DTServerStatus>;
            serverStatus.nodeId.toString().should.eql("ns=1;s=MyServerStatus");
            serverStatus.buildInfo.nodeId.toString().should.eql("ns=1;s=MyServerStatus-BuildInfo");
            serverStatus.buildInfo.productUri.nodeId.toString().should.eql("ns=1;s=MyServerStatus-BuildInfo-ProductUri");

            // xx console.log(serverStatus.toString());

            serverStatus.getComponentByName("BuildInfo")!.should.eql(serverStatus.buildInfo);

            // xx console.log(serverStatus.toString());
            // xx console.log(serverStatus.buildInfo.toString());
        }
    );

    describe("Given a derived ObjectType ", () => {
        let objectType: UAObjectType;
        let objectType2: UAObjectType;
        before(() => {
            const namespace = addressSpace.getOwnNamespace();

            objectType = namespace.addObjectType({
                browseName: "MyObjectType"
            });

            namespace.addObject({
                browseName: "PropertySet",
                componentOf: objectType,
                modellingRule: "Mandatory"
            });
            namespace.addObject({
                browseName: "Status",
                componentOf: objectType,
                modellingRule: "Optional"
            });

            objectType2 = namespace.addObjectType({
                browseName: "MyObjectType2",
                subtypeOf: objectType
            });
            namespace.addObject({
                browseName: "Status",
                componentOf: objectType2,
                description: "overridden status",
                modellingRule: "Optional"
            });
            namespace.addObject({
                browseName: "OnlyInObjetType2",
                componentOf: objectType2,
                modellingRule: "Mandatory"
            });
        });

        it("When instantiating a derived ObjectType, unwanted optional components should not be instantiated", () => {
            const obj = objectType2.instantiate({
                browseName: "MyInstance1"
            });
            obj.browseName.toString().should.eql("1:MyInstance1");

            should(obj.getComponentByName("Status")).eql(null, "We didn't ask for optional component Status");
        });
        it("When instantiating a derived ObjectType, wanted optional components should be instantiated", () => {
            const obj = objectType2.instantiate({
                browseName: "MyInstance2",
                optionals: ["Status"]
            });
            obj.browseName.toString().should.eql("1:MyInstance2");

            // xx console.log(obj.toString());

            should(obj.getComponentByName("Status")).not.eql(null, "We asked for optional component Status");
        });
    });
});
