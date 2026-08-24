import type { XmlAttributes } from "../dist/source";
import { SaxLtx } from "../dist/source/thirdparties/parser/lts";

function testString(xml_text: string) {
    const parser = new SaxLtx();
    let attributes: XmlAttributes | undefined = {};
    let content = "";
    parser.on("startElement", (_name: string, _attributes: XmlAttributes | undefined) => {
        attributes = _attributes;
    });
    parser.on("text", (text: string) => {
        content = text;
    });
    parser.write(xml_text);
    parser.end();
    return { tag: "t", attributes, content };
}
describe("xml special encoded characters", () => {
    it("should decode special characters", () => {
        testString("<a>&lt;&gt;&amp;&apos;&quot;</a>").content.should.eql("<>&'\"");
        testString('<a b="&lt;&gt;&amp;&apos;&quot;"/>').attributes.should.eql({ b: "<>&'\"" });
    });
});
