// tslint:disable:no-bitwise
// =====================================================================================================================
// the purpose of this test is to check the ability to create a extension object from it's node
// id out of the address_space
//
// For instance if ServerStatus
//    const ServerStatusDataType = addressSpace.findDataType("ServerStatus");
//    const serverStatus  = addressSpace.constructExtensionObject(ServerStatusDataType);
//    serverStatus.constructor.name.should.eql("ServerStatus");
//
//

import * as fs from "fs";
import * as mocha from "mocha";
import * as utils from "node-opcua-utils";

import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";
import { makeNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import * as path from "path";
import * as should from "should";

import { ServerState } from "node-opcua-types";
import { AccessLevelFlag, NodeClass, makeAccessLevelFlag } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";
import { VariableIds } from "node-opcua-constants";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, BaseNode, Namespace, SessionContext, UAServerStatus } from "..";
import { generateAddressSpace } from "../nodeJS";
import { WriteValue } from "node-opcua-service-write";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");


// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space namespace loading", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard, path.join(__dirname, "../../../", "modeling/my_data_type.xml")];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        namespace = addressSpace.registerNamespace("Private");
        addressSpace.getNamespaceArray().length.should.eql(2);
        namespace.index.should.eql(1);
        await generateAddressSpace(addressSpace, xml_files);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should be possible to create a ServerStatus ExtensionObject", () => {
        const serverStatusDataType = addressSpace.findDataType("ServerStatusDataType")!;
        serverStatusDataType.nodeClass.should.eql(NodeClass.DataType);
        serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");

        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataType);
        serverStatus.constructor.name.should.eql("ServerStatusDataType");
        serverStatus.should.have.property("startTime");
        serverStatus.should.have.property("currentTime");
    });

    it("should be possible to create an AttributeOperand ExtensionObject", () => {
        //
        // should  handle this case as well
        //
        //   - BaseDataType
        //       - Structure
        //           - FilterOperand
        //              - AttributeOperand
        //

        const attributeOperand = addressSpace.findDataType("AttributeOperand")!;
        attributeOperand.nodeClass.should.eql(NodeClass.DataType);

        attributeOperand.browseName.toString().should.eql("AttributeOperand");

        const op = addressSpace.constructExtensionObject(attributeOperand);
        op.constructor.name.should.eql("AttributeOperand");

        op.should.have.property("attributeId");
        op.should.have.property("browsePath");
    });

    it("should create a arbitrary structure from a second name space", () => {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);

        const myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns)!;
        myStructureDataType.nodeClass.should.eql(NodeClass.DataType);

        // ------------------------------------------------------------------------------
        // create an extension object
        // ------------------------------------------------------------------------------
        const op = addressSpace.constructExtensionObject(myStructureDataType) as any;

        op.constructor.name.should.eql("MyStructureDataType");
        op.should.be.instanceof(ExtensionObject);

        op.should.have.property("lowValue");
        op.lowValue.should.eql(0);

        // xx debugLog("op.lowValue",op.lowValue.toString());

        // ------------------------------------------------------------------------------
        // create a variable
        // ------------------------------------------------------------------------------
        const myStructureType = addressSpace.findVariableType("MyStructureType", ns)!;
        myStructureType.nodeClass.should.eql(NodeClass.VariableType);

        const folder = namespace.addFolder("ObjectsFolder", { browseName: "MyDevices" });
        assert(folder.nodeId);
        folder.nodeClass.should.eql(NodeClass.Object);

        debugLog(" myStructureType = ", myStructureType.toString());

        const myVar = myStructureType.instantiate({
            browseName: "MyVar",
            organizedBy: folder
        });
        myVar.browseName.toString().should.eql("1:MyVar");

        (myVar as any).$extensionObject.should.be.instanceOf(op.constructor);

        myVar.readValue().value.value.should.be.instanceOf(op.constructor);

        // verify that variable property changes accordingly
        // now access UA Properties of the variable
        myVar.should.have.property("lowValue");

        // now change the underlying data

        (myVar as any).$extensionObject.lowValue = 10;

        // verify that value has changed using all way to access it
        (myVar as any).lowValue.readValue().value.value.should.eql(10);
        myVar.readValue().value.value.lowValue.should.eql(10);
    });

    it("should explore the DataType through OPCUA", () => {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        const myStructureDataType = addressSpace.findDataType("MyStructureDataType", ns)!;
        myStructureDataType.nodeClass.should.eql(NodeClass.DataType);

        debugLog(myStructureDataType.toString());

        // find the encoding
        // Xx debugLog(myStructureDataType.binaryEncoding.toString());

        debugLog(myStructureDataType.binaryEncodingDefinition!.toString());
        debugLog("------------------------------------------------------------------------------");
        // xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myStructureDataType.xmlEncodingDefinition!.toString());
    });

    it("AC explore the DataType through OPCUA", () => {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        ns.should.eql(2);
        const myOtherStructureDataType = addressSpace.findDataType("MyOtherStructureDataType", ns)!;
        myOtherStructureDataType.nodeClass.should.eql(NodeClass.DataType);

        debugLog(myOtherStructureDataType.toString());

        // find the encoding
        // xx debugLog(myStructureDataType.binaryEncoding.toString());
        debugLog(myOtherStructureDataType.binaryEncodingDefinition!.toString());
        debugLog("------------------------------------------------------------------------------");
        // xx debugLog(myStructureDataType.xmlEncoding.toString());
        debugLog(myOtherStructureDataType.xmlEncodingDefinition!.toString());

        const options = {
            names: ["Hello", "World"],
            values: [
                {
                    highValue: 100,
                    lowValue: 50
                },
                {
                    highValue: 101,
                    lowValue: 51
                }
            ]
        };
        const op = addressSpace.constructExtensionObject(myOtherStructureDataType, options) as any;

        op.constructor.name.should.eql("MyOtherStructureDataType");
        debugLog(op.toString());

        op.names.should.eql(["Hello", "World"]);
        op.values.length.should.eql(2);
        op.values[0].highValue.should.eql(100);
        op.values[0].lowValue.should.eql(50);
        op.values[1].highValue.should.eql(101);
        op.values[1].lowValue.should.eql(51);
    });

    it("should bind an xml-preloaded Extension Object Variable : ServerStatus ", async () => {
        // in this test, we verify that we can easily bind the Server_ServerStatus object
        // the process shall automatically bind variables and substructures recursively

        const serverStatus = addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus))! as UAServerStatus;
        serverStatus.browseName.toString().should.eql("ServerStatus");

        // before bindExtensionObject is called, startTime property exists but is not bound
        serverStatus.should.have.property("startTime");
        serverStatus.startTime.readValue().value.dataType.should.eql(DataType.DateTime);
        serverStatus.readValue().value.dataType.should.eql(DataType.ExtensionObject);

        // Xx value.startTime.should.eql(DataType.Null);
        // xx debugLog("serverStatus.startTime =",serverStatus.startTime.readValue().value.toString());

        serverStatus.bindExtensionObject();

        {
            serverStatus.readValue().value.value.state.should.eql(ServerState.Running);

            serverStatus.$extensionObject.state = ServerState.CommunicationFault;

            serverStatus.readValue().value.value.state.should.eql(ServerState.CommunicationFault);

            serverStatus.$extensionObject.state = ServerState.Running;
        }

        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1601-01-01T00:00:00.000Z");

        serverStatus.startTime.readValue().value.value!.toISOString().should.eql("1601-01-01T00:00:00.000Z");

        serverStatus.$extensionObject.startTime = new Date(Date.UTC(1800, 0, 1));

        serverStatus.readValue().value.value.startTime.toISOString().should.eql("1800-01-01T00:00:00.000Z");

        serverStatus.startTime.readValue().value.value!.toISOString().should.eql("1800-01-01T00:00:00.000Z");

        serverStatus.startTime.setValueFromSource({
            dataType: DataType.DateTime,
            value: new Date(Date.UTC(2100, 0, 1))
        });

        serverStatus.readValue().value.value!.startTime.toISOString().should.eql("2100-01-01T00:00:00.000Z");

        serverStatus.startTime.readValue().value.value!.toISOString().should.eql("2100-01-01T00:00:00.000Z");

        // xx debugLog(serverStatus.readValue().value.toString());

        serverStatus.$extensionObject.buildInfo.productName = "productName1";
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName1");
        serverStatus.buildInfo.productName.readValue().value.value!.should.eql("productName1");

        serverStatus.buildInfo.productName.setValueFromSource({ dataType: DataType.String, value: "productName2" });
        serverStatus.readValue().value.value.buildInfo.productName.should.eql("productName2");
        serverStatus.buildInfo.productName.readValue().value.value!.should.eql("productName2");

        // now use WriteValue instead
        // make sure value is writable
        const rw = makeAccessLevelFlag("CurrentRead | CurrentWrite");
        assert(rw === (AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite));
        serverStatus.buildInfo.productName.accessLevel = rw;
        serverStatus.buildInfo.productName.userAccessLevel = rw;

        serverStatus.buildInfo.accessLevel = rw;
        serverStatus.buildInfo.userAccessLevel = rw;

        serverStatus.accessLevel = rw;
        serverStatus.userAccessLevel = rw;

        const writeValue = new WriteValue({
            attributeId: AttributeIds.Value, // value
            value: {
                statusCode: StatusCodes.Good,
                value: {
                    dataType: DataType.String,
                    value: "productName3"
                }
            }
        });
        const statusCode = await serverStatus.buildInfo.productName.writeAttribute(null, writeValue);
        statusCode.should.eql(StatusCodes.BadNotWritable);

        serverStatus.buildInfo.productName.readValue().value.value!.should.not.eql("productName3");
        serverStatus.readValue().value.value.buildInfo.productName.should.not.eql("productName3");
    });

    it("should instantiate SessionDiagnostics in a linear time", () => {
        const sessionDiagnosticsDataType = addressSpace.findDataType("SessionDiagnosticsDataType")!;
        const sessionDiagnosticsVariableType = addressSpace.findVariableType("SessionDiagnosticsVariableType")!;

        const objs: BaseNode[] = [];

        function createDiagnostic(index: number) {
            const t5 = utils.get_clock_tick();
            const sessionObject = namespace.addObject({
                browseName: "Session" + index,
                organizedBy: addressSpace.rootFolder.objects
            });

            // the extension object
            const t6 = utils.get_clock_tick();
            const _sessionDiagnostics = addressSpace.constructExtensionObject(sessionDiagnosticsDataType);
            const t7 = utils.get_clock_tick();
            const sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                browseName: { name: "SessionDiagnostics", namespaceIndex: 0 },
                componentOf: sessionObject,
                value: new Variant({ dataType: DataType.ExtensionObject, value: _sessionDiagnostics })
            });
            const t8 = utils.get_clock_tick();
            // xx debugLog(" t8-t7",t8-t7);

            objs.push(sessionObject);
        }

        for (let i = 0; i < 100; i++) {
            createDiagnostic(i);
        }
        objs.forEach((obj: BaseNode) => {
            addressSpace.deleteNode(obj);
        });
    });
});
