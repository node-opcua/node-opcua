import should from "should";
import { SaxLtx } from "../dist/source/thirdparties/parser/lts.js";

interface Event {
    kind: "start" | "end" | "text";
    name?: string;
    attrs?: Record<string, string>;
    text?: string;
}

function parse(xml: string, chunkSize: number, handlers = true): Event[] {
    const events: Event[] = [];
    const parser = handlers
        ? new SaxLtx({
              onStartElement: (name, attrs) => events.push({ kind: "start", name, attrs: { ...attrs } }),
              onEndElement: (name) => events.push({ kind: "end", name }),
              onText: (text) => events.push({ kind: "text", text })
          })
        : new SaxLtx();
    if (!handlers) {
        parser.on("startElement", (name: string, attrs: Record<string, string>) =>
            events.push({ kind: "start", name, attrs: { ...attrs } })
        );
        parser.on("endElement", (name: string) => events.push({ kind: "end", name }));
        parser.on("text", (text: string) => events.push({ kind: "text", text }));
    }
    if (chunkSize <= 0) {
        parser.write(xml);
    } else {
        for (let i = 0; i < xml.length; i += chunkSize) {
            parser.write(xml.slice(i, i + chunkSize));
        }
    }
    parser.end("");
    return events;
}

describe("SaxLtx fed in chunks, with CDATA", () => {
    const xml = `<?xml version="1.0"?>
<root a="1" b = 'two' c="x &amp; y">
  <child   x="&lt;3"/>
  <text>hello   world &amp; more</text>
  <data><![CDATA[x < y & z]]></data>
  <!-- a comment with ]]> inside -->
  <mixed>before<![CDATA[]]>after</mixed>
</root>`;

    it("gives the same events whatever the chunk size", () => {
        const whole = parse(xml, 0);
        should(whole.length).be.greaterThan(10);
        for (const chunkSize of [1, 2, 3, 5, 7, 16, 64]) {
            should(parse(xml, chunkSize)).eql(whole);
        }
    });

    it("emits the content of a CDATA section as text, unescaped and unchanged", () => {
        const events = parse(xml, 0);
        const texts = events.filter((e) => e.kind === "text").map((e) => e.text);
        should(texts).containEql("x < y & z");
        should(texts).containEql("hello   world & more");
        should(texts).containEql("before");
        should(texts).containEql("after");
        // the "]]>" inside the comment is not a CDATA end
        should(events.filter((e) => e.kind === "start").map((e) => e.name)).eql(["root", "child", "text", "data", "mixed"]);
    });

    it("keeps attribute values across a chunk boundary", () => {
        for (const chunkSize of [4, 9]) {
            const root = parse(xml, chunkSize).find((e) => e.kind === "start" && e.name === "root");
            should(root?.attrs).eql({ a: "1", b: "two", c: "x & y" });
        }
    });

    it("still emits events for a caller that gives no handlers", () => {
        should(parse(xml, 0, false)).eql(parse(xml, 0, true));
    });
});
