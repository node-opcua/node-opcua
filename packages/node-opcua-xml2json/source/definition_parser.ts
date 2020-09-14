// <Definition Name="SomeName">
//   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
//      [<Description>text</Description>]
//   <Field>
// </Definition>
import assert from "node-opcua-assert";
import { ReaderStateParserLike, XmlAttributes } from "./xml2json";

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
        assert(!this.parent.definitionFields || this.parent.definitionFields.length === 0);
        this.parent.definitionFields = [];
        this.parent.definitionName = attrs.SymbolicName || attrs.Name;
        this.array = this.parent.definitionFields;
        this.isUnion = attrs.IsUnion === "true" ? true : false;
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
                    },
                },
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
                    obj.valueRank = parseInt(this.attrs.ValueRank, 10);
                } else {
                    // when not specified valueRank means Scalar and Scalar is -1
                    obj.valueRank = -1;
                }
                if (this.attrs.ArrayDimensions !== undefined) {
                    obj.arrayDimensions = this.attrs.ArrayDimensions.split(",").map((e: string) => parseInt(e, 10));
                }

                obj.isOptional = this.attrs.IsOptional === "true" ? true : false;

                if (this.attrs.SymbolicName !== undefined) {
                    obj.symbolicName = this.attrs.SymbolicName;
                }
                this.parent.array.push(obj);
            },
        },
    },
};
export const definitionReaderStateParser: ReaderStateParserLike = {
    parser: {
        Definition: _definitionParser,
    },
    endElement(this: any) {
        this._pojo = {
            name: this.definitionName,

            fields: this.definitionFields,
        };
    },
};
