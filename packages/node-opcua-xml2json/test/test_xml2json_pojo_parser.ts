// tslint:disable:no-console
import * as mocha from "mocha";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import * as should  from "should";
import {
    ParserLike,
    ReaderStateParserLike,
    Xml2JsonPojo,
    startPojo,
    Xml2Json,
    XmlAttributes,
    json_parser
} from "..";

const doDebug = checkDebugFlag("TEST");
const debugLog = make_debugLog("TEST");
const _should = should;

describe("It should parse XML doc into json (deprecated)", () => {

    it("should parse a simple xml file to json", async () => {

        const parser = new Xml2JsonPojo();

        const json = await parser.parseString(
            "<Machine>" +
            "<DisplayName>&lt;HelloWorld&gt;</DisplayName>" +
            "</Machine>");

        json.should.eql(
            {
                machine: {
                    displayName: "<HelloWorld>"
                }
            });

    });

    it("should parse a xml file containing an array to json", async () => {

        const parser = new Xml2JsonPojo();

        const json = await parser.parseString(
            `
<Plant>
<ListOfMachines>
<Machine><DisplayName>Machine1</DisplayName></Machine>
<Machine><DisplayName>Machine2</DisplayName></Machine>
<Machine><DisplayName>Machine3</DisplayName></Machine>
<Machine><DisplayName>Machine4</DisplayName></Machine>
</ListOfMachines>
</Plant>
`);

        json.should.eql(
            {
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
                    init(name: string, attrs: XmlAttributes) {
                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj.name = attrs.name;
                    },

                    finish() {
                        this.obj.should.eql(expectedPojo);
                    },
                    startElement(this: any, elementName: string, attrs: XmlAttributes) {
                        if (!this.parser[elementName]) {

                            startPojo(this, elementName, attrs, (name: string, pojo: any) => {
                                this.obj[name] = pojo;

                            });
                        }
                    },
                    endElement(this: any, elementName: string) {
                        //  console.log("xxx elementName ", elementName);
                    },
                    parser: {
                        address: {
                            finish(this: any) {
                                this.parent.obj.address = this.text;
                            }
                        }
                    }
                }
            }
        });

        const obj = await parser.parseString(
            `<employees>
             <person name='John'>F
               <address>Paris</address>
               <otherStuff>Hello</otherStuff>
               <foo>
                    <bar>FooBar</bar>
               </foo>
             </person>
          </employees>`);

        (parser as any).obj.should.eql(expectedPojo);
        // obj.should.eql(expectedPojo);

    });

    it("loading more complex xml data", async () => {

        const _extensionObject_inner_parser: ParserLike = {
            TypeId: {
                parser: {
                    Identifier: {
                        finish(this: any) {
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

                startElement(this: any, elementName: string, attrs: any) {
                    const self = this.parent;
                    self.extensionObject = null;
                },

                finish(this: any) {
                    const self = this.parent;
                    switch (self.typeDefinitionId.toString()) {
                        case "i=1": // Structure1
                            self.extensionObject = self.parser.Body.parser.EnumValueType.enumValueType;
                            break;
                        case "i=2": // Structure2
                            self.extensionObject = self.parser.Body.parser.Argument.argument;
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
                init(this: any) {
                    this.typeDefinitionId = {};
                    this.extensionObject = null;
                },
                finish(this: any) {
                },
                parser: _extensionObject_inner_parser
            }
        };

        let startElementCount = 0;
        let endElementCount = 0;
        const reader: ReaderStateParserLike = {
            init(this: any, elementName: string) {
                this.obj = {};
            },
            finish(this: any) {
                this.parent.result = this.obj;
            },
            parser: {
                ListOfExtensionObject: {
                    init(this: any) {
                        this.listData = [];
                    },
                    parser: extensionObject_parser,
                    finish(this: any) {
                        this.parent.obj.value = {
                            value: this.listData
                        };

                    },
                    startElement(this: any, elementName: string) {
                        this.listData = this,
                            startElementCount++;
                    },
                    endElement(this: any, elementName: string) {
                        endElementCount++;
                    }
                }
            }
        };

        const parser = new Xml2Json(reader);

        const result = await parser.parseString(
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
