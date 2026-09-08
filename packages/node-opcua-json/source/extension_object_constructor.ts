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

import type { ExtensionObject } from "node-opcua-extension-object";
import type { IStructuredTypeSchema } from "node-opcua-factory";
import type { ExpandedNodeId } from "node-opcua-nodeid";

/**
 * the constructor of a concrete ExtensionObject, together with the schema that describes it.
 *
 * This is `ConstructorFuncWithSchema` from node-opcua-factory narrowed to construct an
 * ExtensionObject rather than an IBaseUAObject, which is what a JSON decoder needs: it hands back
 * what it built, and the caller is entitled to an ExtensionObject.
 *
 * It is declared here rather than imported because the narrowing needs `ExtensionObject`, and
 * node-opcua-factory cannot name that type without depending on node-opcua-extension-object, which
 * depends on it. node-opcua-address-space declares an identical interface for the same reason; it
 * could import this one instead, now that this package sits below it.
 */
export interface ExtensionObjectConstructorFuncWithSchema {
    new (options?: Record<string, unknown>): ExtensionObject;
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
    encodingDefaultJson?: ExpandedNodeId;
}
