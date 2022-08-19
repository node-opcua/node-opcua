"use strict";
const should = require("should");

const { AttributeIds } = require("node-opcua-data-model");
const { DataType } = require("node-opcua-variant");
const { SimpleAttributeOperand } = require("node-opcua-types");
const { FilterOperator, LiteralOperand, constructEventFilter } = require("..");

describe("test constructEventFilter", function () {
    it("should construct a simple event filter with a single string (with namespace)", function () {
        const ef = constructEventFilter("2:SourceName");

        // console.log(ef.toString());

        ef.selectClauses.length.should.eql(2, "expected two elemens in the select clause : SourceName and ConditionId");

        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041");

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);
    });

    it("should construct a simple event filter", function () {
        const ef = constructEventFilter(["SourceName"]);

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(0);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType
    });

    it("should construct a simple event filter with two clauses", function () {
        const ef = constructEventFilter(["SourceName", "Time"]);

        ef.selectClauses.length.should.eql(3);

        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(0);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].browsePath.length.should.eql(1);
        ef.selectClauses[1].browsePath[0].name.should.eql("Time");
        ef.selectClauses[1].browsePath[0].namespaceIndex.should.eql(0);

        ef.selectClauses[1].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[2].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[2].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[2].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[2].browsePath.length.should.eql(0);
    });

    it("should construct a simple event filter with namespace", function () {
        const ef = constructEventFilter(["2:SourceName"]);

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);
    });

    it("should construct a simple event filter with a qualified name", function () {
        const ef = constructEventFilter([{ namespaceIndex: 2, name: "SourceName" }]);

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);
    });
    it("should construct a simple event filter with a qualified name", function () {
        const ef = constructEventFilter({ namespaceIndex: 2, name: "SourceName" });

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(1);
        ef.selectClauses[0].browsePath[0].name.should.eql("SourceName");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);
    });

    it("should construct a event filter with a 2 level browse path (form 1)", function () {
        const ef = constructEventFilter("2:Component1.3:Property1");

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(2);
        ef.selectClauses[0].browsePath[0].name.should.eql("Component1");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);
        ef.selectClauses[0].browsePath[1].name.should.eql("Property1");
        ef.selectClauses[0].browsePath[1].namespaceIndex.should.eql(3);
        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);
    });
    it("should construct a event filter with a 2 level browse path (form 2)", function () {
        const ef = constructEventFilter([["2:Component1", "3:Property1"]]);

        //xx console.log(ef.toString());

        ef.selectClauses.length.should.eql(2);
        ef.selectClauses[0].browsePath.length.should.eql(2);

        ef.selectClauses[0].browsePath[0].name.should.eql("Component1");
        ef.selectClauses[0].browsePath[0].namespaceIndex.should.eql(2);

        ef.selectClauses[0].browsePath[1].name.should.eql("Property1");
        ef.selectClauses[0].browsePath[1].namespaceIndex.should.eql(3);

        ef.selectClauses[0].attributeId.should.eql(AttributeIds.Value);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[1].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[1].browsePath.length.should.eql(0);

        should.exist(ef.whereClause.elements);
        ef.whereClause.elements.length.should.eql(0);
    });

    it("should construct a event filter with ConditionType", function () {
        const ef = constructEventFilter([], ["i=9999"]);

        ef.selectClauses.length.should.eql(1);

        ef.selectClauses[0].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses[0].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        ef.selectClauses[0].attributeId.should.eql(AttributeIds.NodeId);
        ef.selectClauses[0].browsePath.length.should.eql(0);

        ef.whereClause.elements.length.should.eql(1);
        ef.whereClause.elements[0].filterOperator.should.eql(FilterOperator.OfType);
        ef.whereClause.elements[0].filterOperands.length.should.eql(1);
        ef.whereClause.elements[0].filterOperands[0].should.be.instanceOf(LiteralOperand);
        ef.whereClause.elements[0].filterOperands[0].value.dataType.should.eql(DataType.NodeId);
        ef.whereClause.elements[0].filterOperands[0].value.value.toString().should.eql("ns=0;i=9999");
    });
});
