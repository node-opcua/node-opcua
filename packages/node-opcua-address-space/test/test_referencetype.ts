import { AttributeIds, BrowseDirection, makeNodeClassMask } from "node-opcua-data-model";
import { NodeClass } from "node-opcua-data-model";
import { redirectToFile } from "node-opcua-debug/nodeJS";
import { makeNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { ReferenceDescription, BrowseDescription } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Benchmarker } from "node-opcua-benchmarker";

import {
    AddressSpace,
    adjustBrowseDirection,
    BaseNode,
    dumpReferenceDescriptions,
    UARootFolder,
    SessionContext,
    UAReference,
    UAReferenceType
} from "..";
import { getMiniAddressSpace } from "../testHelpers";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing ReferenceType", () => {
    let addressSpace: AddressSpace;
    let rootFolder: UARootFolder;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        rootFolder = addressSpace.rootFolder;
        rootFolder.browseName.toString().should.equal("Root");
    });

    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should find 'HierarchicalReferences'", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        hr.browseName.toString().should.equal("HierarchicalReferences");
        hr.nodeId.toString().should.eql(makeNodeId(33).toString());
    });

    it("HierarchicalReferences should have an Abstract attribute set to true ", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        const v = hr.readAttribute(context, AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(true);
    });

    it("Organizes should have an Abstract attribute set to true ", () => {
        const hr = addressSpace.findReferenceType("Organizes")!;
        const v = hr.readAttribute(context, AttributeIds.IsAbstract);
        v.statusCode.should.eql(StatusCodes.Good);
        v.value.dataType.should.eql(DataType.Boolean);
        v.value.value.should.eql(false);
    });

    it("should find 'Organizes'", () => {
        const organizes_refId = addressSpace.findReferenceType("Organizes")!;
        organizes_refId.browseName.toString().should.equal("Organizes");
        organizes_refId.nodeId.toString().should.eql(makeNodeId(35).toString());
    });

    it("'Organizes' should be a super type of 'HierarchicalReferences'", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        const organizes_refId = addressSpace.findReferenceType("Organizes")!;

        organizes_refId.isSupertypeOf(hr).should.eql(true);
        hr.isSupertypeOf(organizes_refId).should.eql(false);
    });

    it("'HasTypeDefinition' should *not* be a super-type of 'HierarchicalReferences'", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        const hasTypeDefinition_refId = addressSpace.findReferenceType("HasTypeDefinition")!;

        hasTypeDefinition_refId.isSupertypeOf(hr).should.eql(false);
        hr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);
    });

    it("'HasTypeDefinition' should  be a super-type of 'NonHierarchicalReferences'", () => {
        const nhr = addressSpace.findReferenceType("NonHierarchicalReferences")!;
        const hasTypeDefinition_refId = addressSpace.findReferenceType("HasTypeDefinition")!;

        hasTypeDefinition_refId.isSupertypeOf(nhr).should.eql(true);
        nhr.isSupertypeOf(hasTypeDefinition_refId).should.eql(false);
    });

    it("should return 4 refs for browseNode on RootFolder ,  referenceTypeId=null,!includeSubtypes  ", () => {
        const references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            // referenceTypeId: undefined,
            resultMask: 0x3f
        });
        references.length.should.be.greaterThan(2);

        const browseNames = references.map((ref) => {
            return addressSpace.findNode(ref.nodeId)!.browseName.toString();
        });
        const expectedBrowseNames = ["FolderType", "Objects", "Types", "Views"];
        browseNames.sort().should.eql(expectedBrowseNames.sort());
        // xx _.intersection(names, expectedNames).length.should.eql(expectedNames.length);
    });

    it("should return 1 refs for browseNode on RootFolder ,  NonHierarchicalReferences, includeSubtypes  ", () => {
        const references = rootFolder.browseNode(
            new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: 0, // 0 = all nodes
                referenceTypeId: resolveNodeId("NonHierarchicalReferences"),
                resultMask: 0x3f
            })
        );
        references.length.should.equal(1);
    });

    it("should return 3 refs for browseNode on RootFolder , Organizes ,!includeSubtypes  ", () => {
        const references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "Organizes",
            resultMask: 0x3f
        });
        references.length.should.be.greaterThan(2);

        const browseNames = references.map((ref) => addressSpace.findNode(ref.nodeId)!.browseName.toString());
        const expectedBrowseNames = ["Objects", "Types", "Views"];
        // _.intersection(names, expectedNames).length.should.eql(expectedNames.length);
        browseNames.sort().should.eql(expectedBrowseNames.sort());
    });

    it("should return 0 refs for browseNode on RootFolder , HierarchicalReferences ,!includeSubtypes  ", () => {
        const references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Both,
            includeSubtypes: false,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });
        const browseNames = references.map((r: ReferenceDescription) => {
            return r.browseName.name;
        });
        browseNames.length.should.be.equal(0);
        references.length.should.equal(0);
    });

    it("should return 3 refs for browseNode on RootFolder , HierarchicalReferences , includeSubtypes  ", () => {
        const serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");

        const references = rootFolder.browseNode({
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });
        references.length.should.be.greaterThan(2);
    });

    it("should return 6 refs for browseNode on ServerStatus (BrowseDirection.Forward)", () => {
        const serverStatus = rootFolder.objects.server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");

        const references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });
        const browseNames = references.map((r: ReferenceDescription) => {
            return r.browseName.name;
        });
        // xx console.log("              " + browseNames.join(" , "));

        references.length.should.equal(6);

        const expectedBrowseNames = ["StartTime", "CurrentTime", "State", "BuildInfo", "SecondsTillShutdown", "ShutdownReason"];
        // _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
        browseNames.sort().should.eql(expectedBrowseNames.sort());
    });

    it("ServerStatus parent shall be Server", () => {
        const server = rootFolder.objects.server;
        server.browseName.toString().should.equal("Server");
        server.nodeId.toString().should.equal("ns=0;i=2253");

        const serverStatus = server.serverStatus;
        serverStatus.browseName.toString().should.equal("ServerStatus");
        serverStatus.nodeId.toString().should.equal("ns=0;i=2256");

        serverStatus.parent!.nodeId.should.equal(server.nodeId);
    });

    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", (done: any) => {
        const serverStatus = rootFolder.objects.server.serverStatus;

        const references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });

        const browseNames = references.map((r: ReferenceDescription) => {
            return r.browseName!.name;
        });
        // console.log("             browseNames :  " + browseNames.join(" , "));

        // xx references.length.should.equal(7);
        const expectedBrowseNames = ["Server"];
        // xx   _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
        browseNames.sort().should.eql(expectedBrowseNames.sort());

        redirectToFile(
            "ReferenceDescription1.log",
            () => {
                Array.isArray(references).should.eql(true);
                dumpReferenceDescriptions(addressSpace, references);
            },
            done
        );
    });

    it("should return 7 refs for browseNode on ServerStatus (BrowseDirection.Both)", (done: any) => {
        const serverStatus = rootFolder.objects.server.serverStatus;

        const references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });

        const browseNames = references.map((r) => r.browseName.name);

        // xx console.log("              " + browseNames.join(" , "));

        const expectedBrowseNames = [
            "StartTime",
            "CurrentTime",
            "State",
            "BuildInfo",
            "SecondsTillShutdown",
            "ShutdownReason",
            "Server"
        ];
        browseNames.sort().should.eql(expectedBrowseNames.sort());

        redirectToFile(
            "ReferenceDescription2.log",
            () => {
                Array.isArray(references).should.eql(true);
                dumpReferenceDescriptions(addressSpace, references);
            },
            done
        );
    });

    it("should return 1 refs for browseNode on ServerStatus (BrowseDirection.Reverse)", () => {
        const serverStatus = rootFolder.objects.server.serverStatus;

        const references = serverStatus.browseNode({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });

        references.length.should.equal(1);
        const browseNames = references.map((r: ReferenceDescription) => {
            return r.browseName.name;
        });
        const expectedBrowseNames = ["Server"];
        browseNames.sort().should.eql(expectedBrowseNames.sort());
    });

    it("should return 1 refs for browseNode on Server (BrowseDirection.Forward) and NodeClass set to Method", () => {
        const mask = makeNodeClassMask("Method");

        const server = rootFolder.objects.server;
        server.browseName.toString().should.equal("Server");

        const references = server.browseNode({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: mask, // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            referenceTypeId: "HierarchicalReferences",
            resultMask: 0x3f
        });

        const browseNames = references.map((r) => r.browseName.name);

        references.length.should.equal(1);

        const expectedBrowseNames = ["GetMonitoredItems"];
        browseNames.sort().should.eql(expectedBrowseNames.sort());
        // xx _.intersection(browseNames, expectedBrowseNames).length.should.eql(expectedBrowseNames.length);
    });

    it("ReferenceType should have a toString (HierarchicalReferences)", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        hr.toString().should.eql("A  HierarchicalReferences/HierarchicalReferences ns=0;i=33");
    });

    it("ReferenceType should have a toString (Organizes)", () => {
        const hr = addressSpace.findReferenceType("Organizes")!;
        hr.toString().should.eql("   Organizes/OrganizedBy ns=0;i=35");
    });

    /**
     *
     */
    it("ReferenceType#getAllSubtypes should extract all possible referenceType ", () => {
        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;
        let derivedTypes = hr.getAllSubtypes();

        let s = derivedTypes.map((r: BaseNode) => r.browseName.toString()).join(" ");

        s.should.eql(
            "HierarchicalReferences HasChild Aggregates HasProperty HasComponent " +
                "HasOrderedComponent HasHistoricalConfiguration HasSubtype Organizes HasEventSource HasNotifier"
        );

        const aggregates = addressSpace.findReferenceType("Aggregates")!;
        derivedTypes = aggregates.getAllSubtypes();
        s = derivedTypes.map((r: BaseNode) => r.browseName.toString()).join(" ");
        s.should.eql("Aggregates HasProperty HasComponent HasOrderedComponent HasHistoricalConfiguration");
        // xx console.log(s);
    });

    function _is_valid_BrowseDirection(browseDirection: BrowseDirection) {
        return (
            browseDirection === BrowseDirection.Forward ||
            browseDirection === BrowseDirection.Inverse ||
            browseDirection === BrowseDirection.Both
        );
    }

    /**
     * find all references that have the provided referenceType or are subType of this referenceType
     * @method findReferencesEx
     * @param strReference {String} the referenceType as a string.
     * @param  [browseDirection=BrowseDirection.Forward] {BrowseDirection}
     * @return {Array<ReferenceDescription>}
     */
    function findReferencesEx_deprecated(this: BaseNode, strReference: string, browseDirection: BrowseDirection) {
        browseDirection = adjustBrowseDirection(browseDirection, BrowseDirection.Forward);
        _is_valid_BrowseDirection(browseDirection).should.eql(true);

        const addressSpace1 = this.addressSpace;

        const referenceType = addressSpace1.findReferenceType(strReference);
        if (!referenceType) {
            // note: when loading nodeset2.xml files, reference type may not exit yet
            // throw new Error("expecting valid reference name " + strReference);
            return [];
        }
        referenceType.nodeId.should.be.instanceOf(NodeId);

        const browseResults = this.browseNode({
            browseDirection,
            includeSubtypes: true,
            nodeClassMask: 0,
            referenceTypeId: referenceType.nodeId,
            resultMask: 0x3f
        });
        return browseResults;
    }

    it("BaseNode#findReferencesEx should be fast ", function (this: any, done: any) {
        // tslint:disable:no-console

        this.timeout(Math.max(this.timeout(), 100000));

        const bench = new Benchmarker();

        const server = addressSpace.findNode("i=63")!; // rootFolder.objects.server;

        // xx console.log("referenceTypes",referenceTypes.map(function(e){return e.browseName;}));
        bench
            .add("findReferencesEx slow", () => {
                const a1 = findReferencesEx_deprecated.call(server, "HasChild", BrowseDirection.Forward);
                const a2 = findReferencesEx_deprecated.call(server, "HasChild", BrowseDirection.Inverse);
            })
            .add("findReferencesEx fast", () => {
                const a1 = server.findReferencesEx("HasChild", BrowseDirection.Forward);
                const a2 = server.findReferencesEx("HasChild", BrowseDirection.Inverse);
            })
            .on("cycle", (message: string) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
                this.fastest.name.should.eql("findReferencesEx fast");
                // xx this.speedUp.should.be.greaterThan(5); // at least 5 time faster

                done();
            })
            .run({
                max_time: 0.2, // Sec
                min_count: 300
            });
    });
});

describe(" improving performance of isSupertypeOf", () => {
    //  References i=31
    //  +->(hasSubtype) NonHierarchicalReferences
    //                  +->(hasSubtype) HasTypeDefinition
    //  +->(hasSubtype) HierarchicalReferences
    //                  +->(hasSubtype) HasChild/ChildOf
    //                                  +->(hasSubtype) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubtype) HasSubtype/HasSupertype
    //                  +->(hasSubtype) Organizes/OrganizedBy
    //                  +->(hasSubtype) HasEventSource/EventSourceOf

    const referenceTypeNames = Object.keys(require("node-opcua-constants").ReferenceTypeIds);

    let referenceTypes: UAReferenceType[] = [];

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        referenceTypes = referenceTypeNames
            .map((referenceTypeName) => addressSpace.findReferenceType(referenceTypeName)!)
            .filter((e) => e !== null && e !== undefined);

        referenceTypes[0].nodeClass.should.eql(NodeClass.ReferenceType);
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should ensure that optimized version of isSupertypeOf produce same result as brute force version", () => {
        referenceTypes.forEach((referenceType) => {
            const flags1 = referenceTypes.map((refType) => referenceType.isSupertypeOf(refType));
            const flags2 = referenceTypes.map((refType) => (referenceType as any)._slow_isSupertypeOf(refType));
            // xx console.log( referenceType.browseName,flags1.map(function(f){return f ? 1 :0;}).join(" - "));
            // xx console.log( referenceType.browseName,flags2.map(function(f){return f ? 1 :0;}).join(" - "));
            flags1.should.eql(flags2);
        });
    });

    it("should ensure that optimized version of isSupertypeOf is really faster that brute force version", function (this: any, done: any) {
        this.timeout(Math.max(this.timeout(), 100000));

        const bench = new Benchmarker();

        // xx console.log("referenceTypes",referenceTypes.map(function(e){return e.browseName;}));
        bench
            .add("isSupertypeOf slow", () => {
                referenceTypes.forEach((referenceType) => {
                    referenceTypes.map((refType) => {
                        return (referenceType as any)._slow_isSupertypeOf(refType);
                    });
                });
            })
            .add("isSupertypeOf fast", () => {
                referenceTypes.forEach((referenceType) => {
                    referenceTypes.map((refType) => {
                        return referenceType.isSupertypeOf(refType);
                    });
                });
            })
            .on("cycle", (message: string) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
                this.fastest.name.should.eql("isSupertypeOf fast");

                this.speedUp.should.be.greaterThan(3); // at least 3 time faster

                done();
            })
            .run({
                max_time: 0.2, // Sec
                min_count: 300
            });
    });

    it("ZZ should ensure that fast version isSupertypeOf shall update its cache when new References are added ", () => {
        function allSubTypes(n: UAReferenceType) {
            return n
                .getAllSubtypes()
                .map((c) => c.browseName.toString())
                .join(",");
        }

        const nhr = addressSpace.findReferenceType("NonHierarchicalReferences")!;
        nhr.browseName.toString().should.eql("NonHierarchicalReferences");

        // xx console.log(allSubTypes(nhr));

        allSubTypes(nhr).indexOf("NonHierarchicalReferences").should.be.aboveOrEqual(0);

        const hasTypeDefinition = addressSpace.findReferenceType("HasTypeDefinition")!;

        hasTypeDefinition.isSupertypeOf(nhr).should.eql(true);
        nhr.isSupertypeOf(hasTypeDefinition).should.eql(false);

        const flowTo = addressSpace.getOwnNamespace().addReferenceType({
            browseName: "FlowTo",
            inverseName: "FlowFrom",
            isAbstract: false,
            subtypeOf: "NonHierarchicalReferences"
        });

        flowTo.isSupertypeOf(nhr).should.eql(true);

        // xx console.log(allSubTypes(nhr));
        allSubTypes(nhr).indexOf("FlowTo").should.be.aboveOrEqual(0);
    });
});
