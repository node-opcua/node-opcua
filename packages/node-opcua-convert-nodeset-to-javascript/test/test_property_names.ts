import { NodeClass } from "node-opcua-data-model";
import should from "should";
import { setChildAccessorShadowing, toJavascritPropertyName } from "../dist/utils2.js";

describe("property names of generated interfaces", () => {
    afterEach(() => {
        setChildAccessorShadowing(undefined);
    });

    it("lower-cases the browse name the way the runtime does", () => {
        should(toJavascritPropertyName("EnabledState", { ignoreConflictingName: true })).eql("enabledState");
        should(toJavascritPropertyName("EURange", { ignoreConflictingName: true })).eql("euRange");
        should(toJavascritPropertyName("Some.Name With#Char", { ignoreConflictingName: true })).eql("some_Name_With_Char");
    });

    it("keeps escaping the names it has always escaped, with or without the runtime rule", () => {
        should(toJavascritPropertyName("NamespaceUri", { ignoreConflictingName: true })).eql("$namespaceUri");
        should(toJavascritPropertyName("EventNotifier", { ignoreConflictingName: true, parentNodeClass: NodeClass.Object })).eql(
            "$eventNotifier"
        );
        should(toJavascritPropertyName("NamespaceUri", { ignoreConflictingName: false })).eql("namespaceUri");
    });

    it("escapes what the runtime cannot expose on a node of the parent class, and nothing else", () => {
        setChildAccessorShadowing((nodeClass) =>
            nodeClass === NodeClass.Variable ? new Set(["dataType", "valueRank", "then"]) : new Set(["then"])
        );
        should(toJavascritPropertyName("DataType", { ignoreConflictingName: true, parentNodeClass: NodeClass.Variable })).eql(
            "$dataType"
        );
        should(toJavascritPropertyName("DataType", { ignoreConflictingName: true, parentNodeClass: NodeClass.Object })).eql(
            "dataType"
        );
        should(toJavascritPropertyName("Then", { ignoreConflictingName: true, parentNodeClass: NodeClass.Object })).eql("$then");
        // no parent class known: only the historical list applies
        should(toJavascritPropertyName("DataType", { ignoreConflictingName: true })).eql("dataType");
    });
});
