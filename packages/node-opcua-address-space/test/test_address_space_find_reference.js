const should = require("should");
const AddressSpace = require("../src/address_space").AddressSpace;
const create_minimalist_address_space_nodeset = require("../test_helpers/create_minimalist_address_space_nodeset");
const Reference = require("../src/reference").Reference;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

describe("testing AddressSpace#findReferenceType and findReferenceTypeFromInverseName", function () {

    let addressSpace;
    before(function(){

        addressSpace = new AddressSpace();
        create_minimalist_address_space_nodeset(addressSpace);

    });
    after(function() {

        addressSpace.dispose();

    });
    it("findReferenceType findReferenceTypeFromInverseName - should provide a way to access a referenceType from its inverse name", function () {
        const n1 = addressSpace.findReferenceType("Organizes").nodeId;
        should.not.exist(addressSpace.findReferenceType("OrganizedBy"));

        const n2 = addressSpace.findReferenceTypeFromInverseName("OrganizedBy").nodeId;
        should.not.exist(addressSpace.findReferenceTypeFromInverseName("Organizes"));

        n1.should.equal(n2);

    });

    xit("findReferenceType findReferenceTypeFromInverseName - should normalize a {referenceType/isForward} combination", function () {

        addressSpace.normalizeReferenceType(
            {referenceType: "OrganizedBy", isForward: true, nodeId: "i=58"}).should.eql(
            new Reference({referenceType: resolveNodeId("Organizes"), isForward: false, nodeId: resolveNodeId("i=58")})
        );

        addressSpace.normalizeReferenceType(
            {referenceType: "OrganizedBy", isForward: false, nodeId: "i=58"}).should.eql(
            new Reference({referenceType: "Organizes", isForward: true, nodeId: "i=58"})
        );
        addressSpace.normalizeReferenceType(
            {referenceType: "Organizes", isForward: false, nodeId: "i=58"}).should.eql(
            new Reference({referenceType: "Organizes", isForward: false, nodeId: "i=58"})
        );
        addressSpace.normalizeReferenceType(
            {referenceType: "Organizes", isForward: true, nodeId: "i=58"}).should.eql(
            new Reference({referenceType: "Organizes", isForward: true, nodeId: "i=58"})
        );
    });

    it("findReferenceType findReferenceTypeFromInverseName - should provide a easy way to get the inverse name of a Reference Type", function () {

        addressSpace.inverseReferenceType("Organizes").should.eql("OrganizedBy");
        addressSpace.inverseReferenceType("ChildOf").should.eql("HasChild");
        addressSpace.inverseReferenceType("AggregatedBy").should.eql("Aggregates");
        addressSpace.inverseReferenceType("PropertyOf").should.eql("HasProperty");
        addressSpace.inverseReferenceType("ComponentOf").should.eql("HasComponent");
        addressSpace.inverseReferenceType("HistoricalConfigurationOf").should.eql("HasHistoricalConfiguration");
        addressSpace.inverseReferenceType("HasSupertype").should.eql("HasSubtype");
        addressSpace.inverseReferenceType("EventSourceOf").should.eql("HasEventSource");

        addressSpace.inverseReferenceType("OrganizedBy").should.eql("Organizes");
        addressSpace.inverseReferenceType("HasChild").should.eql("ChildOf");
        addressSpace.inverseReferenceType("Aggregates").should.eql("AggregatedBy");
        addressSpace.inverseReferenceType("HasProperty").should.eql("PropertyOf");
        addressSpace.inverseReferenceType("HasComponent").should.eql("ComponentOf");
        addressSpace.inverseReferenceType("HasHistoricalConfiguration").should.eql("HistoricalConfigurationOf");
        addressSpace.inverseReferenceType("HasSubtype").should.eql("HasSupertype");
        addressSpace.inverseReferenceType("HasEventSource").should.eql("EventSourceOf");
    });

});