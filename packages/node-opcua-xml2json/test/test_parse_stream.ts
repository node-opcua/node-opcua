import should from "should";
import { type ReaderStateParser, Xml2Json } from "../dist/source/index.js";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<Root xmlns="urn:test">
  <Item name="café">héllo wörld 😀</Item>
  <Item name="two"><![CDATA[x < y]]></Item>
  <!-- a comment -->
  <Group><Item name="in">nested</Item></Group>
</Root>`;

function makeParser(): { parser: Xml2Json; items: Array<{ name: string; text: string }> } {
    const items: Array<{ name: string; text: string }> = [];
    const state: ReaderStateParser = {
        parser: {
            Root: {
                parser: {
                    Item: {
                        init(this: { name?: string }, _name: string, attrs: Record<string, string>) {
                            this.name = attrs.name;
                        },
                        finish(this: { name?: string; text: string }) {
                            items.push({ name: this.name || "", text: this.text });
                        }
                    },
                    Group: {
                        parser: {
                            Item: {
                                init(this: { name?: string }, _name: string, attrs: Record<string, string>) {
                                    this.name = attrs.name;
                                },
                                finish(this: { name?: string; text: string }) {
                                    items.push({ name: `group.${this.name || ""}`, text: this.text });
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    return { parser: new Xml2Json(state), items };
}

async function* pieces<T extends string | Uint8Array>(data: T, size: number): AsyncGenerator<T> {
    for (let i = 0; i < data.length; i += size) {
        yield data.slice(i, i + size) as T;
    }
}

describe("Xml2Json#parseStream", () => {
    const expected = [
        { name: "café", text: "héllo wörld 😀" },
        { name: "two", text: "x < y" },
        { name: "group.in", text: "nested" }
    ];

    it("gives what parseString gives, from text chunks of any size", async () => {
        const reference = makeParser();
        reference.parser.parseString(xml);
        should(reference.items).eql(expected);
        for (const size of [1, 2, 3, 7, 64, 100000]) {
            const { parser, items } = makeParser();
            await parser.parseStream(pieces(xml, size));
            should(items).eql(expected, `chunk size ${size}`);
        }
    });

    it("decodes UTF-8 bytes whose characters straddle the chunks, and drops the byte-order mark", async () => {
        const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml, "utf8")]);
        for (const size of [1, 2, 3, 5, 4096]) {
            const { parser, items } = makeParser();
            await parser.parseStream(pieces(new Uint8Array(bytes), size));
            should(items).eql(expected, `chunk size ${size}`);
        }
    });

    it("drops a byte-order mark given as text", async () => {
        const { parser, items } = makeParser();
        await parser.parseStream([`﻿${xml.slice(0, 10)}`, xml.slice(10)]);
        should(items).eql(expected);
    });

    it("can be used again for a second document", async () => {
        const { parser, items } = makeParser();
        await parser.parseStream(pieces(xml, 50));
        await parser.parseStream(pieces(xml, 51));
        should(items).eql([...expected, ...expected]);
    });

    it("exposes begin, write and end for a caller that drives the chunks itself", () => {
        const { parser, items } = makeParser();
        parser.begin();
        parser.write(Buffer.from(xml.slice(0, 30), "utf8"));
        parser.write(xml.slice(30));
        parser.end();
        should(items).eql(expected);
        should(() => parser.write("x")).throw(/begin/);
    });
});
