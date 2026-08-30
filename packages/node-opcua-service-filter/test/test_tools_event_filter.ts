import { AttributeIds } from "node-opcua-data-model";
import { SimpleAttributeOperand } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { constructEventFilter, FilterOperator, LiteralOperand, ofType } from "..";

describe("test constructEventFilter", () => {
    it("should construct a simple event filter with a single string (with namespace)", () => {
        const ef = constructEventFilter("2:SourceName");

        // console.log(ef.toString());

        should(ef.selectClauses?.length).eql(1, "expected one element in the select clause : SourceName");

        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        should(ef.selectClauses?.[0]?.typeDefinitionId.toString()).eql("ns=0;i=2041");
    });

    it("should construct a simple event filter", () => {
        const ef = constructEventFilter(["SourceName"]);

        should(ef.selectClauses?.length).eql(1);

        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(0);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType
    });

    it("should construct a simple event filter", () => {
        const ef = constructEventFilter(["ConditionId"]);

        should(ef.selectClauses?.length).eql(1);

        ef.selectClauses?.[0]?.should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.NodeId);
        should(ef.selectClauses?.[0]?.browsePath?.length).eql(0);
    });

    it("should construct a simple event filter with two clauses", () => {
        const ef = constructEventFilter(["SourceName", "Time", "ConditionId"]);

        should(ef.selectClauses?.length).eql(3);

        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(0);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        should(ef.selectClauses?.[1].browsePath?.length).eql(1);
        should(ef.selectClauses?.[1].browsePath?.[0]?.name).eql("Time");
        should(ef.selectClauses?.[1].browsePath?.[0]?.namespaceIndex).eql(0);

        should(ef.selectClauses?.[1].attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[1].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses?.[2].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses?.[2].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        should(ef.selectClauses?.[2].attributeId).eql(AttributeIds.NodeId);
        should(ef.selectClauses?.[2].browsePath?.length).eql(0);
    });

    it("should construct a simple event filter with namespace", () => {
        const ef = constructEventFilter(["2:SourceName", "ConditionId"]);

        should(ef.selectClauses?.length).eql(2);
        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        ef.selectClauses?.[1].should.be.instanceOf(SimpleAttributeOperand);
        ef.selectClauses?.[1].typeDefinitionId.toString().should.eql("ns=0;i=2782"); // ConditionType
        should(ef.selectClauses?.[1].attributeId).eql(AttributeIds.NodeId);
        should(ef.selectClauses?.[1].browsePath?.length).eql(0);
    });

    it("should construct a simple event filter with a qualified name", () => {
        const ef = constructEventFilter([{ namespaceIndex: 2, name: "SourceName" }]);

        should(ef.selectClauses?.length).eql(1);

        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType
    });

    it("should construct a simple event filter with a qualified name", () => {
        const ef = constructEventFilter({ namespaceIndex: 2, name: "SourceName" });

        should(ef.selectClauses?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("SourceName");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType
    });

    it("should construct a event filter with a 2 level browse path (form 1)", () => {
        const ef = constructEventFilter("2:Component1.3:Property1");

        should(ef.selectClauses?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.length).eql(2);
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("Component1");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);
        should(ef.selectClauses?.[0]?.browsePath?.[1].name).eql("Property1");
        should(ef.selectClauses?.[0]?.browsePath?.[1].namespaceIndex).eql(3);
        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType
    });
    it("should construct a event filter with a 2 level browse path (form 2)", () => {
        const ef = constructEventFilter([["2:Component1", "3:Property1"]]);

        //xx console.log(ef.toString());

        should(ef.selectClauses?.length).eql(1);
        should(ef.selectClauses?.[0]?.browsePath?.length).eql(2);

        should(ef.selectClauses?.[0]?.browsePath?.[0]?.name).eql("Component1");
        should(ef.selectClauses?.[0]?.browsePath?.[0]?.namespaceIndex).eql(2);

        should(ef.selectClauses?.[0]?.browsePath?.[1].name).eql("Property1");
        should(ef.selectClauses?.[0]?.browsePath?.[1].namespaceIndex).eql(3);

        should(ef.selectClauses?.[0]?.attributeId).eql(AttributeIds.Value);
        ef.selectClauses?.[0]?.typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType

        should.exist(ef.whereClause.elements);
        should(ef.whereClause?.elements?.length).eql(0);
    });

    it("should construct a event filter with ConditionType", () => {
        const ef = constructEventFilter([], ofType("i=9999"));

        !ef.selectClauses || ef.selectClauses.length.should.eql(0);

        should(ef.whereClause?.elements?.length).eql(1);
        should(ef.whereClause?.elements?.[0]?.filterOperator).eql(FilterOperator.OfType);
        should(ef.whereClause?.elements?.[0]?.filterOperands?.length).eql(1);
        should(ef.whereClause?.elements?.[0]?.filterOperands?.[0]).be.instanceOf(LiteralOperand);
        const operand = ef.whereClause?.elements?.[0]?.filterOperands?.[0] as LiteralOperand | undefined;
        should(operand?.value.dataType).eql(DataType.NodeId);
        should(operand?.value.value.toString()).eql("ns=0;i=9999");
    });
});
