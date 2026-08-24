import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import should from "should";
import {
    json_parser,
    type ParserLike,
    type ReaderStateParserLike,
    startPojo,
    Xml2Json,
    Xml2JsonPojo,
    type XmlAttributes
} from "..";

const _doDebug = checkDebugFlag("TEST");
const _debugLog = make_debugLog("TEST");
const _should = should;

describe("It should parse XML doc into json (deprecated)", () => {
    it("should parse a simple xml file to json", async () => {
        const parser = new Xml2JsonPojo();

        const json = parser.parseString("<Machine>" + "<DisplayName>&lt;HelloWorld&gt;</DisplayName>" + "</Machine>");

        json.should.eql({
            machine: {
                displayName: "<HelloWorld>"
            }
        });
    });

    it("should parse a xml file containing an array to json", async () => {
        const parser = new Xml2JsonPojo();

        const json = parser.parseString(
            `
<Plant>
<ListOfMachines>
<Machine><DisplayName>Machine1</DisplayName></Machine>
<Machine><DisplayName>Machine2</DisplayName></Machine>
<Machine><DisplayName>Machine3</DisplayName></Machine>
<Machine><DisplayName>Machine4</DisplayName></Machine>
</ListOfMachines>
</Plant>
`
        );

        json.should.eql({
            plant: {
                machines: [
                    { displayName: "Machine1" },
                    { displayName: "Machine2" },
                    { displayName: "Machine3" },
                    { displayName: "Machine4" }
                ]
            }
        });
    });

    it("should mix both type of parser", async () => {
        const expectedPojo = {
            address: "Paris",
            foo: { bar: "FooBar" },
            name: "John",
            otherStuff: "Hello"
        };

        const parser = new Xml2Json({
            parser: {
                person: {
                    init(_name: string, attrs: XmlAttributes) {
                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj.name = attrs.name;
                    },

                    finish() {
                        this.obj.should.eql(expectedPojo);
                    },
                    startElement(elementName: string, attrs: XmlAttributes) {
                        if (!this.parser[elementName]) {
                            startPojo(this, elementName, attrs, (name: string, pojo: unknown) => {
                                this.obj[name] = pojo;
                            });
                        }
                    },
                    endElement(_elementName: string) {
                        //  console.log("xxx elementName ", elementName);
                    },
                    parser: {
                        address: {
                            finish() {
                                this.parent.obj.address = this.text;
                            }
                        }
                    }
                }
            }
        });

        const _obj = parser.parseString(
            `<employees>
             <person name='John'>F
               <address>Paris</address>
               <otherStuff>Hello</otherStuff>
               <foo>
                    <bar>FooBar</bar>
               </foo>
             </person>
          </employees>`
        );

        (parser as unknown as { obj: Record<string, unknown> }).obj.should.eql(expectedPojo);
        // obj.should.eql(expectedPojo);
    });

    it("loading more complex xml data", async () => {
        const _extensionObject_inner_parser: ParserLike = {
            TypeId: {
                parser: {
                    Identifier: {
                        finish() {
                            const self = this.parent.parent;
                            self.typeDefinitionId = this.text.trim();
                        }
                    }
                }
            },

            Body: {
                parser: {
                    Structure1: json_parser,
                    Structure2: json_parser
                },

                startElement(_elementName: string, _attrs: XmlAttributes) {
                    this.parent.extensionObject = null;
                },

                finish() {
                    const parent = this.parent;
                    switch (parent.typeDefinitionId.toString()) {
                        case "i=1": // Structure1
                            parent.extensionObject = parent.parser.Body.parser.EnumValueType.enumValueType;
                            break;
                        case "i=2": // Structure2
                            parent.extensionObject = parent.parser.Body.parser.Argument.argument;
                            break;
                        default: {
                            break;
                        }
                    }
                }
            }
        };
        const extensionObject_parser: ParserLike = {
            ExtensionObject: {
                init() {
                    this.typeDefinitionId = {};
                    this.extensionObject = null;
                },
                finish() {
                    /** */
                },
                parser: _extensionObject_inner_parser
            }
        };

        let startElementCount = 0;
        let endElementCount = 0;
        const reader: ReaderStateParserLike = {
            init(_elementName: string) {
                this.obj = {};
            },
            finish() {
                this.parent.result = this.obj;
            },
            parser: {
                ListOfExtensionObject: {
                    init() {
                        this.listData = [];
                    },
                    parser: extensionObject_parser,
                    finish() {
                        this.parent.obj.value = {
                            value: this.listData
                        };
                    },
                    startElement(_elementName: string) {
                        this.listData = this;
                        startElementCount++;
                    },
                    endElement(_elementName: string) {
                        endElementCount++;
                    }
                }
            }
        };

        const parser = new Xml2Json(reader);

        const _result = parser.parseString(
            `<Stuff>
<ListOfExtensionObject>
    <ExtensionObject>
        <TypeId>i=1</TypeId>
        <Body>
            <Structure1>
                <Name>Foo</Name>
            </Structure1>
        </Body>
    </ExtensionObject>
    <ExtensionObject>
        <TypeId>i=2</TypeId>
        <Body>
            <Structure2>
                <Name>Bar</Name>
            </Structure2>
        </Body>
    </ExtensionObject>
</ListOfExtensionObject>
</Stuff>`
        );
        startElementCount.should.eql(2);
        endElementCount.should.eql(2);
        // xx console.log("startElementCount", startElementCount);
        // xx console.log("endElementCount",   endElementCount);
        // xx console.log("result = ", result);
        // console.log("result = ", parser.result);
    });
});
