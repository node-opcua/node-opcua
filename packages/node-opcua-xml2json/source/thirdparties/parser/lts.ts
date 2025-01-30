'use strict';

import { EventEmitter } from "events";
import { unescapeXML } from "../escape";

const STATE_TEXT = 0;
const STATE_IGNORE_COMMENT = 1;
const STATE_IGNORE_INSTRUCTION = 2;
const STATE_TAG_NAME = 3;
const STATE_TAG = 4;
const STATE_ATTR_NAME = 5;
const STATE_ATTR_EQ = 6;
const STATE_ATTR_QUOT = 7;
const STATE_ATTR_VALUE = 8;
const STATE_CDATA = 9;
const STATE_IGNORE_CDATA = 10;

export class SaxLtx extends EventEmitter {


    #write: (data: string) => void;
    constructor() {
        super();

        function _handleTagOpening(
            this: SaxLtx,
            endTag: boolean| undefined,
            tagName: string|undefined,
            attrs: string
        ) {
            if (!endTag) {
                this.emit("startElement", tagName, attrs);
                if (selfClosing) {
                    this.emit("endElement", tagName, true);
                }
            } else {
                this.emit("endElement", tagName, false);
            }
        };
        let state = STATE_TEXT;
        let remainder: string | null = null;
        let parseRemainder: boolean = false;
        let tagName: string | undefined;
        let attrs: string | {} | undefined;
        let endTag: boolean|undefined;
        let selfClosing: boolean | undefined;
        let attrQuote: number;
        let attrQuoteChar: string;
        let recordStart: number | undefined = 0;
        let attrName: string|undefined;

        this.#write = function write(data: string ) {
            let pos = 0;

            /* Anything from previous write()? */
            if (remainder) {
                data = remainder + data;
                pos += !parseRemainder ? remainder.length : 0;
                parseRemainder = false;
                remainder = null;
            }

            function endRecording(): undefined | string {
                if (typeof recordStart === "number") {
                    const recorded = data.slice(recordStart, pos);
                    recordStart = undefined;
                    return recorded;
                }
                return  undefined;
            }

            for (; pos < data.length; pos++) {
                switch (state) {
                    case STATE_TEXT: {
                        // if we're looping through text, fast-forward using indexOf to
                        // the next '<' character
                        const lt = data.indexOf("<", pos);
                        if (lt !== -1 && pos !== lt) {
                            pos = lt;
                        }

                        break;
                    }
                    case STATE_ATTR_VALUE: {
                        // if we're looping through an attribute, fast-forward using
                        // indexOf to the next end quote character
                        const quot = data.indexOf(attrQuoteChar, pos);
                        if (quot !== -1) {
                            pos = quot;
                        }

                        break;
                    }
                    case STATE_IGNORE_COMMENT: {
                        // if we're looping through a comment, fast-forward using
                        // indexOf to the first end-comment character
                        const endcomment = data.indexOf("-->", pos);
                        if (endcomment !== -1) {
                            pos = endcomment + 2; // target the '>' character
                        }

                        break;
                    }
                    case STATE_IGNORE_CDATA: {
                        // if we're looping through a CDATA, fast-forward using
                        // indexOf to the first end-CDATA character ]]>
                        const endCDATA = data.indexOf("]]>", pos);
                        if (endCDATA !== -1) {
                            pos = endCDATA + 2; // target the '>' character
                        }

                        break;
                    }
                    // No default
                }

                const c = data.charCodeAt(pos);
                switch (state) {
                    case STATE_TEXT:
                        if (c === 60 /* < */) {
                            const text = endRecording();
                            if (text) {
                                this.emit("text", unescapeXML(text));
                            }
                            state = STATE_TAG_NAME;
                            recordStart = pos + 1;
                            attrs = {};
                        }
                        break;
                    case STATE_CDATA:
                        if (c === 93 /* ] */) {
                            if (data.substring(pos + 1, 2) === "]>") {
                                const cData = endRecording();
                                if (cData) {
                                    this.emit("text", cData);
                                }
                                state = STATE_TEXT;
                            } else if (data.length < pos + 2) {
                                parseRemainder = true;
                                pos = data.length;
                            }
                        }
                        break;
                    case STATE_TAG_NAME:
                        if (c === 47 /* / */ && recordStart === pos) {
                            recordStart = pos + 1;
                            endTag = true;
                        } else if (c === 33 /* ! */) {
                            if (data.substring(pos + 1, 7) === "[CDATA[") {
                                recordStart = pos + 8;
                                state = STATE_CDATA;
                            } else if (
                                data.length < pos + 8 &&
                                "[CDATA[".startsWith(data.slice(pos + 1))
                            ) {
                                // We potentially have CDATA, but the chunk is ending; stop here and let the next write() decide
                                parseRemainder = true;
                                pos = data.length;
                            } else {
                                recordStart = undefined;
                                state = STATE_IGNORE_COMMENT;
                            }
                        } else if (c === 63 /* ? */) {
                            recordStart = undefined;
                            state = STATE_IGNORE_INSTRUCTION;
                        } else if (c <= 32 || c === 47 /* / */ || c === 62 /* > */) {
                            tagName = endRecording();
                            pos--;
                            state = STATE_TAG;
                        }
                        break;
                    case STATE_IGNORE_COMMENT:
                        if (c === 62 /* > */) {
                            const prevFirst = data.charCodeAt(pos - 1);
                            const prevSecond = data.charCodeAt(pos - 2);
                            if (
                                (prevFirst === 45 /* - */ && prevSecond === 45) /* - */ ||
                                (prevFirst === 93 /* ] */ && prevSecond === 93) /* ] */
                            ) {
                                state = STATE_TEXT;
                            }
                        }
                        break;
                    case STATE_IGNORE_INSTRUCTION:
                        if (c === 62 /* > */) {
                            const prev = data.charCodeAt(pos - 1);
                            if (prev === 63 /* ? */) {
                                state = STATE_TEXT;
                            }
                        }
                        break;
                    case STATE_TAG:
                        if (c === 62 /* > */) {
                            _handleTagOpening.call(this, endTag, tagName, attrs as any);
                            tagName = undefined;
                            attrs = undefined;
                            endTag = undefined;
                            selfClosing = undefined;
                            state = STATE_TEXT;
                            recordStart = pos + 1;
                        } else if (c === 47 /* / */) {
                            selfClosing = true;
                        } else if (c > 32) {
                            recordStart = pos;
                            state = STATE_ATTR_NAME;
                        }
                        break;
                    case STATE_ATTR_NAME:
                        if (c <= 32 || c === 61 /* = */) {
                            attrName = endRecording();
                            pos--;
                            state = STATE_ATTR_EQ;
                        }
                        break;
                    case STATE_ATTR_EQ:
                        if (c === 61 /* = */) {
                            state = STATE_ATTR_QUOT;
                        }
                        break;
                    case STATE_ATTR_QUOT:
                        if (c === 34 /* " */ || c === 39 /* ' */) {
                            attrQuote = c;
                            attrQuoteChar = c === 34 ? '"' : "'";
                            state = STATE_ATTR_VALUE;
                            recordStart = pos + 1;
                        }
                        break;
                    case STATE_ATTR_VALUE:
                        if (c === attrQuote) {
                            const value = unescapeXML(endRecording()!);
                            (attrs as any)[attrName!] = value;
                            attrName = undefined;
                            state = STATE_TAG;
                        }
                        break;
                }
            }

            if (typeof recordStart === "number" && recordStart <= data.length) {
                remainder = data.slice(recordStart);
                recordStart = 0;
            }
        };
    }


    public write(data: string | Buffer) {
        this.#write(data.toString());
    }
    public end(data?: string | undefined) {
        if (data) {
            this.write(data);
        }

        /* Uh, yeah */
        this.write = function write() { };
    }
}

