// tslint:disable:no-console
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { should } from "should";
import {
    json_extractor,
    json_parser,
    ParserLike,
    ReaderState,
    ReaderStateParser,
    ReaderStateParserLike,
    Xml2Json,
    XmlAttributes
} from "..";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

const _should = should;

type ErrorCallback = (err?: Error) => void;

describe("XMLToJSON", () => {

    it("should parse a simple xml data string", (done: ErrorCallback) => {

        let init_called = false;
        let finish_called = false;
        const parser = new Xml2Json({

            parser: {

                person: {

                    init(name: string, attrs: XmlAttributes) {
                        debugLog("person:init name = ", name);
                        name.should.equal("person");
                        attrs.should.have.property("name");
                        attrs.name.should.equal("John");
                        init_called = true;
                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj.name = attrs.name;
                    },

                    finish() {
                        debugLog("person:finish name = ");
                        this.obj.should.eql({ name: "John", address: "Paris" });
                        finish_called = true;
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

        parser.parseString(
          "<employees>" +
          "   <person name='John'>" +
          "     <address>Paris</address>" +
          "   </person>" +
          "</employees>", () => {

              init_called.should.equal(true);

              finish_called.should.equal(true);

              (parser as any).obj.should.eql({ name: "John", address: "Paris" });
              done();
          });

    });

    it("should parse a UTF8 encoded xml file with a BOM", function(this: any, done: ErrorCallback) {

        const nodesets = require("node-opcua-nodesets");

        // accommodate for slow RPI
        if (process.arch === "arm") {
            this.timeout(40000);
            this.slow(20000);
        }
        const xml_file = nodesets.standard_nodeset_file;
        const parser = new Xml2Json({});
        parser.parse(xml_file, (err?: Error) => {
            done(err);
        });
    });

    it("should parse a escaped string", (done: ErrorCallback) => {

        let displayName: string | null = null;

        const parser = new Xml2Json({

            parser: {
                DisplayName: {
                    finish(this: any) {
                        displayName = this.text;
                    }
                }
            }
        });

        parser.parseString(
          "<object>" +
          "  <DisplayName>&lt;HelloWorld&gt;</DisplayName>" +
          "</object>", () => {

              displayName!.should.eql("<HelloWorld>");

              done();
          });
    });

    it("should parse a array", (done: ErrorCallback) => {

        function BasicType_parser1(
          dataType: string,
          parseFunc: (this: any, text: string) => any
        ): ParserLike {

            const _parser: ParserLike = {};

            const r: ReaderStateParserLike = {

                init(this: any, name: string, attrs: XmlAttributes) {
                    this.value = 0;
                },

                finish(this: any) {
                    this.value = parseFunc.call(this, this.text);
                    // xx console.log("xxx.... parser, ", this.value);
                }
            };
            _parser[dataType] = r;
            return _parser;
        }

        function ListOf1(
          dataType: string,
          parseFunc: any
        ) {
            return {
                init(this: any) {
                    this.listData = [];
                },

                parser: BasicType_parser1(dataType, parseFunc),

                finish(this: any) {
                    this.parent.array = {
                        value: this.listData
                    };
                    // xx console.log("xxx.... finish, ", this.parent.parent);
                },
                endElement(this: any, element: string) {
                    this.listData.push(this.parser[dataType].value);
                    // xx console.log("xxx.... endElement, ", this.listData);
                }
            };
        }

        const state_Variant = {
            parser: {
                ListOfFloat: ListOf1("Float", parseFloat)
            }
        };

        const parser = new Xml2Json(state_Variant);

        parser.parseString(
          `<Value>
            <uax:ListOfFloat>
                <uax:Float>11</uax:Float>
                <uax:Float>12</uax:Float>
                <uax:Float>13</uax:Float>
                <uax:Float>21</uax:Float>
                <uax:Float>22</uax:Float>
                <uax:Float>23</uax:Float>
                <uax:Float>31</uax:Float>
                <uax:Float>32</uax:Float>
                <uax:Float>33</uax:Float>
            </uax:ListOfFloat>
        </Value>`, () => {
              done();
          });

    });
    it("should parse a array 2", (done: ErrorCallback) => {

        done();
    });
});

describe("It should parse XML doc into json", () => {

    it("should parse a simple xml file to json", async () => {

        const parser = new Xml2Json();

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

        const parser = new Xml2Json();

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

                            this.startPojo(elementName, attrs, (name: string, pojo: any) => {
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

// <Definition Name="SomeName">
//   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
//      [<Description>text</Description>]
//   <Field>
// </Definition>
const definition_parser = {
    init(this: any, name: string, attrs: XmlAttributes) {
        this.parent.obj.definition = [];
        this.parent.obj.definition_name = attrs.Name;
        this.array = this.parent.obj.definition;
    },
    parser: {
        Field: {
            init(this: any) {
                this.description = undefined;
            },
            parser: {
                Description: {
                    finish(this: any) {
                        this.parent.description = this.text;
                    }
                }
            },
            finish(this: any) {
                this.parent.array.push({
                    dataType: this.attrs.DataType,
                    description: this.description,
                    name: this.attrs.Name,
                    value: this.attrs.Value,
                    valueRank: parseInt(this.attrs.ValueRank || "-1", 10)
                });
            }
        }
    }
};

function BasicType_parser(
  dataType: string,
  parseFunc: (this: any, text: string) => any
): ParserLike {

    const _parser: ParserLike = {};

    const r: ReaderStateParserLike = {
        init(this: any, elementName: string, attrs: XmlAttributes) {
            this.value = undefined;
        },
        finish(this: any) {
            this.value = parseFunc.call(this, this.text);
        }
    };
    _parser[dataType] = r;
    return _parser;
}

function ListOf(
  dataType: string,
  parseFunc: any
) {
    return {
        init(this: any) {
            this.listData = [];
        },

        parser: BasicType_parser(dataType, parseFunc),

        finish(this: any) {
            this.parent.value = this.listData;
        },
        endElement(this: any, elementName: string) {
            this.listData.push(this.parser[dataType].value);
        }
    };
}

const localizedTextReader: ReaderStateParserLike = {
    init(this: any) {
        this.localizedText = {};
    },
    parser: {
        Locale: {
            finish(this: any) {
                this.parent.localizedText.locale = this.text.trim();
            }
        },
        Text: {
            finish(this: any) {
                this.parent.localizedText.text = this.text.trim();
            }
        }
    },
    finish(this: any) {
        this.parent.value = this.text;
    }
};

const partials: { [key: string]: ReaderStateParserLike } = {
    LocalizedText: localizedTextReader,
    String: {
        finish(this: any) {
            this.parent.value = this.text;
        }
    },

    Boolean: {
        finish(this: any) {
            this.parent.value = (this.text.toLowerCase() === "true");
        }
    },

    ByteString: {
        init(this: any) {
            this.value = null;
        },
        finish(this: any) {
            const base64text = this.text;
            const byteString = Buffer.from(base64text, "base64");
            this.parent.value = byteString;
        }
    },

    Float: {
        finish(this: any) {
            this.parent.value = parseFloat(this.text);
        }
    },

    Double: {
        finish(this: any) {
            this.parent.value = parseFloat(this.text);
        }
    },

    Int8: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },

    Int16: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },
    Int32: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },
    Int64: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },

    UInt8: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },

    UInt16: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },
    UInt32: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },
    UInt64: {
        finish(this: any) {
            this.parent.value = parseInt(this.text, 10);
        }
    },

    ListOfLocalizedText: {
        init(this: any) {
            this.listData = [];
        },
        parser: { LocalizedText: localizedTextReader },
        finish(this: any) {
            this.parent.value = this.listData;
        },
        endElement(this: any/*element*/) {
            this.listData.push(this.parser.LocalizedText.localizedText);
        }
    },

    ListOfDouble: ListOf("Double", parseFloat),

    ListOfFloat: ListOf("Float", parseFloat),

    ListOfInt32: ListOf("Int32", parseInt),

    ListOfInt16: ListOf("Int16", parseInt),

    ListOfInt8: ListOf("Int8", parseInt),

    ListOfUint32: ListOf("Uint32", parseInt),

    ListOfUint16: ListOf("Uint16", parseInt),

    ListOfUint8: ListOf("Uint8", parseInt)
};

interface Field {
    dataType: any;
    description?: string;
    name: string;
    value?: any;
    valueRank?: number; // default is -1 => scalar
}

interface Definition {
    name: string;
    fields: Field[];
}

interface DefinitionMap {
    findDefinition(name: string): Definition;
}

function getOrCreateReaderFromDefinition(
  definitionName: string,
  definitionMap: DefinitionMap,
  readerMap: any
): ReaderState {

    // is it a basic type ?
    if (partials.hasOwnProperty(definitionName)) {
        return new ReaderState(partials[definitionName]);
    }

    let reader: ReaderState = readerMap[definitionName]!;

    if (reader) {
        return reader;
    }
    const definition = definitionMap.findDefinition(definitionName);

    reader = new ReaderState({
        parser: {}
    });

    for (const field  of definition.fields) {

        const fieldReader = getOrCreateReaderFromDefinition(field.dataType, definitionMap, readerMap);
        if (!fieldReader) {
            throw new Error(" Cannot find reader for dataType " + field.dataType);
        }

        if (field.valueRank === undefined || field.valueRank === -1) {
            reader.parser![field.name] = fieldReader;
        } else if (field.valueRank === 1) {

            const listReader: ReaderState = new ReaderState({
                init(this: any) {
                    this.listData = [];
                },
                parser: {},
                finish(this: any) {
                    this.parent.value = this.listData;
                },
                endElement(this: any/*element*/) {
                    const item = this.parser[field.dataType].data;
                    this.listData.push(this.parser);
                }
            });

            listReader.parser![field.dataType] = fieldReader;
            reader.parser![field.name] = listReader;
        } else {
            throw new Error("Unsupported ValueRank !");
        }
    }

    // xx const parser: ParserLike = {};
    // xx parser[definition.name] = reader;
    readerMap[definitionName] = reader;
    return reader;
}

describe("Definition and ExtensionObject", () => {

    it("should parse a definition node and convert it to a parser", async () => {

        const s = `
<Definition Name="1:MyOtherStructureDataType">
    <Field DataType="String" ValueRank="1" Name="ListOfNames"/>
    <Field DataType="MyStructureDataType" ValueRank="1" Name="ListOfValues"/>
</Definition>`;

        const MyOtherStructureDataTypeDef = {
            name: "MyOtherStructureDataType",

            fields: [
                { name: "ListOfNames", valueRank: 1, dataType: "String" },
                { name: "ListOfValues", valueRank: 1, dataType: "MyStructureDataType" }

            ]
        };
        const s2 = `
<Definition Name="1:MyStructureDataType">
    <Field DataType="Int32" Name="Id"/>
    <Field DataType="Double" Name="HighValue"/>
    <Field DataType="Double" Name="LowValue"/>
    <Field DataType="LocalizedText" Name="Comments"/>
    <Field DataType="EUInformation" Name="EngineeringUnits"/>
</Definition>`;

        const MyStructureDataTypeDef: Definition = {
            name: "MyStructureDataType",

            fields: [
                { name: "Id", valueRank: -1, dataType: "Int32" },
                { name: "HighValue", valueRank: -1, dataType: "Double" },
                { name: "LowValue", valueRank: -1, dataType: "Double" },
                { name: "Comments", valueRank: -1, dataType: "LocalizedText" },
                { name: "EngineeringUnits", valueRank: -1, dataType: "EUInformation" }
            ]
        };

        const EUInformationDef: Definition = {
            name: "EUInformation",

            fields: [
                { name: "NamespaceUri", dataType: "String" },
                { name: "UnitId", dataType: "UInt32" },
                { name: "DisplayName", dataType: "String" },
                { name: "Description", dataType: "String" }
            ]
        };

        const definitionMap = {
            findDefinition(name: string): Definition {
                switch (name) {
                    case "MyStructureDataType":
                        return MyStructureDataTypeDef;
                    case "MyOtherStructureDataType":
                        return MyOtherStructureDataTypeDef;
                    case "EUInformation":
                        return EUInformationDef;
                    default:
                        throw new Error("not found: " + name);
                }
            }
        };

        const reader = getOrCreateReaderFromDefinition(
          "MyOtherStructureDataType",
          definitionMap, {});

        const parser = new Xml2Json(reader);

        const userDefinedExtensionObject = `
<MyOtherStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
<ListOfNames>
    <String xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"></String>
</ListOfNames>
<ListOfValues>
    <MyStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
        <Id>1</Id>
        <HighValue>10</HighValue>
        <LowValue>-10</LowValue>
        <Comments>Comment1</Comments>
        <EngineeringUnits>
            <NamespaceUri xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"></NamespaceUri>
            <UnitId xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">0</UnitId>
            <DisplayName xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
            <Description xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
        </EngineeringUnits>
    </MyStructureDataType>

    <MyStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
        <Id>2</Id>
        <HighValue>20</HighValue>
        <LowValue>-20</LowValue>
        <Comments>Comment2</Comments>
        <EngineeringUnits>
            <NamespaceUri xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"></NamespaceUri>
            <UnitId xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">0</UnitId>
            <DisplayName xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
            <Description xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
        </EngineeringUnits>
    </MyStructureDataType>
</ListOfValues>
</MyOtherStructureDataType>
        `;

        const a = await parser.parseString(userDefinedExtensionObject);

        console.log("return value =", a);

    });
});
