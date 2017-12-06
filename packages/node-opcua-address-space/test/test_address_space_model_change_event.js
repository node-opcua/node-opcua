"use strict";


var should = require("should");
var sinon = require("sinon");


var generate_address_space = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var standard_nodeset_file = require("node-opcua-nodesets").standard_nodeset_file;

describe("address_space ModelChangeEvent",function(){

    this.timeout(100000);
    // Part 3:
    // 9.32 ModelChangeEvents
    //
    // 9.32.1 General
    //   ModelChangeEvents are generated to indicate a change of the AddressSpace structure. The change may consist of
    //   adding or deleting a Node or Reference. Although the relationship of a Variable or VariableType to its DataType
    //   is not modelled using References, changes to the DataType Attribute of a Variable or VariableType are also
    //   considered as model changes and therefore a ModelChangeEvent is generated if the DataType Attribute changes.
    //
    // 9.32.2 NodeVersion Property
    //   There is a correlation between ModelChangeEvents and the NodeVersion Property of Nodes. Every time a
    //   ModelChangeEvent is issued for a Node, its NodeVersion shall be changed, and every time the NodeVersion
    //   is changed, a ModelChangeEvent shall be generated. A Server shall support both the ModelChangeEvent and the
    //   NodeVersion Property or neither, but never only one of the two mechanisms.
    //
    //   This relation also implies that only those Nodes of the AddressSpace having a NodeVersion shall trigger a
    //   ModelChangeEvent. Other Nodes shall not trigger a ModelChangeEvent.
    //
    // 9.32.3 Views
    //   A ModelChangeEvent is always generated in the context of a View, including the default View where the whole
    //   AddressSpace is considered. Therefore the only Notifiers which report the ModelChangeEvents are View Nodes
    //   and the Server Object representing the default View. Each action generating a ModelChangeEvent may lead to
    //   several Events since it may affect different Views. If, for example, a Node was deleted from the AddressSpace,
    //   and this Node was also contained in a View “A”, there would be one Event having the AddressSpace as context
    //   and another having the View “A” as context. If a Node would only be removed from View “A”, but still exists
    //   in the AddressSpace, it would generate only a ModelChangeEvent for View “A”.
    //   If a Client does not want to receive duplicates of changes then it shall use the filter mechanisms of
    //   the Event subscription to filter only for the default View and suppress the ModelChangeEvents having other
    //   Views as the context.
    //   When a ModelChangeEvent is issued on a View and the View supports the ViewVersion Property, then the
    //   ViewVersion shall be updated.
    //
    // Part5:
    //  GeneralModelChangeEventType Definition
    //  Attribute   Value
    //  BrowseName  GeneralModelChangeEventType
    //  IsAbstract  True
    //  References   NodeClass  BrowseName   DataType                         TypeDefinition  ModellingRule
    //  HasProperty  Variable   Changes      ModelChangeStructureDataType[]   PropertyType    Mandatory
    //  The additional Property defined for this EventType reflects the changes that issued the ModelChangeEvent.
    //  It shall contain at least one entry in its array. Its structure is defined in 12.16.

    // ModelChangeStructure :
    //
    // affected      NodeId    NodeId of the Node that was changed. The client should assume that the affected Node has been
    //                         created or deleted, had a Reference added or deleted, or the DataType has changed as described
    //                         by the verb.
    // affectedType  NodeId    If the affected Node was an Object or Variable, affectedType contains the NodeId of the
    //                         TypeDefinitionNode of the affected Node. Otherwise it is set to null.
    // verb          Byte      Describes the changes happening to the affected Node.
    //                         The verb is an 8-bit unsigned integer used as bit mask with the structure defined in the
    //                         following table:
    //                         Field           Bit       Description
    //                         NodeAdded        0         Indicates the affected Node has been added.
    //                         NodeDeleted      1         Indicates the affected Node has been deleted.
    //                         ReferenceAdded   2         Indicates a Reference has been added. The affected Node may
    //                                                    be either a SourceNode or TargetNode. Note that an added
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    //                         ReferenceDeleted 3         Indicates a Reference has been deleted. The affected Node may
    //                                                    be either a SourceNode or TargetNode. Note that a deleted
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    //                         DataTypeChanged  4         This verb may be used only for affected Nodes that are
    //                                                    Variables or VariableTypes. It indicates that the DataType Attribute has changed.
    //                         Reserved         5:7       Reserved for future use. Shall always be zero.
    //
    //                         A verb may identify several changes on the affected Node at once. This feature should be
    //                         used if event compression is used (see Part 3 for details).
    //                         Note that all verbs shall always be considered in the context where the
    //                         ModelChangeStructureDataType is used. A NodeDeleted may indicate that a Node was
    //                         removed from a view but still exists in other Views.
    //

    var addressSpace;


    before(function (done) {
        addressSpace = new AddressSpace();

        var xml_files = standard_nodeset_file;

        generate_address_space(addressSpace, xml_files, function (err) {
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });

    function createNodeWithNodeVersion(addressSpace,options) {

        var versionableNode = addressSpace.addObject({
            browseName: "VersionableNode" + options.browseName,
            nodeVersion: "0"
        });

        return versionableNode;
    }
    it("a node with a NodeVersion property shall trigger a ModelChangeEvent and update its NodeVersion when a object is added as one of its component",function() {


        var node = createNodeWithNodeVersion(addressSpace,{ browseName: "1" });

        var nodeVersionBefore = node.nodeVersion.readValue().value.value;
        nodeVersionBefore.toString().should.eql("1");


        sinon.spy(addressSpace,"_collectModelChange");

        var n1 = addressSpace.addObject({
            componentOf: node,
            browseName: "SomeNode"
        });


        var nodeVersionAfter = node.nodeVersion.readValue().value.value;
        nodeVersionAfter.toString().should.eql("2");

        addressSpace.rootFolder.objects.server.on("event",function(eventData) {
            //xx console.log("xxx eventData",eventData.toString());
        });

        addressSpace._collectModelChange.callCount.should.eql(2);
        addressSpace._collectModelChange.restore();
    });

    it("a node with a NodeVersion property shall trigger a ModelChangeEvent and update its NodeVersion when one of its child object is deleted",function() {

        // -------------------------------------------------------------------------------------------------------------
        // Given :  a version-able node containing a component
        // -------------------------------------------------------------------------------------------------------------
        var node = createNodeWithNodeVersion(addressSpace,{ browseName: "2" });
        var n1 = addressSpace.addObject({
            componentOf: node,
            browseName: "SomeNode"
        });

        var nodeVersionBefore = node.nodeVersion.readValue().value.value;
        nodeVersionBefore.toString().should.eql("2");

        sinon.spy(addressSpace,"_collectModelChange");
        addressSpace.rootFolder.objects.server.on("event",function(eventData) {
            //xx console.log("xxx eventData",eventData.toString());
        });

        // -------------------------------------------------------------------------------------------------------------
        // When:  the component is deleted
        // -------------------------------------------------------------------------------------------------------------
        addressSpace.deleteNode(n1);


        // -------------------------------------------------------------------------------------------------------------
        // Then:
        //   1. two model changes are collected
        addressSpace._collectModelChange.callCount.should.eql(2);

        //   2. node version should increase
        var nodeVersionAfter = node.nodeVersion.readValue().value.value;
        nodeVersionAfter.toString().should.eql("3");

        // -------------------------------------------------------------------------------------------------------------

        addressSpace._collectModelChange.restore();

    });

    it("a node with a NodeVersion property shall trigger a ModelChangeEvent and update its NodeVersion when a reference is added",function() {


        var n1 = addressSpace.addObject({
            browseName: "SomeNode3"
        });

        var node = createNodeWithNodeVersion(addressSpace,{ browseName: "3" });

        var nodeVersionBefore = node.nodeVersion.readValue().value.value;
        nodeVersionBefore.toString().should.eql("1");


        sinon.spy(addressSpace,"_collectModelChange");

        n1.addReference({referenceType: "Organizes", isForward: false, nodeId: node});

        var nodeVersionAfter = node.nodeVersion.readValue().value.value;
        nodeVersionAfter.toString().should.eql("2");

        addressSpace.rootFolder.objects.server.on("event",function(eventData) {
            //xx console.log("xxx eventData",eventData.toString());
        });

        addressSpace._collectModelChange.callCount.should.eql(2);
        addressSpace._collectModelChange.restore();

    });


    it("addressSpace#modelChangeTransactions should compress model change events ",function() {

        // -------------------------------------------------------------------------------------------------------------
        // Given :  a version-able node containing a component
        // -------------------------------------------------------------------------------------------------------------
        var node = createNodeWithNodeVersion(addressSpace,{ browseName: "3" });

        var nodeVersionBefore = node.nodeVersion.readValue().value.value;
        nodeVersionBefore.toString().should.eql("1");

        sinon.spy(addressSpace,"_collectModelChange");
        addressSpace.rootFolder.objects.server.on("event",function(eventData) {
            //xx console.log("xxx eventData",eventData.toString());
        });

        // -------------------------------------------------------------------------------------------------------------
        // When:  many operations are applied to a node , within a ModelChange Scope
        // -------------------------------------------------------------------------------------------------------------
        addressSpace.modelChangeTransaction(function() {
            var n1 = addressSpace.addObject({
                componentOf: node,
                browseName: "SomeNode2"
            });
            var n2 = addressSpace.addObject({
                componentOf: node,
                browseName: "SomeNode2"
            });

            var n3 = addressSpace.addObject({
                componentOf: node,
                browseName: "SomeNode3"
            });
            node.addReference({referenceType: "Organizes", nodeId: n2});
        });


        // -------------------------------------------------------------------------------------------------------------
        // Then:
        //   1. many model changes are collected
        addressSpace._collectModelChange.callCount.should.eql(8);

        //   2. node version should increase ony by one
        var nodeVersionAfter = node.nodeVersion.readValue().value.value;
        nodeVersionAfter.toString().should.eql("2");

        // -------------------------------------------------------------------------------------------------------------

        addressSpace._collectModelChange.restore();

    });



});
