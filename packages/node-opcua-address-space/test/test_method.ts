import { AttributeIds, LocalizedText } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type CallbackT, StatusCodes } from "node-opcua-status-code";
import { type CallMethodResultOptions, NodeClass } from "node-opcua-types";
import { DataType, type Variant, type VariantLike } from "node-opcua-variant";
import should from "should";
import {
    type AddressSpace,
    type ISessionContext,
    type MethodCallInterceptor,
    type Namespace,
    PseudoSession,
    SessionContext,
    type UAMethod,
    type UAObject,
    type UAObjectType,
    type UARootFolder
} from "..";
import { getMiniAddressSpace } from "../testHelpers";

const context = SessionContext.defaultContext;

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

        let value = method.readAttribute(context, AttributeIds.UserExecutable);
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

        async function fakeMethod(
            this: UAMethod,
            _inputArguments: VariantLike[],
            _context: ISessionContext
        ): Promise<CallMethodResultOptions> {
            // do nothing
            return { statusCode: StatusCodes.Good };
        }

        method.bindMethod(fakeMethod);

        let value = method.readAttribute(context, AttributeIds.UserExecutable);
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
        should.exist(addressSpace.findMethod("ns=0;i=11489"));
        should.exist(addressSpace.findNode("ns=0;i=11489"));
        addressSpace.findMethod("ns=0;i=11489")?.nodeClass.should.eql(NodeClass.Method);
        addressSpace.findNode("ns=0;i=11489")?.nodeClass.should.eql(NodeClass.Method);
    });
    it("should provide a way to find a Method object by nodeId", () => {
        should.exist(addressSpace.findMethod("ns=0;i=11492"));
        should.exist(addressSpace.findNode("ns=0;i=11492"));
        addressSpace.findMethod("ns=0;i=11492")?.nodeClass.should.eql(NodeClass.Method);
        addressSpace.findNode("ns=0;i=11492")?.nodeClass.should.eql(NodeClass.Method);
    });

    it("should provide a input Parameter variable", () => {
        const method = addressSpace.findMethod("ns=0;i=11489")!;
        should.exist(method);
        method.nodeClass.should.eql(NodeClass.Method);
        const inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Object);
    });
    it("should provide a output Parameter variable", () => {
        const method = addressSpace.findMethod("ns=0;i=11489")!;
        should.exist(method);
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

    function fake_getMonitoredItemId(
        this: UAMethod,
        inputArguments: Variant[],
        _context1: ISessionContext,
        callback: CallbackT<CallMethodResultOptions>
    ) {
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

        server.getMonitoredItems?.bindMethod(fake_getMonitoredItemId);

        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];

        const _result = await server.getMonitoredItems?.execute(null, inputArguments, context);
    });

    it("should bind a method with a method - MethodFunctorA ", async () => {
        const server = rootFolder.objects.server;

        async function method(
            this: UAMethod,
            inputArguments: Variant[],
            _context1: ISessionContext
        ): Promise<CallMethodResultOptions> {
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

        server.getMonitoredItems?.bindMethod(method);

        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];
        const result = await server.getMonitoredItems?.execute(null, inputArguments, context);
        const outputArguments = result.outputArguments as VariantLike[];
        outputArguments.should.have.length(2);
        should.exist(outputArguments[0]);
        should.exist(outputArguments[1]);
        (outputArguments[0] as Variant).dataType.should.eql(DataType.UInt32);
        (outputArguments[1] as Variant).dataType.should.eql(DataType.UInt32);
        result.statusCode?.should.eql(StatusCodes.BadBoundNotFound);
    });
});

describe("testing Method calling", () => {
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

    it("should return BadMethodInvalid if methodId is invalid", async () => {
        const server = rootFolder.objects.server;
        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];

        const pseudoSession = new PseudoSession(addressSpace);

        const result = await pseudoSession.call({
            objectId: server.nodeId,
            methodId: "ns=0;i=2258", // not a method
            inputArguments
        });

        should(result.statusCode).eql(StatusCodes.BadMethodInvalid);
    });
    it("should return BadMethodInvalid if methodId node does'nt exist", async () => {
        const server = rootFolder.objects.server;
        const inputArguments = [{ dataType: DataType.UInt32, value: 5 }];

        const pseudoSession = new PseudoSession(addressSpace);

        const result = await pseudoSession.call({
            objectId: server.nodeId,
            methodId: "ns=10;s=NotExistingNode", // not a valid node
            inputArguments
        });

        should(result.statusCode).eql(StatusCodes.BadMethodInvalid);
    });
});

describe("US-030: method call interceptors and afterCall event", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    function createBoundMethod(): UAMethod {
        const obj = namespace.addObject({ browseName: `TestObj_${Math.random().toString(36).slice(2)}` });
        const method = namespace.addMethod(obj, {
            browseName: `TestMethod_${Math.random().toString(36).slice(2)}`,
            executable: true,
            inputArguments: [{ name: "a", dataType: DataType.UInt32 }],
            outputArguments: [{ name: "result", dataType: DataType.UInt32 }]
        });
        method.bindMethod(async function (this: UAMethod, _inputArguments: Variant[], _ctx: ISessionContext) {
            return {
                statusCode: StatusCodes.Good,
                outputArguments: [{ dataType: DataType.UInt32, value: 42 }]
            };
        });
        return method;
    }

    it("should allow method call when no interceptors registered", async () => {
        const method = createBoundMethod();
        const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
        should(result?.statusCode).eql(StatusCodes.Good);
        should.exist(result?.outputArguments?.[0]);
        should(result?.outputArguments?.[0]?.value).eql(42);
    });

    it("should reject method call when sync interceptor returns non-Good", async () => {
        const method = createBoundMethod();
        let methodBodyCalled = false;
        method.bindMethod(async function (this: UAMethod, _inputArguments: Variant[], _ctx: ISessionContext) {
            methodBodyCalled = true;
            return { statusCode: StatusCodes.Good };
        });

        const interceptor: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            return StatusCodes.BadUserAccessDenied;
        };
        addressSpace.addMethodCallInterceptor(interceptor);

        try {
            const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
            should(result.statusCode).eql(StatusCodes.BadUserAccessDenied);
            methodBodyCalled.should.eql(false, "method body should not be called when interceptor rejects");
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor);
        }
    });

    it("should reject method call when async interceptor returns non-Good", async () => {
        const method = createBoundMethod();
        let methodBodyCalled = false;
        method.bindMethod(async function (this: UAMethod, _inputArguments: Variant[], _ctx: ISessionContext) {
            methodBodyCalled = true;
            return { statusCode: StatusCodes.Good };
        });

        const interceptor: MethodCallInterceptor = async (_ctx, _obj, _m, _args) => {
            await new Promise((resolve) => setImmediate(resolve));
            return StatusCodes.BadNotExecutable;
        };
        addressSpace.addMethodCallInterceptor(interceptor);

        try {
            const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
            should(result.statusCode).eql(StatusCodes.BadNotExecutable);
            methodBodyCalled.should.eql(false, "method body should not be called when async interceptor rejects");
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor);
        }
    });

    it("should allow method call when interceptor returns Good", async () => {
        const method = createBoundMethod();

        const interceptor: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            return StatusCodes.Good;
        };
        addressSpace.addMethodCallInterceptor(interceptor);

        try {
            const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
            should(result.statusCode).eql(StatusCodes.Good);
            should(result.outputArguments?.[0]?.value).eql(42);
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor);
        }
    });

    it("should short-circuit when first of two interceptors rejects", async () => {
        const method = createBoundMethod();
        const callOrder: string[] = [];

        const interceptor1: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            callOrder.push("interceptor1");
            return StatusCodes.BadUserAccessDenied;
        };
        const interceptor2: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            callOrder.push("interceptor2");
            return StatusCodes.Good;
        };
        addressSpace.addMethodCallInterceptor(interceptor1);
        addressSpace.addMethodCallInterceptor(interceptor2);

        try {
            const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
            result.statusCode?.should.eql(StatusCodes.BadUserAccessDenied);
            callOrder.should.eql(["interceptor1"], "second interceptor should not run");
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor1);
            addressSpace.removeMethodCallInterceptor(interceptor2);
        }
    });

    it("should run all interceptors in order when all return Good", async () => {
        const method = createBoundMethod();
        const callOrder: string[] = [];

        const interceptor1: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            callOrder.push("first");
            return StatusCodes.Good;
        };
        const interceptor2: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            callOrder.push("second");
            return StatusCodes.Good;
        };
        addressSpace.addMethodCallInterceptor(interceptor1);
        addressSpace.addMethodCallInterceptor(interceptor2);

        try {
            const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
            should(result.statusCode).eql(StatusCodes.Good);
            callOrder.should.eql(["first", "second"]);
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor1);
            addressSpace.removeMethodCallInterceptor(interceptor2);
        }
    });

    it("should not invoke interceptor after removeMethodCallInterceptor", async () => {
        const method = createBoundMethod();

        const interceptor: MethodCallInterceptor = (_ctx, _obj, _m, _args) => {
            return StatusCodes.BadNotExecutable;
        };
        addressSpace.addMethodCallInterceptor(interceptor);
        addressSpace.removeMethodCallInterceptor(interceptor);

        const result = await method.execute(null, [{ dataType: DataType.UInt32, value: 1 }], context);
        should(result.statusCode).eql(StatusCodes.Good);
    });

    it("should emit afterCall event with correct arguments", async () => {
        const method = createBoundMethod();
        let afterCallFired = false;
        let receivedContext: ISessionContext | undefined;
        let receivedResult: CallMethodResultOptions | undefined;

        method.on("afterCall", (ctx: ISessionContext, _args: Variant[], res: CallMethodResultOptions) => {
            afterCallFired = true;
            receivedContext = ctx;
            receivedResult = res;
        });

        const _result = await method.execute(null, [{ dataType: DataType.UInt32, value: 5 }], context);

        afterCallFired.should.eql(true, "afterCall event should fire");
        should(receivedContext).eql(context);
        should(receivedResult?.statusCode).eql(StatusCodes.Good);
        should.exist(receivedResult?.outputArguments?.[0]);
        should(receivedResult?.outputArguments?.[0]?.value).eql(42);
    });

    it("should receive correct method and object in interceptor", async () => {
        const obj = namespace.addObject({ browseName: "InterceptorTestObj" });
        const method = namespace.addMethod(obj, {
            browseName: "InterceptorTestMethod",
            executable: true,
            inputArguments: [],
            outputArguments: []
        });
        method.bindMethod(async function (this: UAMethod, _inputArguments: Variant[], _ctx: ISessionContext) {
            return { statusCode: StatusCodes.Good };
        });

        let receivedMethod: UAMethod | undefined;
        let receivedObject: UAObject | UAObjectType | null | undefined;

        const interceptor: MethodCallInterceptor = (_ctx, o, m, _args) => {
            receivedMethod = m;
            receivedObject = o;
            return StatusCodes.Good;
        };
        addressSpace.addMethodCallInterceptor(interceptor);

        try {
            await method.execute(obj, [], context);
            should(receivedMethod?.nodeId).eql(method.nodeId);
            should(receivedObject?.nodeId).eql(obj.nodeId);
        } finally {
            addressSpace.removeMethodCallInterceptor(interceptor);
        }
    });
});
