/* eslint-disable no-prototype-builtins */
/* eslint-disable max-statements */
/// <reference types=".." />
/* jslint */
"use strict";
const should = require("should");
const util = require("util");

const { assert } = require("node-opcua-assert");
const {
    SessionContext,
} = require("node-opcua-address-space");
const {
    ServerState,
} = require("node-opcua-common");
const {
    VariableIds,
    ObjectIds
} = require("node-opcua-constants");
const {
    NodeClass,
    QualifiedName,
    AttributeIds,
    BrowseDirection,
    LocalizedText,
    ResultMask
} = require("node-opcua-data-model");
const {
    DataValue
} = require("node-opcua-data-value");
const {
    coerceNodeId,
    resolveNodeId,
    makeNodeId,
    makeExpandedNodeId,
    NodeId
} = require("node-opcua-nodeid");
const {
    BrowseRequest,
    BrowseDescription
} = require("node-opcua-service-browse");
const {
    TimestampsToReturn,
    ReadRequest,
    ReadValueId,
} = require("node-opcua-service-read");
const {
    HistoryReadRequest,
    HistoryReadDetails,
    HistoryReadResult,
    HistoryData
} = require("node-opcua-service-history");
const {
    StatusCodes
} = require("node-opcua-status-code");
const {
    DataType, Variant, VariantArrayType
} = require("node-opcua-variant");
const { assert_arrays_are_equal } = require("node-opcua-test-helpers");


const { ServerEngine } = require("..");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const mini_nodeset_filename = get_mini_nodeset_filename();

const { nodesets } = require("node-opcua-nodesets");

const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
const context = SessionContext.defaultContext;

function resolveExpandedNodeId(nodeId) {
    return makeExpandedNodeId(resolveNodeId(nodeId));
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing ServerEngine", () => {

    let engine, namespace, FolderTypeId, BaseDataVariableTypeId, ref_Organizes_Id;

    const defaultBuildInfo = {
        manufacturerName: "<Manufacturer>",
        productName: "NODEOPCUA-SERVER",
        productUri: "URI:NODEOPCUA-SERVER",
        softwareVersion: "1.0",
    };

    before(function(done) {

        engine = new ServerEngine({ buildInfo: defaultBuildInfo });

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => {

            const addressSpace = engine.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            FolderTypeId = addressSpace.findObjectType("FolderType").nodeId;
            BaseDataVariableTypeId = addressSpace.findVariableType("BaseDataVariableType").nodeId;
            ref_Organizes_Id = addressSpace.findReferenceType("Organizes").nodeId;
            ref_Organizes_Id.toString().should.eql("ns=0;i=35");

            // add a variable as a Array of Double with some values
            const testArray = [];
            for (let i = 0; i < 10; i++) {
                testArray.push(i * 1.0);
            }

            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "TestArray",
                nodeId: "s=TestArray",
                dataType: "Double",
                value: {
                    get: function() {
                        return new Variant({
                            dataType: DataType.Double,
                            arrayType: VariantArrayType.Array,
                            value: testArray
                        });
                    },
                    set: null // read only
                }
            }
            );

            // add a writable Int32
            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "WriteableInt32",
                nodeId: "s=WriteableInt32",
                dataType: "Int32",
                value: {
                    get: function() {
                        return new Variant({
                            dataType: DataType.Double,
                            arrayType: VariantArrayType.Array,
                            value: testArray
                        });
                    },
                    set: function(variant) {
                        // Variation 1 : synchronous
                        // assert(typeof callback === "function");
                        return StatusCodes.Good;
                    }
                }
            }
            );

            // add a writable Int32
            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "WriteableUInt32Async",
                nodeId: "s=WriteableUInt32Async",
                dataType: "UInt32",
                value: {
                    get: function() {
                        return new Variant({
                            dataType: DataType.Double,
                            arrayType: VariantArrayType.Array,
                            value: testArray
                        });
                    }

                }
            }
            );

            const newFolderWithFilteredItems = namespace.addFolder("ObjectsFolder", {
                browseName: "filteredItemsFolder"
            });

            function check_if_allow(n, context/*: SessionContext*/) {
                if (context && context.session && context.session.hasOwnProperty("testFilterArray")) {
                    if (context.session["testFilterArray"].indexOf(n) > -1) {
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    return true;
                }
            }
            const newFolder1 = namespace.addFolder(newFolderWithFilteredItems, {
                browseName: "filteredFolder1",
                browseFilter: check_if_allow.bind(null, 1)
            });
            assert(newFolder1);

            const newFolder2 = namespace.addFolder(newFolderWithFilteredItems, {
                browseName: "filteredFolder2",

                browseFilter: check_if_allow.bind(null, 2)
            });
            assert(newFolder2);

            const newFolder3 = namespace.addFolder(newFolderWithFilteredItems, {
                browseName: "filteredFolder3",
                browseFilter: check_if_allow.bind(null, 3)
            });
            assert(newFolder3);

            done();
        });

    });

    after(async () => {
        await engine.shutdown();
        engine = null;
    });

    it("should have a rootFolder ", () => {

        engine.addressSpace.rootFolder.typeDefinition.should.eql(FolderTypeId);

    });

    it("should find the rootFolder by browseName", () => {

        const browseNode = engine.addressSpace.findNode("RootFolder");

        browseNode.typeDefinition.should.eql(FolderTypeId);
        browseNode.should.equal(engine.addressSpace.rootFolder);

    });

    it("should find the rootFolder by nodeId", () => {

        const browseNode = engine.addressSpace.findNode("i=84");

        browseNode.typeDefinition.should.eql(FolderTypeId);
        browseNode.should.equal(engine.addressSpace.rootFolder);

    });

    it("should have an 'Objects' folder", () => {

        const rootFolder = engine.addressSpace.rootFolder;


        assert(rootFolder.objects);
        rootFolder.objects.findReferences("Organizes", false)[0].nodeId.should.eql(rootFolder.nodeId);
        rootFolder.objects.typeDefinitionObj.browseName.toString().should.eql("FolderType");
        rootFolder.objects.typeDefinition.should.eql(FolderTypeId);
    });

    it("should have a 'Server' object in the Objects Folder", () => {

        const server = engine.addressSpace.rootFolder.objects.server;
        assert(server);
        server.findReferences("Organizes", false)[0].nodeId.should.eql(engine.addressSpace.rootFolder.objects.nodeId);

    });

    it("should have a 'Server.NamespaceArray' Variable ", () => {

        const server = engine.addressSpace.rootFolder.objects.server;

        const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray);
        const server_NamespaceArray = engine.addressSpace.findNode(server_NamespaceArray_Id);
        assert(server_NamespaceArray !== null);

        //xx console.log(require("util").inspect(server_NamespaceArray));

        server_NamespaceArray.should.have.property("parent");
        // TODO : should(server_NamespaceArray.parent !==  null).ok;
        server_NamespaceArray.parent.nodeId.should.eql(server.nodeId);


    });

    it("should have a 'Server.Server_ServerArray' Variable", () => {

        // find 'Objects' folder
        const objects = engine.addressSpace.rootFolder.objects;
        const server = objects.server;

        const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_ServerArray);
        const server_NamespaceArray = engine.addressSpace.findNode(server_NamespaceArray_Id);
        assert(server_NamespaceArray !== null);
        //xx server_NamespaceArray.parent.nodeId.should.eql(serverObject.nodeId);
    });

    it("should be possible to create a new folder under the 'Root' folder", () => {
        const namespace = engine.addressSpace.getOwnNamespace();

        // find 'Objects' folder
        const objects = engine.addressSpace.rootFolder.objects;

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolder");
        assert(newFolder);

        newFolder.typeDefinition.should.eql(FolderTypeId);
        newFolder.nodeClass.should.eql(NodeClass.Object);

        newFolder.findReferences("Organizes", false)[0].nodeId.should.eql(objects.nodeId);

    });

    it("should be possible to find a newly created folder by nodeId", () => {
        const namespace = engine.addressSpace.getOwnNamespace();

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolder");

        // a specific node id should have been assigned by the engine
        assert(newFolder.nodeId instanceof NodeId);
        newFolder.nodeId.namespace.should.eql(1);

        const result = engine.addressSpace.findNode(newFolder.nodeId);
        result.should.eql(newFolder);

    });

    it("should be possible to find a newly created folder by 'browse name'", () => {

        const namespace = engine.addressSpace.getOwnNamespace();
        const newFolder = namespace.addFolder("ObjectsFolder", "MySecondNewFolder");

        const result = engine.addressSpace.rootFolder.objects.getFolderElementByName("MySecondNewFolder");
        assert(result !== null);
        result.should.eql(newFolder);
    });

    xit("should not be possible to create a object with an existing 'browse name'", () => {

        const namespace = engine.addressSpace.getOwnNamespace();

        const newFolder1 = namespace.addFolder("ObjectsFolder", "NoUniqueName");

        (function() {
            namespace.addFolder("ObjectsFolder", "NoUniqueName");
        }).should.throw("browseName already registered");

        const result = engine.addressSpace.rootFolder.objects.getFolderElementByName("NoUniqueName");
        result.should.eql(newFolder1);
    });

    it("should be possible to create a variable in a folder", function(done) {

        const addressSpace = engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolder1");

        const newVariable = namespace.addVariable(
            {
                componentOf: newFolder,
                browseName: "Temperature",
                dataType: "Float",
                value: {
                    get: function() {
                        return new Variant({ dataType: DataType.Float, value: 10.0 });
                    },
                    set: function() {
                        return StatusCodes.BadNotWritable;
                    }
                }

            });
        newVariable.typeDefinition.should.equal(BaseDataVariableTypeId);
        newVariable.parent.nodeId.should.equal(newFolder.nodeId);

        newVariable.readValueAsync(context, function(err, dataValue) {
            if (!err) {
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.should.be.instanceOf(Variant);
                dataValue.value.value.should.equal(10.0);
            }
            done(err);
        });


    });

    it("should be possible to create a variable in a folder with a predefined nodeID", () => {

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolder3");

        const newVariable = namespace.addVariable({
            componentOf: newFolder,
            nodeId: "b=01020304ffaa",  // << fancy node id here !
            browseName: "Temperature",
            dataType: "Double",
            value: {
                get: function() {
                    return new Variant({ dataType: DataType.Double, value: 10.0 });
                },
                set: function() {
                    return StatusCodes.BadNotWritable;
                }
            }

        });

        newVariable.nodeId.toString().should.eql("ns=1;b=01020304ffaa");

    });

    it("should be possible to create a variable in a folder that returns a timestamped value", function(done) {

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolder4");

        const temperature = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 10.0 }),
            sourceTimestamp: new Date(Date.UTC(1999, 9, 9)),
            sourcePicoseconds: 10
        });

        const newVariable = namespace.addVariable({
            componentOf: newFolder,
            browseName: "TemperatureWithSourceTimestamps",
            dataType: "Double",
            value: {
                timestamped_get: function() {
                    return temperature;
                }
            }
        });


        newVariable.readValueAsync(context, function(err, dataValue) {

            if (!err) {

                dataValue = newVariable.readAttribute(context, AttributeIds.Value, undefined, undefined);
                dataValue.should.be.instanceOf(DataValue);
                dataValue.sourceTimestamp.should.eql(new Date(Date.UTC(1999, 9, 9)));
                dataValue.sourcePicoseconds.should.eql(10);

            }
            done(err);
        });

    });

    it("should be possible to create a variable that returns historical data", function(done) {

        const newFolder = namespace.addFolder("ObjectsFolder", "MyNewFolderHistorical1");

        const readValue = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 10.0 }),
            sourceTimestamp: new Date(Date.UTC(1999, 9, 9)),
            sourcePicoseconds: 10
        });

        const newVariable = namespace.addVariable({
            componentOf: newFolder,
            browseName: "TemperatureHistorical",
            dataType: "Double",
            historizing: true,
            userAccessLevel: 7,
            value: {
                timestamped_get: function() {
                    return (readValue);
                },
                historyRead: function(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {

                    assert(context instanceof SessionContext);
                    assert(callback instanceof Function);

                    const results = [];
                    const d = new Date();
                    d.setUTCMinutes(0);
                    d.setUTCSeconds(0);
                    d.setUTCMilliseconds(0);
                    for (let i = 0; i < 50; i++) {
                        d.setUTCMinutes(i);
                        results.push(new DataValue({
                            value: { dataType: DataType.Double, value: Math.random() * 75 - 25 },
                            sourceTimestamp: d
                        }));
                    }

                    const historyReadResult = new HistoryReadResult({
                        historyData: new HistoryData({
                            dataValues: results
                        })
                    });
                    callback(null, historyReadResult);
                }
            }
        });

        const historyReadRequest = new HistoryReadRequest({
            historyReadDetails: new HistoryReadDetails(),
            timestampsToReturn: 3,
            nodesToRead: [{
                nodeId: newVariable.nodeId,
                continuationPoint: null
            }]
        });

        engine.historyRead(context, historyReadRequest, function(err, historyReadResult) {
            historyReadResult[0].should.be.instanceOf(HistoryReadResult);
            historyReadResult[0].historyData.dataValues.length.should.eql(50);

            done(err);
        });

    });

    it("should be possible to create a object in a folder", () => {

        const simulation = namespace.addObject({
            organizedBy: "ObjectsFolder",
            browseName: "Scalar_Simulation",
            description: "This folder will contain one item per supported data-type.",
            nodeId: makeNodeId(4000, 1)
        });

    });

    it("should browse the 'Objects' folder for back references", () => {

        const browseDescription = {
            browseDirection: BrowseDirection.Inverse,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3F
        };

        const browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);

        browseResult.statusCode.should.eql(StatusCodes.Good);
        browseResult.references.length.should.equal(1);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(false);
        browseResult.references[0].browseName.name.should.equal("Root");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=84");
        //xx browseResult.references[0].displayName.text.should.equal("Root");
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);

    });

    it("should browse root folder with referenceTypeId", () => {

        const browseDescription = {
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "Organizes",
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        const browseResult = engine.browseSingleNode("RootFolder", browseDescription);

        const browseNames = browseResult.references.map(function(r) {
            return r.browseName.name;
        });
        //xx console.log(browseNames);

        browseResult.statusCode.should.eql(StatusCodes.Good);

        browseResult.references.length.should.equal(3);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        browseResult.references[0].displayName.text.should.equal("Objects");
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[1].isForward.should.equal(true);
        browseResult.references[1].browseName.name.should.equal("Types");
        browseResult.references[1].nodeId.toString().should.equal("ns=0;i=86");
        browseResult.references[1].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[1].nodeClass.should.eql(NodeClass.Object);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[2].isForward.should.equal(true);
        browseResult.references[2].browseName.name.should.equal("Views");
        browseResult.references[2].nodeId.toString().should.equal("ns=0;i=87");
        browseResult.references[2].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[2].nodeClass.should.eql(NodeClass.Object);

    });

    it("should browse root and find all hierarchical children of the root node (includeSubtypes: true)", () => {

        const browseDescription1 = {
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "Organizes",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        const browseResult1 = engine.browseSingleNode("RootFolder", browseDescription1);
        browseResult1.references.length.should.equal(3);

        const browseDescription2 = {
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true, // should include also HasChild , Organizes , HasEventSource etc ...
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };
        const browseResult2 = engine.browseSingleNode("RootFolder", browseDescription2);
    });

    it("should browse root folder with abstract referenceTypeId and includeSubtypes set to true", () => {

        const ref_hierarchical_Ref_Id = engine.addressSpace.findReferenceType("HierarchicalReferences").nodeId;
        ref_hierarchical_Ref_Id.toString().should.eql("ns=0;i=33");

        const browseDescription = new BrowseDescription({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: ref_hierarchical_Ref_Id,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        });
        browseDescription.browseDirection.should.eql(BrowseDirection.Both);

        const browseResult = engine.browseSingleNode("RootFolder", browseDescription);

        browseResult.statusCode.should.eql(StatusCodes.Good);

        browseResult.references.length.should.equal(3);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[0].isForward.should.equal(true);
        browseResult.references[0].browseName.name.should.equal("Objects");
        browseResult.references[0].nodeId.toString().should.equal("ns=0;i=85");
        browseResult.references[0].displayName.text.should.equal("Objects");
        browseResult.references[0].nodeClass.should.eql(NodeClass.Object);
        browseResult.references[0].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[1].isForward.should.equal(true);
        browseResult.references[1].browseName.name.should.equal("Types");
        browseResult.references[1].nodeId.toString().should.equal("ns=0;i=86");
        browseResult.references[1].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[1].nodeClass.should.eql(NodeClass.Object);

        browseResult.references[0].referenceTypeId.should.eql(ref_Organizes_Id);
        browseResult.references[2].isForward.should.equal(true);
        browseResult.references[2].browseName.name.should.equal("Views");
        browseResult.references[2].nodeId.toString().should.equal("ns=0;i=87");
        browseResult.references[2].typeDefinition.should.eql(resolveExpandedNodeId("FolderType"));
        browseResult.references[2].nodeClass.should.eql(NodeClass.Object);

    });

    it("should browse a 'Server' object in  the 'Objects' folder", () => {

        const browseDescription = {
            browseDirection: BrowseDirection.Forward,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3F
        };
        const browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);
        browseResult.statusCode.should.eql(StatusCodes.Good);

        browseResult.references.length.should.be.greaterThan(1);
        //xx console.log(browseResult.references[0].browseName.name);

        browseResult.references[0].browseName.name.should.equal("Server");

    });

    it("should handle a BrowseRequest and set StatusCode if node doesn't exist", () => {

        const browseDescription = {
            browseDirection: BrowseDirection.Forward,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3F
        };
        const browseResult = engine.browseSingleNode("ns=46;i=123456", browseDescription);
        browseResult.statusCode.should.equal(StatusCodes.BadNodeIdUnknown);
        browseResult.references.length.should.equal(0);
    });

    it("should handle a BrowseRequest and set StatusCode if browseDescription is not provided", () => {

        const browseResult = engine.browseSingleNode("ns=46;i=123456");
        browseResult.statusCode.should.equal(StatusCodes.BadBrowseDirectionInvalid);
        browseResult.references.length.should.equal(0);
    });

    it("should handle a BrowseRequest with multiple nodes to browse", () => {

        const browseRequest = new BrowseRequest({
            nodesToBrowse: [
                {
                    browseDirection: BrowseDirection.Both,
                    includeSubtypes: true,
                    nodeId: resolveNodeId("RootFolder"),
                    resultMask: 63
                },
                {
                    browseDirection: BrowseDirection.Both,
                    includeSubtypes: true,
                    nodeId: resolveNodeId("ObjectsFolder"),
                    resultMask: 63
                }
            ]
        });

        browseRequest.nodesToBrowse.length.should.equal(2);
        const results = engine.browse(browseRequest.nodesToBrowse);

        results.length.should.equal(2);

        // RootFolder should have 4 nodes ( 1 hasTypeDefinition , 3 sub-folders)
        results[0].references.length.should.equal(4);

    });

    it("should handle a BrowseRequest of a session with a filtered result", async () => {

        const objects = engine.addressSpace.rootFolder.objects;
        const filteredItemsFolder = objects.getFolderElementByName("filteredItemsFolder");
        const browseDescription = {
            nodesToBrowse: [{
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 1, // 1=Objects
                nodeId: filteredItemsFolder.nodeId,
                resultMask: 63,
            }],
        };

        const browseRequest = new BrowseRequest(browseDescription);
        const session = engine.createSession();

        const context = new SessionContext({ session });

        session.testFilterArray = [1, 3];
        const results1 = engine.browse(browseRequest.nodesToBrowse, context);
        results1[0].references.length.should.equal(2);

        session.testFilterArray = [1, 2, 3];
        const results2 = engine.browse(browseRequest.nodesToBrowse, context);
        results2[0].references.length.should.equal(3);

        session.testFilterArray = [3];
        const results3 = engine.browse(browseRequest.nodesToBrowse, context);
        results3[0].references.length.should.equal(1);
        results3[0].references[0].displayName.text.should.equal("filteredFolder3");

        await engine.closeSession(session.authenticationToken, true);

    });

    it("should provide results that conforms to browseDescription.resultMask", () => {


        function test_referenceDescription(referenceDescription, resultMask) {

            if (resultMask & ResultMask.ReferenceType) {
                should(referenceDescription.referenceTypeId).be.instanceOf(Object);
            } else {
                should(referenceDescription.referenceTypeId).be.eql(makeNodeId(0, 0));
            }
            if (resultMask & ResultMask.BrowseName) {
                should(referenceDescription.browseName).be.instanceOf(Object);
            } else {
                should(referenceDescription.browseName).be.eql(new QualifiedName({}));
            }
            if (resultMask & ResultMask.NodeClass) {
                should(referenceDescription.nodeClass).be.not.eql(NodeClass.Unspecified);
            } else {
                should(referenceDescription.nodeClass).be.eql(NodeClass.Unspecified);
            }
        }

        function test_result_mask(resultMask) {

            const browseDescription = {
                browseDirection: BrowseDirection.Both,
                referenceTypeId: "HierarchicalReferences",
                includeSubtypes: true,
                nodeClassMask: 0, // 0 = all nodes
                resultMask: resultMask
            };
            const browseResult = engine.browseSingleNode("ObjectsFolder", browseDescription);

            browseResult.references.length.should.be.greaterThan(1);
            for (const referenceDescription of browseResult.references) {
                test_referenceDescription(referenceDescription, resultMask);
            }

        }

        // ReferenceType
        test_result_mask(ResultMask.BrowseName);
        test_result_mask(ResultMask.NodeClass);
        test_result_mask(ResultMask.NodeClass & ResultMask.BrowseName);


    });

    it("browseWithAutomaticExpansion", async () => {

        const namespace = engine.addressSpace.getOwnNamespace();
        const expandableNode = namespace.addObject({
            browseName: "Expandable"
        });
        let nbCalls = 0;
        expandableNode.onFirstBrowseAction = async function() {
            nbCalls += 1;
            await new Promise((resolve) => {
                setTimeout(() => {
                    const addressSpace = this.addressSpace;
                    const namespace = addressSpace.getOwnNamespace();
                    namespace.addObject({
                        browseName: "SubObject1",
                        componentOf: this
                    });
                    namespace.addObject({
                        browseName: "SubObject2",
                        componentOf: this
                    });

                    resolve();
                }, 100);
            });
        };

        const nodesToBrowse = [
            {
                nodeId: expandableNode.nodeId,
                browseDirection: BrowseDirection.Forward,
                referenceTypeId: "HierarchicalReferences",
                includeSubtypes: true,
                nodeClassMask: 0, // 0 = all nodes
                resultMask: 63
            },
            {
                nodeId: expandableNode.nodeId,
                browseDirection: BrowseDirection.Both,
                referenceTypeId: "HierarchicalReferences",
                includeSubtypes: true,
                nodeClassMask: 0, // 0 = all nodes
                resultMask: 63
            }
        ]
        const browseResults = await engine.browseWithAutomaticExpansion(nodesToBrowse);
        browseResults.length.should.eql(2);
        browseResults[0].references.length.should.eql(2);
        browseResults[0].references[0].browseName.toString().should.eql("1:SubObject1");
        browseResults[0].references[1].browseName.toString().should.eql("1:SubObject2");
        browseResults[1].references.length.should.eql(2);
        browseResults[1].references[0].browseName.toString().should.eql("1:SubObject1");
        browseResults[1].references[1].browseName.toString().should.eql("1:SubObject2");


        nbCalls.should.eql(1, "Node must have been expanded only once");
    });

    describe("readSingleNode on Object", () => {

        it("should handle a readSingleNode - BrowseName", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.BrowseName);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.equal("Root");
        });

        it("should handle a readSingleNode - NodeClass", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.NodeClass);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Int32);
            readResult.value.value.should.equal(NodeClass.Object);
        });

        it("should handle a readSingleNode - NodeId", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.NodeId);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.NodeId);
            readResult.value.value.toString().should.equal("ns=0;i=84");
        });

        it("should handle a readSingleNode - DisplayName", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.DisplayName);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            readResult.value.value.text.toString().should.equal("Root");
        });

        it("should handle a readSingleNode - Description", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.Description);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            readResult.value.value.text.toString().should.equal("The root of the server address space.");
        });

        it("should handle a readSingleNode - WriteMask", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.WriteMask);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.UInt32);
            readResult.value.value.should.equal(0);
        });

        it("should handle a readSingleNode - UserWriteMask", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.UserWriteMask);
            readResult.value.dataType.should.eql(DataType.UInt32);
            readResult.value.value.should.equal(0);
        });

        it("should handle a readSingleNode - EventNotifier", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.EventNotifier);
            readResult.value.dataType.should.eql(DataType.Byte);
            readResult.value.value.should.equal(0);
        });

        it("should return BadAttributeIdInvalid  - readSingleNode - for bad attribute    ", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.ContainsNoLoops);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
            //xx assert(readResult.value);
        });
    });

    describe("readSingleNode on ReferenceType", () => {

        let ref_Organizes_nodeId;
        beforeEach(function() {
            ref_Organizes_nodeId = engine.addressSpace.findReferenceType("Organizes").nodeId;
        });

        //  --- on reference Type ....
        it("should handle a readSingleNode - IsAbstract", () => {

            const readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.IsAbstract);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });

        it("should handle a readSingleNode - Symmetric", () => {

            const readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.Symmetric);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
        });

        it("should handle a readSingleNode - InverseName", () => {

            const readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.InverseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.LocalizedText);
            //xx readResult.value.value.should.equal(false);
        });

        it("should handle a readSingleNode - BrowseName", () => {

            const readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.eql("Organizes");
            //xx readResult.value.value.should.equal(false);
        });
        it("should return BadAttributeIdInvalid on EventNotifier", () => {

            const readResult = engine.readSingleNode(context, ref_Organizes_nodeId, AttributeIds.EventNotifier);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
            assert(readResult.value === null || readResult.value.dataType === DataType.Null);
        });
    });

    describe("readSingleNode on VariableType", () => {
        //
        it("should handle a readSingleNode - BrowseName", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - IsAbstract", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.IsAbstract);

            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(false);
        });
        it("should handle a readSingleNode - Value", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.Value);
            readResult.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
        });

        it("should handle a readSingleNode - DataType", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.DataType);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ValueRank", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.ValueRank);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ArrayDimensions", () => {

            const readResult = engine.readSingleNode(context, "DataTypeDescriptionType", AttributeIds.ArrayDimensions);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.arrayType.should.eql(VariantArrayType.Array);
        });
    });

    describe("readSingleNode on Variable (ProductUri)", () => {
        const productUri_id = makeNodeId(2262, 0);
        it("should handle a readSingleNode - BrowseName", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.BrowseName);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - ArrayDimensions", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.ArrayDimensions);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.arrayType.should.eql(VariantArrayType.Array);
        });
        it("should handle a readSingleNode - AccessLevel", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.AccessLevel);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - UserAccessLevel", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.UserAccessLevel);
            readResult.statusCode.should.eql(StatusCodes.Good);
        });
        it("should handle a readSingleNode - MinimumSamplingInterval", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.MinimumSamplingInterval);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.value.should.eql(1000);
        });
        it("should handle a readSingleNode - Historizing", () => {

            const readResult = engine.readSingleNode(context, productUri_id, AttributeIds.Historizing);
            readResult.statusCode.should.eql(StatusCodes.Good);
            readResult.value.value.should.eql(false);
        });
    });

    describe("readSingleNode on View", () => {

        // for views
        xit("should handle a readSingleNode - ContainsNoLoops", () => {

            const readResult = engine.readSingleNode(context, "RootFolder", AttributeIds.ContainsNoLoops);
            readResult.value.dataType.should.eql(DataType.Boolean);
            readResult.value.value.should.equal(true);
        });
    });

    describe("readSingleNode on DataType", () => {
        // for views
        it("should have ServerStatusDataType dataType exposed", () => {
            const obj = engine.addressSpace.findDataType("ServerStatusDataType");
            obj.browseName.toString().should.eql("ServerStatusDataType");
            obj.nodeClass.should.eql(NodeClass.DataType);
        });
        it("should handle a readSingleNode - ServerStatusDataType - BrowseName", () => {

            const obj = engine.addressSpace.findDataType("ServerStatusDataType");
            const serverStatusDataType_id = obj.nodeId;
            const readResult = engine.readSingleNode(context, serverStatusDataType_id, AttributeIds.BrowseName);
            readResult.value.dataType.should.eql(DataType.QualifiedName);
            readResult.value.value.name.should.equal("ServerStatusDataType");
        });

        it("should handle a readSingleNode - ServerStatusDataType - Description", () => {

            const obj = engine.addressSpace.findDataType("ServerStatusDataType");
            const serverStatusDataType_id = obj.nodeId;
            const readResult = engine.readSingleNode(context, serverStatusDataType_id, AttributeIds.Description);
            readResult.value.dataType.should.eql(DataType.LocalizedText);

        });
    });

    it("should return BadNodeIdUnknown  - readSingleNode - with unknown object", () => {

        const readResult = engine.readSingleNode(context, "ns=0;s=**UNKNOWN**", AttributeIds.DisplayName);
        readResult.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
    });

    it("should read the display name of RootFolder", () => {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: resolveNodeId("RootFolder"),
                    attributeId: AttributeIds.DisplayName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });
        const dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);

    });

    describe("testing read with indexRange for attributes that can't be used with IndexRange ", () => {
        // see CTT Attribute Service, AttributeRead , Test-Case / Err015.js
        // Read a single node specifying an IndexRange for attributes that can't be used
        // with IndexRange, as in:
        // AccessLevel, BrowseName, DataType, DisplayName, Historizing, NodeClass, NodeId, UserAccessLevel, ValueRank
        // Expect BadIndexRangeNoData

        const nodeId = "ns=1;s=TestVar";
        before(() => {
            namespace.addVariable({
                browseName: "TestVar",
                dataType: "Double",
                nodeId: nodeId,
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                value: {
                    get: function() {
                        return new Variant({
                            dataType: DataType.Double,
                            value: 0
                        });
                    },
                    set: null // read only
                }
            }
            );
        });

        function read_shall_get_BadIndexRangeNoData(attributeId, done) {
            assert(attributeId >= 0 && attributeId < 22);
            const readRequest = new ReadRequest({
                maxAge: 0,
                nodesToRead: [
                    {
                        attributeId: attributeId,
                        dataEncoding: null, /* */
                        indexRange: "1:2",
                        nodeId: nodeId,
                    }
                ],
                timestampsToReturn: TimestampsToReturn.Both,
            });
            const dataValues = engine.read(context, readRequest);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            done();
        }

        const attributes = ["AccessLevel", "BrowseName", "DataType", "DisplayName", "Historizing", "NodeClass", "NodeId", "UserAccessLevel", "ValueRank"];
        attributes.forEach(function(attribute) {

            it("shall return BadIndexRangeNoData when performing a read with a  indexRange and attributeId = " + attribute + " ", function(done) {
                read_shall_get_BadIndexRangeNoData(AttributeIds[attribute], done);
            });

        });

        it("should return BadDataEncodingInvalid", () => {
            const readRequest = new ReadRequest({
                maxAge: 0,
                nodesToRead: [
                    {
                        attributeId: AttributeIds.Value,
                        dataEncoding: { name: "Invalid Data Encoding" }, // QualifiedName
                        indexRange: null,
                        nodeId: nodeId
                    }
                ],
                timestampsToReturn: TimestampsToReturn.Both
            });
            const dataValues = engine.read(context, readRequest);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.BadDataEncodingInvalid);
        });
        it("should return Good (dataEncoding = DefaultBinary) ", () => {
            const readRequest = new ReadRequest({
                maxAge: 0,
                nodesToRead: [
                    {
                        attributeId: AttributeIds.Value,
                        dataEncoding: { name: "DefaultBinary" },
                        indexRange: null,
                        nodeId: nodeId
                    }
                ],
                timestampsToReturn: TimestampsToReturn.Both
            });
            const dataValues = engine.read(context, readRequest);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.Good);
        });
    });

    describe("testing read operation with timestamps", () => {

        const nodesToRead =
            [
                {
                    nodeId: resolveNodeId("RootFolder"),
                    attributeId: AttributeIds.DisplayName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                },
                {
                    nodeId: resolveNodeId("RootFolder"),
                    attributeId: AttributeIds.BrowseName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                },
                {
                    nodeId: resolveNodeId("ns=0;i=2259"), //Server_serverStatus_State
                    attributeId: AttributeIds.Value,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ];
        it("should read and set the required timestamps : TimestampsToReturn.Neither", function(done) {

            const readRequest = new ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: nodesToRead
            });

            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {

                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(3);

                    dataValues[0].should.be.instanceOf(DataValue);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[0].serverTimestamp).eql(null);
                    should(dataValues[0].sourceTimestamp).eql(null);
                    should(dataValues[0].serverPicoseconds).eql(0);
                    should(dataValues[0].sourcePicoseconds).eql(0);

                    dataValues[1].should.be.instanceOf(DataValue);
                    dataValues[1].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[1].serverTimestamp).eql(null);
                    should(dataValues[1].sourceTimestamp).eql(null);
                    should(dataValues[1].serverPicoseconds).eql(0);
                    should(dataValues[1].sourcePicoseconds).eql(0);

                    dataValues[2].should.be.instanceOf(DataValue);
                    dataValues[2].statusCode.should.eql(StatusCodes.Good);
                    should(dataValues[2].serverTimestamp).eql(null);
                    should(dataValues[2].sourceTimestamp).eql(null);
                    should(dataValues[2].serverPicoseconds).eql(0);
                    should(dataValues[2].sourcePicoseconds).eql(0);
                }
                done(err);
            });

        });

        it("should read and set the required timestamps : TimestampsToReturn.Server", () => {

            const DataValue = require("node-opcua-data-value").DataValue;
            const readRequest = new ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Server,
                nodesToRead: nodesToRead
            });
            const dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[0].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourceTimestamp).be.eql(null);
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            dataValues[1].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[1].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourceTimestamp).be.eql(null);
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            dataValues[2].statusCode.should.eql(StatusCodes.Good);
            should(dataValues[2].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[2].serverPicoseconds).be.eql(0);
            should(dataValues[2].sourceTimestamp).be.eql(null);
            should(dataValues[2].sourcePicoseconds).be.eql(0);

        });

        it("should read and set the required timestamps : TimestampsToReturn.Source", () => {

            const DataValue = require("node-opcua-data-value").DataValue;
            const readRequest = new ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Source,
                nodesToRead: nodesToRead
            });

            const dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            dataValues[1].statusCode.should.eql(StatusCodes.Good);
            dataValues[2].statusCode.should.eql(StatusCodes.Good);

            should(dataValues[0].serverTimestamp).be.eql(null);
            should(dataValues[0].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            should(dataValues[1].serverTimestamp).be.eql(null);
            should(dataValues[1].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            should(dataValues[2].sourceTimestamp).be.instanceOf(Date);

        });

        it("should read and set the required timestamps : TimestampsToReturn.Both", () => {


            const DataValue = require("node-opcua-data-value").DataValue;
            const readRequest = new ReadRequest({
                maxAge: 0,
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: nodesToRead
            });
            const dataValues = engine.read(context, readRequest);

            dataValues.length.should.equal(3);
            dataValues[0].should.be.instanceOf(DataValue);
            dataValues[1].should.be.instanceOf(DataValue);
            dataValues[2].should.be.instanceOf(DataValue);

            should(dataValues[0].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[0].serverPicoseconds).be.eql(0);
            should(dataValues[0].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[0].sourcePicoseconds).be.eql(0);

            should(dataValues[1].serverTimestamp).be.instanceOf(Date);
            //xx should(dataValues[1].serverPicoseconds).be.eql(0);
            should(dataValues[1].sourceTimestamp).be.eql(null); /// SourceTimestamp only for AttributeIds.Value
            should(dataValues[1].sourcePicoseconds).be.eql(0);

            should(dataValues[2].sourceTimestamp).be.instanceOf(Date);

        });

    });

    it("should read Server_NamespaceArray ", function(done) {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                new ReadValueId({
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.DisplayName,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }),
                new ReadValueId({
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.Value,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                })
            ]
        });

        engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
            if (!err) {
                const dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(2);
                dataValues[0].value.value.text.should.eql("NamespaceArray");
                dataValues[1].value.value.should.be.instanceOf(Array);
                dataValues[1].value.value.length.should.be.eql(2);
            }
            done(err);
        });
    });

    it("should handle indexRange with individual value", function(done) {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                new ReadValueId({
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "2",     // <<<<<<<<<<<<<<<<<<<<<<<<<<
                    dataEncoding: null /* */
                })
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
            if (!err) {
                const dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.Good);

                dataValues[0].value.value.should.be.instanceOf(Float64Array);
                dataValues[0].value.value.length.should.be.eql(1);
                dataValues[0].value.value[0].should.be.eql(2.0);
            }
            done(err);
        });
    });

    it("should handle indexRange with a simple range", function(done) {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                new ReadValueId({
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "2:5",    // <<<<<<<<<<<<<<<<<<<<<<<<<<
                    dataEncoding: null /* */
                })
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
            if (!err) {
                const dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                dataValues[0].value.value.should.be.instanceOf(Float64Array);
                dataValues[0].value.value.length.should.be.eql(4);
                assert_arrays_are_equal(dataValues[0].value.value, new Float64Array([2.0, 3.0, 4.0, 5.0]));
            }
            done(err);
        });

    });

    it("should receive BadIndexRangeNoData when indexRange try to access outside boundary", function(done) {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                new ReadValueId({
                    nodeId: "ns=1;s=TestArray",
                    attributeId: AttributeIds.Value,
                    indexRange: "5000:6000",    // <<<<<<<<<<<<<<<<<<<<<<<<<< BAD BOUNDARY !!!
                    dataEncoding: null /* */
                })
            ]
        });
        engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
            if (!err) {
                const dataValues = engine.read(context, readRequest);
                dataValues.length.should.equal(1);
                dataValues[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            }
            done(err);
        });

    });

    it("should read Server_NamespaceArray  DataType", () => {
        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.DataType,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });
        const dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);
        dataValues[0].value.dataType.should.eql(DataType.NodeId);
        dataValues[0].value.value.toString().should.eql("ns=0;i=12"); // String
    });

    it("should read Server_NamespaceArray ValueRank", () => {

        const readRequest = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: server_NamespaceArray_Id,
                    attributeId: AttributeIds.ValueRank,
                    indexRange: null, /* ???? */
                    dataEncoding: null /* */
                }
            ]
        });

        const dataValues = engine.read(context, readRequest);
        dataValues.length.should.equal(1);
        dataValues[0].statusCode.should.eql(StatusCodes.Good);

        //xx console.log("xxxxxxxxx =  dataValues[0].value.value",typeof( dataValues[0].value.value), dataValues[0].value.value);
        dataValues[0].value.value.should.eql(VariantArrayType.Array);

    });

    describe("testing ServerEngine browsePath", () => {
        const translate_service = require("node-opcua-service-translate-browse-path");
        const nodeid = require("node-opcua-nodeid");

        it("translating a browse path to a nodeId with a invalid starting node shall return BadNodeIdUnknown", () => {
            const browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(0), // <=== invalid node id
                relativePath: []
            });

            const browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);

            browsePathResult.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
        });


        it("translating a browse path to a nodeId with an empty relativePath  shall return BadNothingToDo", () => {

            const browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84), // <=== valid node id
                relativePath: { elements: [] }         // <=== empty path
            });
            const browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);
        });

        it("The Server shall return BadBrowseNameInvalid if the targetName is missing. ", () => {
            const browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: null // { namespaceIndex:0 , name: "Server"}
                        }
                    ]
                }
            });

            const browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);

            browsePathResult.statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);
            browsePathResult.targets.length.should.eql(0);
        });
        it("The Server shall return BadNoMatch if the targetName doesn't exist. ", () => {
            const browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: { namespaceIndex: 0, name: "xxxx invalid name xxx" }
                        }
                    ]
                }
            });

            const browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.BadNoMatch);
            browsePathResult.targets.length.should.eql(0);
        });

        it("The Server shall return Good if the targetName does exist. ", () => {

            const browsePath = new translate_service.BrowsePath({
                startingNode: nodeid.makeNodeId(84),
                relativePath: {
                    elements: [
                        {
                            //xx referenceTypeId: null,
                            isInverse: false,
                            includeSubtypes: 0,
                            targetName: { namespaceIndex: 0, name: "Objects" }
                        }
                    ]
                }
            });

            const browsePathResult = engine.browsePath(browsePath);
            browsePathResult.should.be.instanceOf(translate_service.BrowsePathResult);
            browsePathResult.statusCode.should.eql(StatusCodes.Good);
            browsePathResult.targets.length.should.eql(1);
            browsePathResult.targets[0].targetId.should.eql(makeExpandedNodeId(85));
            const UInt32_MaxValue = 0xFFFFFFFF;
            browsePathResult.targets[0].remainingPathIndex.should.equal(UInt32_MaxValue);
        });

    });

    describe("Accessing ServerStatus nodes", () => {

        it("should read  Server_ServerStatus_CurrentTime", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    new ReadValueId({
                        nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                        attributeId: AttributeIds.Value
                    })
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.DateTime);
                    dataValues[0].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });

        it("should read  Server_ServerStatus_StartTime", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    {
                        nodeId: VariableIds.Server_ServerStatus_StartTime,
                        attributeId: AttributeIds.Value
                    }
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.DateTime);
                    dataValues[0].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });

        it("should read  Server_ServerStatus_BuildInfo_BuildNumber", function(done) {

            engine.serverStatus.buildInfo.buildNumber = "1234";

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    {
                        nodeId: VariableIds.Server_ServerStatus_BuildInfo_BuildNumber,
                        attributeId: AttributeIds.Value
                    }
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.String);
                    dataValues[0].value.value.should.eql("1234");
                }
                done(err);
            });
        });

        it("should read  Server_ServerStatus_BuildInfo_BuildNumber (2nd)", () => {

            engine.serverStatus.buildInfo.buildNumber = "1234";

            const nodeid = VariableIds.Server_ServerStatus_BuildInfo_BuildNumber;
            const node = engine.addressSpace.findNode(nodeid);
            should.exist(node);

            const dataValue = node.readAttribute(context, AttributeIds.Value);

            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.dataType.should.eql(DataType.String);
            dataValue.value.value.should.eql("1234");

        });

        it("should read  Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount", function(done) {

            const nodeid = VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;
            const node = engine.addressSpace.findNode(nodeid);
            should.exist(node);

            const nodesToRead = [
                new ReadValueId({
                    attributeId: AttributeIds.Value,
                    nodeId: nodeid
                })
            ];
            engine.refreshValues(nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValue = node.readAttribute(context, AttributeIds.Value);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.dataType.should.eql(DataType.UInt32);
                    dataValue.value.value.should.eql(0);
                }
                done(err);
            });

        });

        it("should read all attributes of Server_ServerStatus_CurrentTime", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 16, 17, 18, 19, 20].map(function(attributeId) {
                    return new ReadValueId({
                        nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                        attributeId: attributeId
                    });
                })
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(15);
                    dataValues[7].statusCode.should.eql(StatusCodes.Good);
                    dataValues[7].value.dataType.should.eql(DataType.DateTime);
                    dataValues[7].value.value.should.be.instanceOf(Date);
                }
                done(err);
            });

        });
    });

    const sinon = require("sinon");
    describe("ServerEngine read maxAge", () => {
        let clock; let timerId;
        beforeEach(function() {
            const old_setInterval = setInterval;
            clock = sinon.useFakeTimers(new Date(2000, 11, 25, 0, 0, 0));
            timerId = old_setInterval(() => {
                clock.tick(2000);
            }, 100);
        });
        afterEach(function() {
            clock.restore();
            clock = null;
            clearInterval(timerId);
        });

        async function pause(ms) {
            await new Promise((resolve) => setTimeout(resolve, ms));
        }
        async function when_I_read_the_value_with_max_age(nodeId, maxAge) {

            await pause(100);
            clock.tick(1000);
            return await new Promise((resolve, reject) => {
                const readRequest = new ReadRequest({
                    timestampsToReturn: TimestampsToReturn.Both,
                    nodesToRead: [
                        new ReadValueId({
                            nodeId,
                            attributeId: AttributeIds.Value
                        })
                    ]
                });

                engine.refreshValues(readRequest.nodesToRead, maxAge, function(err) {
                    if (!err) {
                        const dataValues = engine.read(context, readRequest);
                        return resolve(dataValues[0]);
                    }
                    return reject(err);
                });
            });
        }


        it("MAXA-1 should not cause dataValue to be refreshed if maxAge is greater than available dataValue", async () => {

            const ns = engine.addressSpace.getOwnNamespace();
            const nodeId = "ns=1;s=MyVar";
            let refreshFuncSpy;
            function given_a_variable_that_have_async_refresh() {
                let value = 0;
                const variable = ns.addVariable({ browseName: "SomeVarX", dataType: "Double", nodeId });
                variable.bindVariable({
                    refreshFunc: function(callback) {
                        setTimeout(() => {
                            const dataValue = new DataValue({
                                value: new Variant({ dataType: "Double", value: value + 1 }),
                                statusCode: 0,
                                sourceTimestamp: new Date(),
                                serverTimestamp: new Date()
                            });
                            value += 1;
                            callback(null, dataValue);
                        }, 1000);
                    }
                });

                refreshFuncSpy = sinon.spy(variable, "refreshFunc");
            }


            given_a_variable_that_have_async_refresh();

            {
                const dataValue = await when_I_read_the_value_with_max_age(nodeId, 0);
                //xx console.log(dataValue.toString());
                dataValue.value.value.should.eql(1);
                refreshFuncSpy.callCount.should.eql(1);
                refreshFuncSpy.resetHistory();
                refreshFuncSpy.callCount.should.eql(0);
            }
            {
                const dataValue1 = await when_I_read_the_value_with_max_age(nodeId, 4000);
                //xx console.log(dataValue1.toString());
                dataValue1.value.value.should.eql(1);
                refreshFuncSpy.callCount.should.eql(0);
            }
            {

                await new Promise((resolve) => setTimeout(resolve, 2000));
                const dataValue2 = await when_I_read_the_value_with_max_age(nodeId, 500);
                //xx console.log(dataValue2.toString());
                dataValue2.value.value.should.eql(2);
                refreshFuncSpy.callCount.should.eql(1);
            }
            {

                await new Promise((resolve) => setTimeout(resolve, 2000));
                const dataValue3 = await when_I_read_the_value_with_max_age(nodeId, 0);
                //xx console.log(dataValue3.toString());
                dataValue3.value.value.should.eql(3);
                refreshFuncSpy.callCount.should.eql(2);
            }


        });
        it("MAXA-2 should set serverTimestamp to current time on none updated variable ", async () => {


            const ns = engine.addressSpace.getOwnNamespace();
            const nodeId = "ns=1;s=MyVar2";
            function given_a_static_variable() {
                const variable = ns.addVariable({ browseName: "SomeVarX", dataType: "Double", nodeId });
                variable.setValueFromSource({ dataType: "Double", value: 42 });
            }

            given_a_static_variable();

            const dataValue = await when_I_read_the_value_with_max_age(nodeId, 0);
            const refSourceTimestamp = dataValue.sourceTimestamp.getTime();
            //xx console.log(dataValue.toString());
            dataValue.value.value.should.eql(42);

            await pause(100);
            const dataValue1 = await when_I_read_the_value_with_max_age(nodeId, 4000);
            //xx console.log(dataValue1.toString());
            dataValue1.value.value.should.eql(42);
            dataValue1.serverTimestamp.getTime().should.be.greaterThan(dataValue.serverTimestamp.getTime());
            dataValue1.sourceTimestamp.getTime().should.eql(refSourceTimestamp);

            await pause(2000);
            const dataValue2 = await when_I_read_the_value_with_max_age(nodeId, 500);
            //xx console.log(dataValue2.toString());
            dataValue2.value.value.should.eql(42);
            dataValue2.serverTimestamp.getTime().should.be.greaterThan(dataValue1.serverTimestamp.getTime());
            dataValue2.sourceTimestamp.getTime().should.eql(refSourceTimestamp);

            await pause(2000);
            const dataValue3 = await when_I_read_the_value_with_max_age(nodeId, 0);
            //xx console.log(dataValue3.toString());
            dataValue3.value.value.should.eql(42);
            dataValue3.serverTimestamp.getTime().should.be.greaterThan(dataValue2.serverTimestamp.getTime());
            dataValue3.sourceTimestamp.getTime().should.eql(refSourceTimestamp);

        });
    });

    describe("Accessing ServerStatus as a single composite object", () => {

        it("should be possible to access the ServerStatus Object as a variable", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    new ReadValueId({
                        nodeId: VariableIds.Server_ServerStatus,
                        attributeId: AttributeIds.Value
                    })
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.ExtensionObject);

                    dataValues[0].value.value.should.be.instanceOf(Object);

                    const serverStatus = dataValues[0].value.value;

                    serverStatus.state.should.eql(ServerState.Running);
                    serverStatus.shutdownReason.should.eql(new LocalizedText({ locale: null, text: null }));

                    serverStatus.buildInfo.productName.should.equal("NODEOPCUA-SERVER");
                    serverStatus.buildInfo.softwareVersion.should.equal("1.0");
                    serverStatus.buildInfo.manufacturerName.should.equal("<Manufacturer>");
                    serverStatus.buildInfo.productUri.should.equal("URI:NODEOPCUA-SERVER");
                }
                done(err);
            });
        });
    });

    describe("Accessing BuildInfo as a single composite object", () => {

        it("should be possible to read the Server_ServerStatus_BuildInfo Object as a complex structure", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    new ReadValueId({
                        nodeId: VariableIds.Server_ServerStatus_BuildInfo,
                        attributeId: AttributeIds.Value
                    })
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const dataValues = engine.read(context, readRequest);
                    dataValues.length.should.equal(1);
                    dataValues[0].statusCode.should.eql(StatusCodes.Good);
                    dataValues[0].value.dataType.should.eql(DataType.ExtensionObject);

                    // xx console.log("buildInfo", dataValues[0].value.value);
                    dataValues[0].value.value.should.be.instanceOf(Object);

                    const buildInfo = dataValues[0].value.value;

                    buildInfo.productName.should.equal("NODEOPCUA-SERVER");
                    buildInfo.softwareVersion.should.equal("1.0");
                    buildInfo.manufacturerName.should.equal("<Manufacturer>");
                    buildInfo.productUri.should.equal("URI:NODEOPCUA-SERVER");
                }
                done(err);
            });
        });
    });

    describe("writing nodes ", () => {

        const WriteValue = require("node-opcua-service-write").WriteValue;

        it("should write a single node", function(done) {

            const nodeToWrite = new WriteValue({
                nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                attributeId: AttributeIds.Value,
                indexRange: null,
                value: { // dataValue
                    value: { // variant
                        dataType: DataType.Int32,
                        value: 10
                    }
                }
            });
            engine.writeSingleNode(context, nodeToWrite, function(err, statusCode) {
                statusCode.should.eql(StatusCodes.Good);
                done(err);
            });
        });

        it("should return BadNotWritable when trying to write a Executable attribute", function(done) {

            const nodeToWrite = new WriteValue({
                nodeId: resolveNodeId("RootFolder"),
                attributeId: AttributeIds.Executable,
                indexRange: null,
                value: { // dataValue
                    value: { // variant
                        dataType: DataType.UInt32,
                        value: 10
                    }
                }
            });
            engine.writeSingleNode(context, nodeToWrite, function(err, statusCode) {
                statusCode.should.eql(StatusCodes.BadNotWritable);
                done(err);
            });

        });

        it("should write many nodes", function(done) {

            const nodesToWrite = [
                new WriteValue({
                    nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                    attributeId: AttributeIds.Value,
                    indexRange: null,
                    value: { // dataValue
                        value: { // variant
                            dataType: DataType.Int32,
                            value: 10
                        }
                    }
                }),
                new WriteValue({
                    nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                    attributeId: AttributeIds.Value,
                    indexRange: null,
                    value: { // dataValue
                        value: { // variant
                            dataType: DataType.Int32,
                            value: 10
                        }
                    }
                })
            ];

            engine.write(context, nodesToWrite, function(err, results) {
                results.length.should.eql(2);
                results[0].should.eql(StatusCodes.Good);
                results[1].should.eql(StatusCodes.Good);
                done(err);
            });

        });

        it(" write a single node with a null variant shall return BadTypeMismatch", function(done) {

            const nodeToWrite = new WriteValue({
                nodeId: coerceNodeId("ns=1;s=WriteableInt32"),
                attributeId: AttributeIds.Value,
                indexRange: null,
                value: { // dataValue
                    statusCode: StatusCodes.Good,
                    value: null
                }
            });

            nodeToWrite.value.value = null;

            engine.writeSingleNode(context, nodeToWrite, function(err, statusCode) {
                statusCode.should.eql(StatusCodes.BadTypeMismatch);
                done(err);
            });
        });

    });

    describe("testing the ability to handle variable that returns a StatusCode rather than a Variant", () => {

        before(() => {
            // add a variable that fails to provide a Variant.
            // we simulate the scenario where the variable represent a PLC value,
            // and for some reason, the server cannot access the PLC.
            // In this case we expect the value getter to return a StatusCode rather than a Variant
            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "FailingPLCValue",
                nodeId: "ns=1;s=FailingPLCValue",
                dataType: "Double",
                value: {
                    get: function() {
                        // we return a StatusCode here instead of a Variant
                        // this means : "Houston ! we have a problem"
                        return StatusCodes.BadResourceUnavailable;
                    },
                    set: null // read only
                }
            }
            );
        });

        it("ZZ should have statusCode=BadResourceUnavailable when trying to read the FailingPLCValue variable", function(done) {

            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Neither,
                nodesToRead: [
                    new ReadValueId({
                        nodeId: "ns=1;s=FailingPLCValue",
                        attributeId: AttributeIds.Value
                    })
                ]
            });
            engine.refreshValues(readRequest.nodesToRead, 0, function(err) {
                if (!err) {
                    const readResults = engine.read(context, readRequest);
                    readResults[0].statusCode.should.eql(StatusCodes.BadResourceUnavailable);
                }
                done(err);
            });

        });
    });

    describe("ServerEngine : forcing variable value refresh", () => {


        let value1 = 0;
        let value2 = 0;

        before(() => {

            // add a variable that provide a on demand refresh function
            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "RefreshedOnDemandValue",
                nodeId: "ns=1;s=RefreshedOnDemandValue",
                dataType: "Double",
                value: {
                    refreshFunc: function(callback) {
                        // add some delay to simulate a long operation to perform the asynchronous read
                        setTimeout(function() {
                            value1 += 1;
                            const dataValue = new DataValue({
                                value: {
                                    dataType: DataType.Double,
                                    value: value1
                                }
                            });
                            callback(null, dataValue);
                        }, 10);
                    }
                }
            }
            );
            // add an other variable that provide a on demand refresh function
            namespace.addVariable({
                organizedBy: engine.addressSpace.findNode("ObjectsFolder"),
                browseName: "OtherRefreshedOnDemandValue",
                nodeId: "ns=1;s=OtherRefreshedOnDemandValue",
                dataType: "Double",
                value: {
                    refreshFunc: function(callback) {
                        setTimeout(function() {
                            value2 += 1;
                            const dataValue = new DataValue({
                                value: { dataType: DataType.Double, value: value2 }
                            });
                            callback(null, dataValue);
                        }, 10);
                    }
                }
            }
            );
        });


        beforeEach(function() {
            // reset counters;
            value1 = 0;
            value2 = 0;

        });


        it("should refresh a single variable value asynchronously", function(done) {

            const nodesToRefresh = [
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue" })
            ];

            const v = engine.readSingleNode(context, nodesToRefresh[0].nodeId, AttributeIds.Value);
            v.statusCode.should.equal(StatusCodes.UncertainInitialValue);

            engine.refreshValues(nodesToRefresh, 0, function(err, values) {

                if (!err) {
                    values[0].value.value.should.equal(1);

                    value1.should.equal(1);
                    value2.should.equal(0);

                    const dataValue = engine.readSingleNode(context, nodesToRefresh[0].nodeId, AttributeIds.Value);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.value.should.eql(1);

                }
                done(err);
            });
        });

        it("should refresh multiple variable values asynchronously", function(done) {


            const nodesToRefresh = [
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue" }),
                new ReadValueId({ nodeId: "ns=1;s=OtherRefreshedOnDemandValue" })
            ];

            engine.refreshValues(nodesToRefresh, 0, function(err, values) {
                if (!err) {
                    values.length.should.equal(2, " expecting two node asynchronous refresh call");

                    values[0].value.value.should.equal(1);
                    values[1].value.value.should.equal(1);

                    value1.should.equal(1);
                    value2.should.equal(1);
                }
                done(err);
            });
        });

        it("should  refresh nodes only once if they are duplicated ", function(done) {

            const nodesToRefresh = [
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue" }),
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue" }), // <== duplicated node
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue", attributeId: AttributeIds.DisplayName })
            ];
            engine.refreshValues(nodesToRefresh, 0, function(err, values) {

                if (!err) {
                    values.length.should.equal(1, " expecting only one node asynchronous refresh call");

                    value1.should.equal(1);
                    value2.should.equal(0);
                }

                done(err);
            });
        });

        it("should ignore nodes with attributeId!=AttributeIds.Value ", function(done) {
            value1.should.equal(0);
            value2.should.equal(0);
            const nodesToRefresh = [
                new ReadValueId({ nodeId: "ns=1;s=RefreshedOnDemandValue", attributeId: AttributeIds.DisplayName })
            ];
            engine.refreshValues(nodesToRefresh, 0, function(err, values) {
                if (!err) {
                    values.length.should.equal(0, " expecting no asynchronous refresh call");
                    value1.should.equal(0);
                    value2.should.equal(0);
                }
                done(err);
            });
        });

        it("should perform readValueAsync on Variable", function(done) {

            const variable = engine.addressSpace.findNode("ns=1;s=RefreshedOnDemandValue");

            value1.should.equal(0);
            variable.readValueAsync(context, function(err, value) {
                value1.should.equal(1);

                done(err);
            });

        });
    });

    describe("ServerEngine Diagnostic", () => {

        it("should have ServerDiagnosticObject", () => {
            const server = engine.addressSpace.rootFolder.objects.server;
            server.browseName.toString().should.eql("Server");
            server.serverDiagnostics.browseName.toString().should.eql("ServerDiagnostics");
            server.serverDiagnostics.enabledFlag.browseName.toString().should.eql("EnabledFlag");
        });
    });
});

describe("ServerEngine advanced", () => {

    it("ServerEngine#registerShutdownTask should execute shutdown tasks on shutdown", async () => {

        const engine = new ServerEngine();

        const sinon = require("sinon");
        const myFunc = sinon.spy();

        engine.registerShutdownTask(myFunc);

        await engine.shutdown();

        myFunc.calledOnce.should.eql(true);

    });

    it("ServerEngine#shutdown engine should take care of disposing session on shutdown", async () => {

        const engine = new ServerEngine();
        const session1 = engine.createSession();
        const session2 = engine.createSession();
        const session3 = engine.createSession();

        should.exist(session1);
        should.exist(session2);
        should.exist(session3);

        await engine.shutdown();
        // leaks will be detected if engine failed to dispose session

    });

});

describe("ServerEngine ServerStatus & ServerCapabilities", function(/*this: any*/) {

    const sinon = require("sinon");

    let engine;

    const defaultBuildInfo = {
        productName: "NODEOPCUA-SERVER",
        softwareVersion: "1.0",
        manufacturerName: "<Manufacturer>",
        productUri: "URI:NODEOPCUA-SERVER"
    };

    this.timeout(40000);
    let test;
    before(function(done) {

        test = this;

        engine = new ServerEngine({ buildInfo: defaultBuildInfo });

        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            done();
        });

    });
    after(async () => {
        await engine.shutdown();
        engine = null;
    });
    beforeEach(function() {
        test.clock = sinon.useFakeTimers(Date.now());

    });
    afterEach(function() {
        test.clock.restore();
    });

    it("ServerEngine#ServerCapabilities should expose ServerCapabilities ", function(done) {

        const serverCapabilitiesId = makeNodeId(ObjectIds.Server_ServerCapabilities); // ns=0;i=2268
        serverCapabilitiesId.toString().should.eql("ns=0;i=2268");

        const addressSpace = engine.addressSpace;
        const serverCapabilitiesNode = addressSpace.findNode(serverCapabilitiesId);

        serverCapabilitiesNode.nodeClass.should.eql(NodeClass.Object);

        // ->
        done();
    });

    it("ServerEngine#ServerStatus should expose currentTime", function(done) {

        const currentTimeId = makeNodeId(VariableIds.Server_ServerStatus_CurrentTime); // ns=0;i=2258
        currentTimeId.value.should.eql(2258);

        const addressSpace = engine.addressSpace;
        const currentTimeNode = addressSpace.findNode(currentTimeId);
        const d1 = currentTimeNode.readValue();

        test.clock.tick(1000);
        const d2 = currentTimeNode.readValue();
        d2.value.value.getTime().should.be.greaterThan(d1.value.value.getTime() + 900);

        test.clock.tick(1000);
        const d3 = currentTimeNode.readValue();
        d3.value.value.getTime().should.be.greaterThan(d2.value.value.getTime() + 900);

        test.clock.tick(1000);
        const d4 = currentTimeNode.readValue();
        d4.value.value.getTime().should.be.greaterThan(d3.value.value.getTime() + 900);

        done();
    });

});