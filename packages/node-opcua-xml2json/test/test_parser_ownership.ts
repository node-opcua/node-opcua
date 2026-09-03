/**
 * A parser definition is a plain object its author may hand to many parsers; each Xml2Json builds
 * its own reader states from it. Two parsers reading at the same time therefore never share the
 * element being read.
 */
import should from "should";
import { ReaderState, type ReaderStateParserLike, Xml2Json } from "../dist/source/index.js";

interface Seen {
    items: string[];
}
function definition(seen: Seen): ReaderStateParserLike {
    return {
        parser: {
            Item: {
                finish(this: { text: string }) {
                    seen.items.push(this.text);
                }
            }
        }
    };
}

describe("Xml2Json owns its reader states", () => {
    it("leaves the definition it was built from a plain object", () => {
        const seen: Seen = { items: [] };
        const shared = definition(seen);
        const root: ReaderStateParserLike = { parser: { Root: shared } };
        new Xml2Json(root);
        new Xml2Json(root);
        should(Object.getPrototypeOf(root.parser)).equal(Object.prototype);
        should(root.parser?.Root).equal(shared);
        should(shared.parser?.Item instanceof ReaderState).eql(false);
        should(Object.getPrototypeOf(shared.parser)).equal(Object.prototype);
    });

    it("gives two parsers built from one definition distinct states", () => {
        const seen: Seen = { items: [] };
        const root: ReaderStateParserLike = { parser: { Root: definition(seen) } };
        const a = new ReaderState(root);
        const b = new ReaderState(root);
        should(a.parser.Root).not.equal(b.parser.Root);
        should(a.parser.Root.parser.Item).not.equal(b.parser.Root.parser.Item);
    });

    it("keeps a reader state instance the definition names, as the author intended", () => {
        const item = new ReaderState({});
        const root: ReaderStateParserLike = { parser: { Root: { parser: { Item: item } } } };
        const a = new ReaderState(root);
        const b = new ReaderState(root);
        should(a.parser.Root.parser.Item).equal(item);
        should(b.parser.Root.parser.Item).equal(item);
    });

    it("builds one state per engine for a definition that refers to itself", () => {
        const node: ReaderStateParserLike = { parser: {} };
        node.parser!.Node = node;
        const a = new ReaderState({ parser: { Node: node } });
        const b = new ReaderState({ parser: { Node: node } });
        should(a.parser.Node.parser.Node).equal(a.parser.Node);
        should(b.parser.Node).not.equal(a.parser.Node);
    });

    it("keeps two interleaved documents apart", () => {
        const seenA: Seen = { items: [] };
        const seenB: Seen = { items: [] };
        const shared = {
            parser: {
                Item: {
                    finish(this: { text: string; parent: { seen: Seen } }) {
                        this.parent.seen.items.push(this.text);
                    }
                }
            }
        };
        const make = (seen: Seen) =>
            new Xml2Json({
                parser: {
                    Root: {
                        init(this: { seen: Seen }) {
                            this.seen = seen;
                        },
                        ...shared
                    }
                }
            });
        const a = make(seenA);
        const b = make(seenB);
        a.begin();
        b.begin();
        a.write("<Root><Item>a1</Item><Item>a");
        b.write("<Root><Item>b1</Item><Item>b");
        a.write("2</Item></Root>");
        b.write("2</Item></Root>");
        a.end();
        b.end();
        should(seenA.items).eql(["a1", "a2"]);
        should(seenB.items).eql(["b1", "b2"]);
    });
});
