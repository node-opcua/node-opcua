import { LineFile1 } from "./line_file";

export interface WriteFunc {
    (...args: string[]): void;
    indent(): void;
    pop(): void;
}

export const makeWrite = (f: LineFile1) => {
    const _f: any = (...args: string[]) => f.write.apply(f, args);
    _f.indent = () => {
        /** */
    };
    _f.pop = () => {
        /** */
    };
    return _f;
};
