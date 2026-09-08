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

import { minDate } from "node-opcua-date-time";
import type { JsonEncodingScheme } from "./json_encoding_scheme.js";

const maxDate = new Date("9999-12-31T23:59:59.000Z");
const reallyMinDate = new Date("0001-01-01T00:00:00.000Z");
export function opcuaJsonEncodeDateTime(date: Date, _scheme: JsonEncodingScheme, _namespaceArray?: string[]): Date {
    if (date.getTime() <= minDate.getTime()) {
        return reallyMinDate;
    }
    if (date.getTime() >= maxDate.getTime()) {
        return maxDate;
    }

    return date;
}
export function opcuaJsonDecodeDateTime(pojo: Date | string): Date {
    return typeof pojo === "string" ? new Date(pojo) : (pojo as Date);
}
