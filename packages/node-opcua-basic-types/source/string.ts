/***
 * @module node-opcua-basic-types
 */

import { BinaryStream } from "node-opcua-binary-stream" ;

import { getRandomInt } from "./utils";

export function isValidString(value: any): boolean {
    return typeof value === "string";
}

export function randomString(): string {
    const nbCar = getRandomInt(1, 20);
    const cars = [];
    for (let i = 0; i < nbCar; i++) {
        cars.push(String.fromCharCode(65 + getRandomInt(0, 26)));
    }
    return cars.join("");
}

export function decodeString(stream: BinaryStream): string | null {
    return stream.readString();
}

export function encodeString(value: null|string, stream: BinaryStream): void {
    stream.writeString(value);
}

export type CharArray = string;
export type UAString = string | null;
export const decodeUAString = decodeString;
export const encodeUAString = encodeString;
