// <Definition Name="SomeName">
//   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
//      [<Description>text</Description>]
//   <Field>
// </Definition>
import {
    ReaderStateParserLike,
    XmlAttributes
} from "./xml2json";

// <Definition Name="SomeName">
//   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
//      [<Description>text</Description>]
//   <Field>
// </Definition>
//
// Or
//
//  (IsOptionSet)
//
//
export const _definitionParser: ReaderStateParserLike = {
    init(this: any, name: string, attrs: XmlAttributes) {
        this.parent.definition = [];
        this.parent.definition_name = attrs.Name;
        this.array = this.parent.definition;
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
                const obj: any = {
                    name: this.attrs.Name,
                };
                if (this.attrs.DataType !== undefined) {
                    obj.dataType = this.attrs.DataType;
                }
                if (this.description) {
                    obj.description = this.description;
                }
                if (this.attrs.Value !== undefined) {
                    obj.value = parseInt(this.attrs.Value, 10);
                }
                if (this.attrs.ValueRank !== undefined) {
                    obj.valueRank = parseInt(this.attrs.ValueRank || "-1", 10);
                }
                if (this.attrs.ArrayDimensions !== undefined) {
                    obj.arrayDimensions = this.attrs.ArrayDimensions;
                }
                if (this.attrs.IsOptional !== undefined) {
                    obj.isOptional = this.attrs.IsOptional ? true : false;
                }
                if (this.attrs.SymbolicName !== undefined) {
                    obj.symbolicName = this.attrs.SymbolicName;
                }
                this.parent.array.push(obj);
            }
        }
    }
};
export const definitionReaderStateParser: ReaderStateParserLike = {
    parser: {
        Definition: _definitionParser
    },
    endElement(this: any) {
        this._pojo = {
            name: this.definition_name,
            fields: this.definition
        };
    }
};
