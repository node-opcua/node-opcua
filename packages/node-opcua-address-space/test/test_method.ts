import * as should from "should";

import { AttributeIds, LocalizedText } from "node-opcua-data-model";
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

import { CallMethodResultOptions, NodeClass } from "node-opcua-types";
import { AddressSpace, Namespace, UARootFolder, UAMethod, ISessionContext } from "..";
import { SessionContext } from "..";
import { getMiniAddressSpace } from "../testHelpers";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Method -  Attribute UserExecutable & Executable on Method ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should return Executable= false and UserExecutable=false if method is not bound ", () => {
        const obj = namespace.addObject({ browseName: "object" });

        const method = namespace.addMethod(obj, {
            browseName: "MyMethod1",
            executable: true,
            inputArguments: [],
            outputArguments: [],
            userExecutable: false
        });

        let value;
        value = method.readAttribute(context, AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);

        value = method.readAttribute(context, AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(false);
    });
    it("should return Executable= true and UserExecutable=true if method is  bound ", () => {
        const obj = namespace.addObject({ browseName: "object" });

        const method = namespace.addMethod(obj, {
            browseName: "MyMethod2",
            executable: true,
            inputArguments: [],
            outputArguments: [],
            userExecutable: false
        });

        async function fakeMethod(this: UAMethod, inputArguments: VariantLike[], context: ISessionContext): Promise<CallMethodResultOptions> {
            // do nothing
            return { statusCode: StatusCodes.Good };
        }

        method.bindMethod(fakeMethod);

        let value;
        value = method.readAttribute(context, AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

        value = method.readAttribute(context, AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);
    });

    it("should be possible to pass displayName when adding a method", () => {
        const obj = namespace.addObject({ browseName: "object2" });

        const method = namespace.addMethod(obj, {
            browseName: "MyMethod2",
            executable: true,
            inputArguments: [],
            outputArguments: [],
            userExecutable: false,

            displayName: "My Display Name"
        });

        const value = method.readAttribute(context, AttributeIds.DisplayName);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.LocalizedText);
        value.value.value.toString().should.equal(new LocalizedText({ locale: null, text: "My Display Name" }).toString());
    });
});

describe("testing Method in address space", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("should provide a way to find a Method object by nodeId", () => {
        addressSpace.findMethod("ns=0;i=11489")!.nodeClass.should.eql(NodeClass.Method);
        addressSpace.findNode("ns=0;i=11489")!.nodeClass.should.eql(NodeClass.Method);
    });
    it("should provide a way to find a Method object by nodeId", () => {
        addressSpace.findMethod("ns=0;i=11492")!.nodeClass.should.eql(NodeClass.Method);
        addressSpace.findNode("ns=0;i=11492")!.nodeClass.should.eql(NodeClass.Method);
    });

    it("should provide a input Parameter variable", () => {
        const method = addressSpace.findMethod("ns=0;i=11489")!;
        method.nodeClass.should.eql(NodeClass.Method);
        const inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Object);
    });
    it("should provide a output Parameter variable", () => {
        const method = addressSpace.findMethod("ns=0;i=11489")!;
        method.nodeClass.should.eql(NodeClass.Method);

        const outputArguments = method.getOutputArguments();
        outputArguments.should.be.instanceOf(Object);
    });
});

describe("testing Method binding", () => {
    let addressSpace: AddressSpace;
    let rootFolder: UARootFolder;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        rootFolder = addressSpace.rootFolder;
        rootFolder.browseName.toString().should.equal("Root");
    });
    after(async () => {
        addressSpace.dispose();
    });

    function fake_getMonitoredItemId(this: UAMethod, inputArguments: Variant[], context1: ISessionContext, callback: CallbackT<CallMethodResultOptions>) {
        should(Array.isArray(inputArguments)).eql(true);
        should(typeof callback === "function").eql(true);

        inputArguments[0].dataType.should.eql(DataType.UInt32);
        inputArguments[0].value.should.eql(5);

        const myResult = {
            outputArguments: [
                { dataType: DataType.UInt32, value: [1, 2, 3] },
                { dataType: DataType.UInt32, value: [4, 5, 6] }
            ],
            statusCode: StatusCodes.BadBoundNotFound
        };
        callback(null, myResult);
    }

    it("should bind a method with a method - MethodFunctorC ", async () => {
        const server = rootFolder.objects.server;

        server.getMonitoredItems.bindMethod(fake_getMonitoredItemId);

        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];

        const result = await server.getMonitoredItems.execute(null, inputArguments, context);
    });

    it("should bind a method with a method - MethodFunctorA ", async () => {
        const server = rootFolder.objects.server;

        async function method(this: UAMethod, inputArguments: Variant[], context1: ISessionContext): Promise<CallMethodResultOptions> {
            should(Array.isArray(inputArguments)).eql(true);
        
            inputArguments[0].dataType.should.eql(DataType.UInt32);
            inputArguments[0].value.should.eql(5);
    
            const myResult = {
                outputArguments: [
                    { dataType: DataType.UInt32, value: [1, 2, 3] },
                    { dataType: DataType.UInt32, value: [4, 5, 6] }
                ],
                statusCode: StatusCodes.BadBoundNotFound
            };
            await new Promise((resolve) => setImmediate(resolve));
            return myResult;
        }
    
        server.getMonitoredItems.bindMethod(method);

        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];
        const result = await server.getMonitoredItems.execute(null, inputArguments, context);
        result.outputArguments[0].dataType.should.eql(DataType.UInt32);
        result.outputArguments[1].dataType.should.eql(DataType.UInt32);
        result.statusCode.should.eql(StatusCodes.BadBoundNotFound);
    });
});
