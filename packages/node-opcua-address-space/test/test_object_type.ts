import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, SessionContext } from "..";
import { create_minimalist_address_space_nodeset } from "../testHelpers";

const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UAObjectType", () => {
    let addressSpace: AddressSpace;

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

    it("should read Attribute IsAbstract on UAObjectType ", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject",
            isAbstract: false
        });

        const value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);
    });
    it("should read Attribute IsAbstract on Abstract UAObjectType ", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject2",
            isAbstract: true
        });

        let value;
        value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);

        value = objType.readAttribute(context, AttributeIds.NodeId);
        value.value.dataType.should.eql(DataType.NodeId);
    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType (nodeId not specified)", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject3",
            isAbstract: false,
            subtypeOf: "BaseObjectType"
        });

        const obj = objType.instantiate({
            browseName: "Instance3"
        });

        obj.browseName.toString().should.eql("1:Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);
    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType and specify its nodeId)", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject4",
            isAbstract: false,
            subtypeOf: "BaseObjectType"
        });

        const obj = objType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=1;s=HelloWorld"
        });

        obj.browseName.toString().should.eql("1:Instance4");

        obj.nodeId.toString().should.eql("ns=1;s=HelloWorld");
    });
    it("UAObjectType#toString()", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject5",
            isAbstract: false,
            subtypeOf: "BaseObjectType"
        });
        const variable = namespace.addVariable({
            browseName: "Variable",
            componentOf: objType,
            dataType: "Double",
            modellingRule: "Mandatory"
        });
        // tslint:disable:no-console
        debugLog(objType.toString());
        debugLog(variable.toString());
    });

    it("ObjectType#instantiate and display name", () => {
        const namespace = addressSpace.getOwnNamespace();
        const objType = namespace.addObjectType({
            browseName: "MyObject6",
            displayName: "Some DisplayName",
            isAbstract: false,
            subtypeOf: "BaseObjectType"
        });
        
        objType.displayName.toString().should.eql("locale=null text=Some DisplayName");


        const instance1 =objType.instantiate({
            browseName: "Instance1",
        });
        instance1.displayName.toString().should.eql("locale=null text=Instance1");

        const instance2 =objType.instantiate({
            browseName: "Instance2",
            displayName: "Instance2 DisplayName"
        });
        instance2.displayName.toString().should.eql("locale=null text=Instance2 DisplayName");


        // tslint:disable:no-console
        debugLog(objType.toString());
        
    }); 
});
