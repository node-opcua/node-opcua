// tslint:disable:no-console
import * as mocha from "mocha";
import * as should from "should";

import { ReaderStateParserLike, FragmentClonerParser, Xml2Json } from "..";

const doDebug = false;

describe("Cloning XML Fragment", () => {
    it("should clone a fragment", async () => {
        const xmlObjects: any[] = [];
        const reader: ReaderStateParserLike = {
            parser: {
                UAVariable: {
                    parser: {
                        DisplayName: {},
                        References: {},
                        Value: {
                            parser: {
                                ListOfExtensionObject: {
                                    parser: {
                                        ExtensionObject: {
                                            parser: {
                                                TypeId: {},
                                                Body: new FragmentClonerParser()
                                            },
                                            finish() {
                                                if (doDebug) {
                                                    console.log("Body = ", this.parser.Body.value);
                                                }
                                                xmlObjects.push(this.parser.Body.value);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        const xmlDoc = `<doc>
 <UAVariable NodeId="i=12169" BrowseName="EnumValues" ParentNodeId="i=120" DataType="i=7594" ValueRank="1">
    <DisplayName>EnumValues</DisplayName>
    <References>
      <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
      <Reference ReferenceType="HasModellingRule">i=78</Reference>
      <Reference ReferenceType="HasProperty" IsForward="false">i=120</Reference>
    </References>
    <Value>
      <ListOfExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
        <ExtensionObject>
          <TypeId>
            <Identifier>i=7616</Identifier>
          </TypeId>
          <Body>
            <EnumValueType a="b" c="d">
              <Value>1</Value>
              <DisplayName>
                <Locale>
                </Locale>
                <Text>Mandatory</Text>
              </DisplayName>
              <Description>
                <Locale>
                </Locale>
                <Text>The BrowseName must appear in all instances of the type.</Text>
              </Description>
            </EnumValueType>
          </Body>
        </ExtensionObject>
        <ExtensionObject>
          <TypeId>
            <Identifier>i=7616</Identifier>
          </TypeId>
          <Body>
            <EnumValueType>
              <Value>2</Value>
              <DisplayName>
                <Locale>
                </Locale>
                <Text>Optional</Text>
              </DisplayName>
              <Description>
                <Locale>
                </Locale>
                <Text>The BrowseName may appear in an instance of the type.</Text>
              </Description>
            </EnumValueType>
          </Body>
        </ExtensionObject>
        <ExtensionObject>
          <TypeId>
            <Identifier>i=7616</Identifier>
          </TypeId>
          <Body>
            <EnumValueType>
              <Value>3</Value>
              <DisplayName>
                <Locale>
                </Locale>
                <Text>Constraint</Text>
              </DisplayName>
              <Description>
                <Locale>
                </Locale>
                <Text>The modelling rule defines a constraint and the BrowseName is not used in an instance of the type.</Text>
              </Description>
            </EnumValueType>
          </Body>
        </ExtensionObject>
      </ListOfExtensionObject>
    </Value>
  </UAVariable>
 </doc>
  
`;

        const parser = new Xml2Json(reader);
        const a = await parser.parseString(xmlDoc);

        xmlObjects.length.should.eql(3);
        xmlObjects[0].should.eql(`<EnumValueType a="b" c="d">
    <Value>1</Value>
    <DisplayName>
        <Locale/>
        <Text>Mandatory</Text>
    </DisplayName>
    <Description>
        <Locale/>
        <Text>The BrowseName must appear in all instances of the type.</Text>
    </Description>
</EnumValueType>`);
    });
});
