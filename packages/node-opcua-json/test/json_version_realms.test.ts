/**
 * ==========================================================================
 * Copyright (c) 2021-2026 Sterfive - etienne.rossignon@sterfive.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 * ==========================================================================
 */

import { DataValue } from "node-opcua-data-value";
import * as root from "node-opcua-json";
import * as v104 from "node-opcua-json/104";
import * as v105 from "node-opcua-json/105";
import { Range } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";

describe("node-opcua-json version realms", () => {
    const namespaceArray = ["http://opcfoundation.org/UA/", "urn:custom"];
    const dataValue = new DataValue({ value: { dataType: DataType.Double, value: 3.5 } });
    const builder: root.ExtensionObjectBuilder = {
        constructObject(): never {
            throw new Error("not used");
        }
    } as unknown as root.ExtensionObjectBuilder;

    it("node-opcua-json/104 exposes the 1.04 API under version-free names", () => {
        should(v104.opcuaJsonEncodeDataValue).equal(root.opcuaJsonEncodeDataValue104);
        should(v104.opcuaJsonDecodeDataValue).equal(root.opcuaJsonDecodeDataValue104);
        should(v104.opcuaJsonEncodeVariant).equal(root.opcuaJsonEncodeVariant104);
        should(v104.opcuaJsonDecodeVariant).equal(root.opcuaJsonDecodeVariant104);
        should(v104.opcuaJsonEncodeStatusCode).equal(root.opcuaJsonEncodeStatusCode104);
        should(v104.opcuaJsonEncodeNodeId).equal(root.opcuaJsonEncodeNodeId104);
        should(v104.opcuaJsonEncodeDataValueMQTT).equal(root.opcuaJsonEncodeDataValueMQTT104);
        should(v104.JsonEncoderMode).equal(root.JsonEncoderMode104);

        const pojo: v104.DataValueJSON = v104.opcuaJsonEncodeDataValue(dataValue, v104.JsonEncoderMode.Reversible, namespaceArray);
        should(pojo.Value).eql({ Type: DataType.Double, Body: 3.5 });
        const back = v104.opcuaJsonDecodeDataValue(pojo, builder, namespaceArray);
        should(back.value.value).eql(3.5);
    });

    it("node-opcua-json/105 exposes the 1.05 API under version-free names", () => {
        should(v105.opcuaJsonEncodeDataValue).equal(root.opcuaJsonEncodeDataValue105);
        should(v105.opcuaJsonDecodeDataValue).equal(root.opcuaJsonDecodeDataValue105);
        should(v105.opcuaJsonEncodeVariant).equal(root.opcuaJsonEncodeVariant105);
        should(v105.opcuaJsonDecodeVariant).equal(root.opcuaJsonDecodeVariant105);
        should(v105.opcuaJsonEncodeStatusCode).equal(root.opcuaJsonEncodeStatusCode105);
        should(v105.opcuaJsonEncodeNodeId).equal(root.opcuaJsonEncodeNodeId105);
        should(v105.opcuaJsonEncodeDataValueMQTT).equal(root.opcuaJsonEncodeDataValueMQTT105);
        should(v105.JsonEncoderMode).equal(root.JsonEncoderMode105);

        const pojo: v105.DataValueJSON = v105.opcuaJsonEncodeDataValue(dataValue, v105.JsonEncoderMode.Verbose, namespaceArray);
        should(pojo.UaType).eql(DataType.Double);
        should(pojo.Value).eql(3.5);
        const back = v105.opcuaJsonDecodeDataValue(pojo, builder, namespaceArray);
        should(back.value.value).eql(3.5);
    });

    it("each realm encodes an ExtensionObject in its own shape", () => {
        const range = new Range({ low: 1, high: 2 });

        const pojo104 = v104.opcuaJsonEncodeExtensionObject(range, v104.JsonEncoderMode.Reversible, namespaceArray);
        should(pojo104).have.property("TypeId");
        should(pojo104).have.property("Body");
        should(pojo104).not.have.property("UaTypeId");

        const pojo105 = v105.opcuaJsonEncodeExtensionObject(range, v105.JsonEncoderMode.Verbose, namespaceArray);
        should(pojo105).have.property("UaTypeId");
        should(pojo105).have.property("UaBody");
        should(pojo105).not.have.property("TypeId");

        const back104 = v104.opcuaJsonDecodeExtensionObject(pojo104 as v104.ExtensionObjectJSON, builder, namespaceArray) as Range;
        const back105 = v105.opcuaJsonDecodeExtensionObject(pojo105 as v105.ExtensionObjectJSON, builder, namespaceArray) as Range;
        should(back104.toJSON()).eql(range.toJSON());
        should(back105.toJSON()).eql(range.toJSON());
    });

    it("the root entry point stays version-flexible and also exposes both realms", () => {
        const p104 = root.opcuaJsonEncodeDataValue(dataValue, root.JsonEncodingScheme.DeprecatedReversible, namespaceArray);
        const p105 = root.opcuaJsonEncodeDataValue(dataValue, root.JsonEncodingScheme.Verbose, namespaceArray);
        should(root.opcuaJsonDecodeDataValue(p104, builder, namespaceArray).value.value).eql(3.5);
        should(root.opcuaJsonDecodeDataValue(p105, builder, namespaceArray).value.value).eql(3.5);

        should(root.v104.opcuaJsonEncodeDataValue).equal(v104.opcuaJsonEncodeDataValue);
        should(root.v105.opcuaJsonEncodeDataValue).equal(v105.opcuaJsonEncodeDataValue);
    });
});
