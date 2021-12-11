import * as mocha from "mocha";
import * as should from "should";
import * as sinon from "sinon";

import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, SessionContext, UAVariableType } from "..";
import { create_minimalist_address_space_nodeset } from "../testHelpers";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const _should = should;
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing UAVariableType", () => {
    let addressSpace: AddressSpace;

    const context = SessionContext.defaultContext;

    before(() => {
        addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);
        addressSpace.registerNamespace("Private");
    });

    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should read Attribute IsAbstract on UAVariableType ", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariableType1",
            isAbstract: false
        });

        const dataValue = variableType.readAttribute(context, AttributeIds.IsAbstract);
        dataValue.value.dataType.should.eql(DataType.Boolean);
        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.value.should.equal(false);
    });

    it("should read Attribute IsAbstract on Abstract UAVariableType ", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable2",
            isAbstract: true
        });

        let value = variableType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);

        value = variableType.readAttribute(context, AttributeIds.NodeId);
        value.value.dataType.should.eql(DataType.NodeId);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.toString().should.eql(variableType.nodeId.toString());
    });

    it("UAVariableType#instantiate should be possible to instantiate a VariableType (nodeId not specified)", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable3",
            isAbstract: false,
            subtypeOf: "BaseVariableType"
        });

        const obj = variableType.instantiate({
            browseName: "Instance3",
            dataType: "Int32"
        });

        obj.browseName.toString().should.eql("1:Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);
    });

    it("UAVariableType#instantiate should be possible to instantiate a VariableType and specify its nodeId)", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable4",
            isAbstract: false,
            subtypeOf: "BaseVariableType"
        });

        const obj = variableType.instantiate({
            browseName: "Instance4",
            dataType: "Int32",
            nodeId: "ns=1;s=HelloWorld"
        });

        obj.browseName.toString().should.eql("1:Instance4");

        obj.nodeId.toString().should.eql("ns=1;s=HelloWorld");
    });

    it("UAVariableType#instantiate with componentOf", () => {
        addressSpace.rootFolder.browseName.toString().should.eql("RootFolder");

        const myFolder = addressSpace.getOwnNamespace().addObject({
            browseName: "MyFolder",
            organizedBy: addressSpace.rootFolder.objects
        });

        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable5",
            isAbstract: false,
            subtypeOf: "BaseVariableType"
        });

        const obj = variableType.instantiate({
            browseName: "Instance5",
            componentOf: myFolder,
            dataType: "Int32"
        });

        myFolder.getComponentByName("Instance5")!.browseName.toString().should.eql("1:Instance5");
    });
    it("UAVariableType#instantiate with organizedBy", () => {
        addressSpace.rootFolder.browseName.toString().should.eql("RootFolder");

        const myFolder = addressSpace.getOwnNamespace().addObject({
            browseName: "MyFolder2",
            organizedBy: addressSpace.rootFolder.objects
        });

        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable6",
            isAbstract: false,
            subtypeOf: "BaseVariableType"
        });

        const obj = variableType.instantiate({
            browseName: "Instance6",
            dataType: "Int32",
            organizedBy: myFolder
        });

        myFolder.getFolderElementByName("Instance6")!.browseName.toString().should.eql("1:Instance6");
    });
    it("UAVariableType#instantiate with valueRank and arrayDimension", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            arrayDimensions: [3, 3],
            browseName: "My3x3MatrixVariableType",
            dataType: "Double",
            isAbstract: false,
            subtypeOf: "BaseVariableType",
            valueRank: 2
        });

        const doubleDataType = addressSpace.findDataType("Double")!;

        doubleDataType.browseName.toString().should.eql("Double");

        variableType.dataType.should.eql(doubleDataType.nodeId);
        variableType.valueRank.should.eql(2);
        variableType.arrayDimensions!.should.eql([3, 3]);

        const obj = variableType.instantiate({
            browseName: "My3x3MatrixVariable"
        });

        obj.browseName.toString().should.eql("1:My3x3MatrixVariable");
        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);
        obj.dataType.should.eql(doubleDataType.nodeId);
        obj.valueRank.should.eql(2);
        obj.arrayDimensions!.should.eql([3, 3]);
    });

    it("should provide a mechanism to customize newly created instance", () => {
        const postInstantiateFunc = sinon.spy();

        const variableType = addressSpace.getOwnNamespace().addVariableType({
            browseName: "MyVariable10",
            isAbstract: false,
            postInstantiateFunc,
            subtypeOf: "BaseVariableType"
        });
        postInstantiateFunc.callCount.should.eql(0);

        const obj = variableType.instantiate({
            browseName: "Instance4",
            dataType: "Int32"
        });

        postInstantiateFunc.callCount.should.eql(1);
    });

    // tslint:disable:no-console
    it("UAVariableType#toString()", () => {
        const variableType = addressSpace.getOwnNamespace().addVariableType({
            arrayDimensions: [3, 3],
            browseName: "My3x3MatrixVariableType1",
            dataType: "Double",
            isAbstract: false,
            subtypeOf: "BaseVariableType",
            valueRank: 2
        });
        variableType.toString();
        debugLog(variableType.toString());

        const variable = variableType.instantiate({
            browseName: "My3x3MatrixVariable1"
        });

        variable.toString();
        debugLog(variable.toString());
    });

    it("UADataType#toString()", () => {
        const doubleDataType = addressSpace.findDataType("Double")!;
        doubleDataType.toString();
        debugLog(doubleDataType.toString());
    });

    it("UAVariableType#instantiate and display name", () => {
        const namespace = addressSpace.getOwnNamespace();
        const varType = namespace.addVariableType({
            browseName: "MyVariableType",
            displayName: "Some DisplayName",
            isAbstract: false,
            subtypeOf: "BaseVariableType"
        });
        
        varType.displayName.toString().should.eql("locale=null text=Some DisplayName");

        const instance1 =varType.instantiate({
            browseName: "Instance1",
        });
        instance1.displayName.toString().should.eql("locale=null text=Instance1");

        const instance2 =varType.instantiate({
            browseName: "Instance2",
            displayName: "Instance2 DisplayName"
        });
        instance2.displayName.toString().should.eql("locale=null text=Instance2 DisplayName");


        // tslint:disable:no-console
        debugLog(varType.toString());
;
    }); 

});
