/**
 * @module node-opcua-utils
 */
// tslint:disable:variable-name
export function capitalizeFirstLetter(str: string): string {
    if (str == null) {
        return str;
    }
    return str.substring(0, 1).toUpperCase() + str.substring(1);
}

const ACode = "A".charCodeAt(0);
const ZCode = "Z".charCodeAt(0);
export function isUpperCaseChar(c: string): boolean {
    const code = c.charCodeAt(0);
    return code >= ACode && code <= ZCode;
}
const aCode = "a".charCodeAt(0);
const zCode = "z".charCodeAt(0);
export function isAlpha(c: string): boolean {
    const code = c.charCodeAt(0);
    return (code >= ACode && code <= ZCode) || (code >= aCode && code <= zCode);
}

export function countUpperCaseSlow(str: string): number {
    return str.split("").reduce((p, c) => p + (isUpperCaseChar(c) ? 1 : 0), 0);
}
export function countAlphaSlow(str: string): number {
    return str.split("").reduce((p, c) => p + (isAlpha(c) ? 1 : 0), 0);
}

export function countUpperCase(str: string): number {
    let count = 0;
    const n = str.length;
    for (let i = 0; i < n; i++) {
        count += isUpperCaseChar(str[i]) ? 1 : 0;
    }
    return count;
}
export function countAlpha(str: string): number {
    let count = 0;
    const n = str.length;
    for (let i = 0; i < n; i++) {
        count += isAlpha(str[i]) ? 1 : 0;
    }
    return count;
}

/**
 *
 * lowerFirstLetter convert a OPCUA Identifier to a javascript Identifier
 *
 * @summary
 *
 *  OPCUA and Javascript use two different rules to build identifiers.
 *
 *  OPCUA Identifier usually starts with a upper case letter and word are join together, this is known as
 *  the Pascal case, or CapitalizedWords convention.  (for instance HelloWorld)
 *  But sometime, OPCUA identifiers do not follow this convention strictly and we can find various
 *  other convention being applied such as underscore between word, or addition of ACRONYMIC prefixes.
 *  On it's own, this causes great confusion and inconsistency in programming style.
 *
 *  Javascript uses a slightly different convention called camelCase where word are joined together
 *  and inner words starts with a capital letter whereas first word starts with a lower case letter.
 *  (for instance helloWorld)
 *
 *  In node-opcua we have taken the opinionated decision to consistently use camelCase convention for
 *  object properties so that all the code look nice and consistent.
 *  the lowerFirstLetter method can be used to easily convert from the OPCUA  naming convention
 *  to javascript naming convention by applying the following rules.
 *
 *   * each ascii sequence in a identifier will be converted to lower camel case.
 *   * when an identifier only contains upper case letter then it will be untouched. ( i.e CQDF => CQFD)
 *     (this rules helps to preserve acronyms)
 *   * when a identifier starts with more than one UpperCase letter but still contain lowercase letter
 *     then the first Uppercase letter excluding the last one will be converted to lower case
 *     ( ie:  EURange = > euRange)
 *   * when a identifier contains several sequences delimited with underscores (_) the above rules
 *     will be applied to each of the element of the sequence
 *     ( ie: ALM_FlowOutOfTolerance => ALM_flowOutOfTolerance ( ALM=>ALM , FlowOutOfTolerance=>flowOutOfTolerance)
 *
 * @reference
 *    * https://en.wikipedia.org/wiki/Camel_case
 *    * https://en.wikipedia.org/wiki/Hungarian_notation
 *    * http://wiki.c2.com/?UnderscoreVersusCapitalAndLowerCaseVariableNaming
 *
 *
 *
 * @example
 *  HelloWorld => helloWorld
 *  XAxis      => xAxis
 *  EURange    => euRange
 *  DATE       => DATE
 *  XYZ        => XYZ
 *  AB         => AB
 *  Ab         => ab
 *  A          => a
 *  T1ABC8     => T1ABC8
 *  F_ABC_D    => F_ABC_D
 *  ALM_Timeout    => ALM_timeout
 *  SV_GasOn       => SV_gasOn
 *  DI_VAL_FlowImp => DI_VAL_flowImp
 */
export function lowerFirstLetter(str: string): string {
    if (str == null) {
        return str;
    }
    // at least, 2 all upper
    if (str.length >= 2 && countUpperCase(str) === countAlpha(str)) {
        return str;
    }

    if (str.match(/_/)) {
        return str.split("_").map(lowerFirstLetter).join("_");
    }
    let result = str.substring(0, 1).toLowerCase() + str.substring(1);
    if (result.length > 3 && isUpperCaseChar(str[1]) && isUpperCaseChar(str[2])) {
        result = str.substring(0, 2).toLowerCase() + str.substring(2);
    }
    return result;
}
