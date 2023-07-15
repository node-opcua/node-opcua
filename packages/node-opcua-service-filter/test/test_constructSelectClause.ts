import should from "should";
import { AttributeIds } from "node-opcua-basic-types";
import { constructSelectClause } from "..";

const doDebug = false;

describe("constructSelectClause", () => {
    it("constructSelectClause form 1 - single string", () => {
        const selectClause = constructSelectClause("Hello");
        doDebug && console.log(selectClause.toString());

        selectClause.length.should.eql(1);
        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(1);
        selectClause[0].browsePath![0].toString().should.eql("Hello");
    });
    it("constructSelectClause form 2 - array with a single string", () => {
        const selectClause = constructSelectClause(["Hello"]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(1);
        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(1);
        selectClause[0].browsePath![0].toString().should.eql("Hello");
    });
    it("constructSelectClause form 3 - array with a QualifiedNameLike", () => {
        const selectClause = constructSelectClause([[{ name: "Hello" }]]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(1);
        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(1);
        selectClause[0].browsePath![0].toString().should.eql("Hello");
    });
    it("constructSelectClause form 4 - array with a array of string", () => {
        const selectClause = constructSelectClause([["Hello", "2:World"]]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(1);
        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(2);
        selectClause[0].browsePath![0].toString().should.eql("Hello");
        selectClause[0].browsePath![1].toString().should.eql("2:World");
    });
    it("constructSelectClause form 5 - array with a array with a mixture of string and qualified Liked element", () => {
        const selectClause = constructSelectClause([["Hello", { namespaceIndex: 2, name: "World" }]]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(1);
        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(2);
        selectClause[0].browsePath![0].toString().should.eql("Hello");
        selectClause[0].browsePath![1].toString().should.eql("2:World");
    });
    it("constructSelectClause form 6 - with an array of simple string", () => {
        const selectClause = constructSelectClause(["SourceName", "Message", "ReceiveTime"]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(3);

        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(1);
        selectClause[0].browsePath![0].toString().should.eql("SourceName");

        selectClause[1].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[1].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[1].browsePath);
        selectClause[1].browsePath?.length.should.eql(1);
        selectClause[1].browsePath![0].name!.should.eql("Message");
        selectClause[1].browsePath![0].namespaceIndex!.should.eql(0);

        selectClause[2].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[2].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[2].browsePath);
        selectClause[2].browsePath?.length.should.eql(1);
        selectClause[2].browsePath![0].toString().should.eql("ReceiveTime");
    });

    it("constructSelectClause form 7 - with an array of composite string with namespace ", () => {
        const selectClause = constructSelectClause(["SourceName", "2:EnabledState.3:EffectiveDisplayName"]);
        doDebug && console.log(selectClause.toString());
        selectClause.length.should.eql(2);

        selectClause[0].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[0].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[0].browsePath);
        selectClause[0].browsePath?.length.should.eql(1);
        selectClause[0].browsePath![0].toString().should.eql("SourceName");

        selectClause[1].typeDefinitionId.toString().should.eql("ns=0;i=2041"); // BaseEventType;
        selectClause[1].attributeId.should.eql(AttributeIds.Value);
        should.exist(selectClause[1].browsePath);
        selectClause[1].browsePath?.length.should.eql(2);
        selectClause[1].browsePath![0].name!.should.eql("EnabledState");
        selectClause[1].browsePath![0].namespaceIndex!.should.eql(2);

        selectClause[1].browsePath![1].name!.should.eql("EffectiveDisplayName");
        selectClause[1].browsePath![1].namespaceIndex!.should.eql(3);
    });
});
