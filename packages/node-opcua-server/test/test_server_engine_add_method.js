
const {
    resolveNodeId,
    NodeId
} = require("node-opcua-nodeid");
const {
    VariantArrayType,
    DataType
} = require("node-opcua-variant");
const {
    StatusCodes
} = require("node-opcua-status-code");
const {
    NodeClass
} = require("node-opcua-data-model");
const {
    getMethodDeclaration_ArgumentList,
    SessionContext,
    UAMethod
} = require("node-opcua-address-space");
const {
    BrowsePath
} = require("node-opcua-service-translate-browse-path");

let engine, FolderTypeId, BaseDataVariableTypeId, ref_Organizes_Id;


const { ServerEngine } = require("..");
const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const mini_nodeset_filename = get_mini_nodeset_filename();


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine - addMethod", function() {

    let addressSpace; let namespace;
    before(function(done) {

        engine = new ServerEngine();

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function() {

            addressSpace = engine.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            FolderTypeId = addressSpace.findObjectType("FolderType").nodeId;
            BaseDataVariableTypeId = addressSpace.findVariableType("BaseDataVariableType").nodeId;
            ref_Organizes_Id = addressSpace.findReferenceType("Organizes").nodeId;
            ref_Organizes_Id.toString().should.eql("ns=0;i=35");

            done();
        });

    });
    after(async () => {
        await engine.shutdown();
        engine = null;
    });


    it("should be able to attach a method on a object of the address space and call it", function(done) {


        const objectFolder = engine.addressSpace.findNode("ObjectsFolder");

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
        const objectMethod = object.getMethodById(method.nodeId);
        (objectMethod !== null && typeof objectMethod === "object").should.eql(true);

        const arg = getMethodDeclaration_ArgumentList(engine.addressSpace, object.nodeId, method.nodeId);

        arg.statusCode.should.eql(StatusCodes.Good);
        arg.methodDeclaration.should.eql(objectMethod);

        const methodInputArguments = objectMethod.getInputArguments();
        Array.isArray(methodInputArguments).should.eql(true);

        const methodOutputArguments = objectMethod.getOutputArguments();
        Array.isArray(methodOutputArguments).should.eql(true);

        method.bindMethod(function(inputArguments, context, callback) {

            const nbBarks = inputArguments[0].value;
            const barks = [];
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
            callback(null, callMethodResult);
        });
        // now call it
        const inputArguments = [{ dataType: DataType.UInt32, value: 3 }];

        const context = new SessionContext({});


        // it should be possible to find the InputArguments and OutputArguments property
        // using translate browse path

        const hasPropertyRefId = resolveNodeId("HasProperty");
        /* NodeId  ns=0;i=46*/
        const browsePath = [{
            startingNode: /* NodeId  */ method.nodeId,
            relativePath: /* RelativePath   */  {
                elements: /* RelativePathElement */[
                    {
                        referenceTypeId: hasPropertyRefId,
                        isInverse: false,
                        includeSubtypes: false,
                        targetName: { namespaceIndex: 0, name: "InputArguments" }
                    }
                ]
            }
        }, {
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

        let result = engine.browsePath(new BrowsePath(browsePath[0]));
        result.statusCode.should.eql(StatusCodes.Good);

        result = engine.browsePath(new BrowsePath(browsePath[1]));
        result.statusCode.should.eql(StatusCodes.Good);

        objectMethod.execute(null, inputArguments, context, (err, callMethodResponse) => {

            callMethodResponse.statusCode.should.eql(StatusCodes.Good);
            callMethodResponse.outputArguments.length.should.eql(1);
            callMethodResponse.outputArguments[0].value.should.eql(["Whaff", "Whaff", "Whaff"]);
            // xx console.log(" Result = ", callMethodResponse.outputArguments[0].value);
            done(err);
        });

    });

});
