/**
 * @method redirectToFile
 * @param tmpFile {String} log file name to redirect console output.
 * @param actionFct  the inner function to execute
 * @param callback
 */
export declare function redirectToFile(tmpFile: string, actionFct: Function, callback: ((err?: Error) => void) | null): void;
