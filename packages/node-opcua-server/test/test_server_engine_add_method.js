const _ = require("underscore");
const should = require("should");

const server_engine = require("../src/server_engine");

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const DataType = require("node-opcua-variant").DataType;
const NodeId = require("node-opcua-nodeid").NodeId;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

let engine, FolderTypeId, BaseDataVariableTypeId, ref_Organizes_Id;

const getMethodDeclaration_ArgumentList = require("node-opcua-address-space").getMethodDeclaration_ArgumentList;
const UAMethod = require("node-opcua-address-space").UAMethod;
const SessionContext = require("node-opcua-address-space").SessionContext;

const translate_service = require("node-opcua-service-translate-browse-path");


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine - addMethod", function () {

    before(function (done) {

        engine = new server_engine.ServerEngine();

        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {

            FolderTypeId = engine.addressSpace.findObjectType("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findVariableType("BaseDataVariableType").nodeId;
            ref_Organizes_Id = engine.addressSpace.findReferenceType("Organizes").nodeId;
            ref_Organizes_Id.toString().should.eql("ns=0;i=35");

            done();
        });

    });
    after(function () {
        engine.shutdown();
        engine = null;
    });


    it("should be able to attach a method on a object of the address space and call it", function (done) {


        const objectFolder = engine.addressSpace.findNode("ObjectsFolder");

        const object = engine.addressSpace.addObject({
            organizedBy: objectFolder,
            browseName: "MyObject",
            nodeId: "ns=1;s=MyObject"
        });

        const method = engine.addressSpace.addMethod(object, {
            browseName: "Bark",

            inputArguments: [
                {
                    name: "nbBarks",
                    description: {text: "specifies the number of time I should bark"},
                    dataType: DataType.UInt32
                }
            ],

            outputArguments: [
                {
                    name: "Barks",
                    description: {text: "the generated barks"},
                    dataType: DataType.String,
                    valueRank: 1

                }
            ]
        });

        method.should.be.instanceOf(UAMethod);

        method.nodeId.should.be.instanceOf(NodeId);
        const objectMethod = object.getMethodById(method.nodeId);
        _.isObject(objectMethod).should.eql(true);

        const arg = getMethodDeclaration_ArgumentList(engine.addressSpace, object.nodeId, method.nodeId);

        arg.statusCode.should.eql(StatusCodes.Good);
        arg.methodDeclaration.should.eql(objectMethod);

        const methodInputArguments = objectMethod.getInputArguments();
        _.isArray(methodInputArguments).should.eql(true);

        const methodOutputArguments = objectMethod.getOutputArguments();
        _.isArray(methodOutputArguments).should.eql(true);

        method.bindMethod(function (inputArguments, context, callback) {

            const nbBarks = inputArguments[0].value;
            console.log("Hello World ! I will bark ", nbBarks, "times");
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
        const inputArguments = [{dataType: DataType.UInt32, value: 3}];

        const context = new SessionContext({});


        // it should be possible to find the InputArguments and OutputArguments property
        // using translate browse path

        const hasPropertyRefId = resolveNodeId("HasProperty");
        /* NodeId  ns=0;i=46*/
        const browsePath = [{
            startingNode: /* NodeId  */ method.nodeId,
            relativePath: /* RelativePath   */  {
                elements: /* RelativePathElement */ [
                    {
                        referenceTypeId: hasPropertyRefId,
                        isInverse: false,
                        includeSubtypes: false,
                        targetName: {namespaceIndex: 0, name: "InputArguments"}
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
                        targetName: {name: "OutputArguments"}
                    }
                ]
            }
        }
        ];

        let result = engine.browsePath(new translate_service.BrowsePath(browsePath[0]));
        result.statusCode.should.eql(StatusCodes.Good);

        result = engine.browsePath(new translate_service.BrowsePath(browsePath[1]));
        result.statusCode.should.eql(StatusCodes.Good);

        objectMethod.execute(inputArguments, context, function (err, callMethodResponse) {

            done(err);
            callMethodResponse.statusCode.should.eql(StatusCodes.Good);
            callMethodResponse.outputArguments.length.should.eql(1);
            callMethodResponse.outputArguments[0].value.should.eql(["Whaff", "Whaff", "Whaff"]);
            console.log(" Result = ", callMethodResponse.outputArguments[0].value);
        });

    });

});
