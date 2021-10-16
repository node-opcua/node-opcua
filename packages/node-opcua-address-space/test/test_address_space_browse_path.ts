// tslint:disable:no-console
import * as should from "should";

import { coerceQualifiedName } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, Namespace } from "..";
import { generateAddressSpace } from "../nodeJS";
import { getMiniAddressSpace, add_eventGeneratorObject } from "../testHelpers";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("AddressSpace#browsePath", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("http://MYNAMESPACE");
        // Add EventGeneratorObject
        add_eventGeneratorObject(namespace, "ObjectsFolder");
    });

    after(() => {
        addressSpace.dispose();
    });

    it("should browse Server", () => {
        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            debugLog((result as any).toString(opts));
        }
    });
    it("should browse Status", () => {
        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server/ServerStatus");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            debugLog((result as any).toString(opts));
        }
    });
    it("#QQ browsing a path when a null target name is not in the last element shall return an error ", () => {
        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server/ServerStatus");
        browsePath.relativePath!.elements![1]!.targetName.toString().should.eql("Server");
        // set a null target Name in the middle of the path
        (browsePath.relativePath.elements![1]! as any).targetName = null;
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);
        result.targets!.length.should.eql(0);
    });

    it("should browse EventGeneratorObject", () => {
        const browsePath = makeBrowsePath("RootFolder", "/Objects/1:EventGeneratorObject");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            debugLog("browsePath", browsePath.toString(opts));
            debugLog("result", result.toString(opts));

            debugLog(addressSpace.rootFolder.objects.toString());
        }
    });

    it("should browse MyEventType", () => {
        let browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<HasSubtype>1:MyEventType");
        let result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            debugLog("browsePath", browsePath.toString(opts));
            debugLog("result", result.toString(opts));
        }

        const node = addressSpace.findNode(result.targets![0].targetId)!.browseName.toString().should.eql("1:MyEventType");

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<!HasSubtype>1:MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNoMatch);

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<#HasSubtype>1:MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);

        const evType = addressSpace.findNode(result.targets![0].targetId)!;

        // rowing upstream
        browsePath = makeBrowsePath(evType, "<!HasSubtype>BaseEventType<!Organizes>EventTypes<!Organizes>Types<!Organizes>Root");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        addressSpace.findNode(result.targets![0].targetId)!.browseName.toString().should.eql("Root");
    });
    it("should browse an empty path", () => {
        const rootFolder = addressSpace.rootFolder;
        const browsePath = makeBrowsePath(rootFolder, "");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNothingToDo);
        result.targets!.length.should.eql(0);
    });

    it("should return one target", () => {
        const rootFolder = addressSpace.rootFolder;
        const browsePath = makeBrowsePath(rootFolder, "/Types/VariableTypes/BaseVariableType<References>PropertyType");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);
        result.targets![0].targetId.toString().should.eql("ns=0;i=68");
    });
});

describe("AddressSpace#browsePath 2/2", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        const xml_file = nodesets.standard;

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.registerNamespace("ServerNamespaceURI");
    });

    after(() => {
        addressSpace.dispose();
    });

    // tslint:disable: object-literal-sort-keys
    it("XSXS should explore browse path and only return one target", () => {
        const browsePath = new BrowsePath({
            startingNode /* NodeId              */: "i=84",
            relativePath /* RelativePath        */: {
                elements /* RelativePathEleme[] */: [
                    {
                        referenceTypeId /* NodeId              */: "ns=0;i=40", // HasTypeDefinition
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("FolderType")
                    },
                    {
                        /*1*/
                        referenceTypeId /* NodeId              */: "ns=0;i=45", // HasSubType
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("AlarmGroupType")
                    },
                    {
                        /*2*/
                        referenceTypeId /* NodeId              */: "ns=0;i=16362", // AlarmGroup Member
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("<AlarmConditionInstance>")
                    },
                    {
                        /*3*/
                        referenceTypeId /* NodeId              */: "ns=0;i=40", // HasTypeDefinition
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("AlarmConditionType")
                    },
                    {
                        /*4*/
                        referenceTypeId /* NodeId              */: "ns=0;i=47", // HasComponent
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("EnabledState")
                    },
                    {
                        /*5*/
                        referenceTypeId /* NodeId              */: "ns=0;i=9004", // HasTrueSubState
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("ShelvingState")
                    },
                    {
                        /*6*/
                        referenceTypeId /* NodeId              */: "ns=0;i=47", // HasComponent
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("CurrentState")
                    },
                    {
                        /*7*/
                        referenceTypeId /* NodeId              */: "ns=0;i=40", // HasTypeDefinition
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("FiniteStateVariableType")
                    },
                    {
                        /*8*/
                        referenceTypeId /* NodeId              */: "ns=0;i=46", // HasProperty
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("Id")
                    },
                    {
                        /*9*/
                        referenceTypeId /* NodeId              */: "ns=0;i=40", // HasTypeDefinitin
                        isInverse /* UABoolean           */: false,
                        includeSubtypes /* UABoolean           */: false,
                        targetName /* QualifiedName       */: coerceQualifiedName("PropertyType")
                    }
                ]
            }
        });
        // debugLog(browsePath.toString());
        const result = addressSpace.browsePath(browsePath);
        // debugLog(result.toString());
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);
    });
});

describe("AddressSpace#browsePath 2/2", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        const xml_file = nodesets.standard;

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.registerNamespace("ServerNamespaceURI");
    });

    after(() => {
        addressSpace.dispose();
    });

    it("AddressSpace#deleteNode => delete OOO", () => {
        const server = addressSpace.rootFolder.objects.server;
        const childrenBefore = server
            .getComponents()
            .map((c) => c.browseName.toString())
            .sort()
            .join(" ");

        const node = server.getChildByName("ServerRedundancy")!;
        should.exist(node);
        debugLog(node.toString());
        addressSpace.deleteNode(node);
        const childrenAfter = server
            .getComponents()
            .map((c) => c.browseName.toString())
            .sort()
            .join(" ");
        debugLog("childrenAfter  = ", childrenAfter);
        debugLog("childrenBefore = ", childrenBefore);
    });
});
