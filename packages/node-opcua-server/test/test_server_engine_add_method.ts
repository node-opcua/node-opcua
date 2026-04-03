import "should";
import {
    getMethodDeclaration_ArgumentList,
    type IAddressSpace,
    type INamespace,
    type ISessionContext,
    SessionContext,
    type UAMethod
} from "node-opcua-address-space";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { BrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source";

const mini_nodeset_filename = get_mini_nodeset_filename();

describe("ServerEngine - addMethod", () => {
    let addressSpace: IAddressSpace;
    let namespace: INamespace;
    let _FolderTypeId: NodeId;
    let _BaseDataVariableTypeId: NodeId;
    let ref_Organizes_Id: NodeId;

    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine();

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => {
            if (!engine.addressSpace) {
                throw new Error("addressSpace is null");
            }
            addressSpace = engine.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            const folderType = addressSpace.findObjectType("FolderType");
            if (!folderType) throw new Error("FolderType not found");
            _FolderTypeId = folderType.nodeId;

            const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");
            if (!baseDataVariableType) throw new Error("BaseDataVariableType not found");
            _BaseDataVariableTypeId = baseDataVariableType.nodeId;

            const organizesRef = addressSpace.findReferenceType("Organizes");
            if (!organizesRef) throw new Error("Organizes not found");
            ref_Organizes_Id = organizesRef.nodeId;
            ref_Organizes_Id.toString().should.eql("ns=0;i=35");

            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    it("should be able to attach a method on a object of the address space and call it", async () => {
        const objectFolder = addressSpace.findNode("ObjectsFolder");
        if (!objectFolder) throw new Error("ObjectsFolder not found");

        const object = namespace.addObject({
            organizedBy: objectFolder,
            browseName: "MyObject",
            nodeId: "s=MyObject"
        });

        const method = namespace.addMethod(object, {
            browseName: "Bark",

            inputArguments: [
                {
                    name: "nbBarks",
                    description: { text: "specifies the number of time I should bark" },
                    dataType: DataType.UInt32
                }
            ],

            outputArguments: [
                {
                    name: "Barks",
                    description: { text: "the generated barks" },
                    dataType: DataType.String,
                    valueRank: 1
                }
            ]
        });

        method.nodeClass.should.eql(NodeClass.Method);

        method.nodeId.should.be.instanceOf(NodeId);
        const objectMethod = object.getMethodById(method.nodeId) as UAMethod;
        (objectMethod !== null && typeof objectMethod === "object").should.eql(true);

        const arg = getMethodDeclaration_ArgumentList(addressSpace, object.nodeId, method.nodeId);

        arg.statusCode.should.eql(StatusCodes.Good);
        if (!arg.methodDeclaration) throw new Error("methodDeclaration is null");
        arg.methodDeclaration.should.eql(objectMethod);

        const methodInputArguments = objectMethod.getInputArguments();
        Array.isArray(methodInputArguments).should.eql(true);

        const methodOutputArguments = objectMethod.getOutputArguments();
        Array.isArray(methodOutputArguments).should.eql(true);

        method.bindMethod(async (inputArguments: Variant[], _context?: ISessionContext) => {
            const nbBarks: number = inputArguments[0].value;
            const barks: string[] = [];
            for (let i = 0; i < nbBarks; i++) {
                barks.push("Whaff");
            }
            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [
                    {
                        dataType: DataType.String,
                        arrayType: VariantArrayType.Array,
                        value: barks
                    }
                ]
            };
            return callMethodResult;
        });
        // now call it
        const inputArguments = [{ dataType: DataType.UInt32, value: 3 }];

        const context = new SessionContext({});

        // it should be possible to find the InputArguments and OutputArguments property
        // using translate browse path

        const hasPropertyRefId = resolveNodeId("HasProperty");
        /* NodeId  ns=0;i=46*/
        const browsePath = [
            {
                startingNode: /* NodeId  */ method.nodeId,
                relativePath: /* RelativePath   */ {
                    elements: /* RelativePathElement */ [
                        {
                            referenceTypeId: hasPropertyRefId,
                            isInverse: false,
                            includeSubtypes: false,
                            targetName: { namespaceIndex: 0, name: "InputArguments" }
                        }
                    ]
                }
            },
            {
                startingNode: method.nodeId,
                relativePath: {
                    elements: [
                        {
                            referenceTypeId: hasPropertyRefId,
                            isInverse: false,
                            includeSubtypes: false,
                            targetName: { name: "OutputArguments" }
                        }
                    ]
                }
            }
        ];

        let result = await engine.translateBrowsePath(new BrowsePath(browsePath[0]));
        result.statusCode.should.eql(StatusCodes.Good);

        result = await engine.translateBrowsePath(new BrowsePath(browsePath[1]));
        result.statusCode.should.eql(StatusCodes.Good);

        const callMethodResponse = await objectMethod.execute(null, inputArguments, context);
        if (!callMethodResponse.statusCode) throw new Error("statusCode is null");
        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
        if (!callMethodResponse.outputArguments) throw new Error("outputArguments is null");
        callMethodResponse.outputArguments.length.should.eql(1);
        should(callMethodResponse.outputArguments[0]?.value).eql(["Whaff", "Whaff", "Whaff"]);
    });
});
