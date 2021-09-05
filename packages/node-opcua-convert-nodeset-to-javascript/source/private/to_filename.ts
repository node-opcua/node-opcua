import { snakeCase } from "case-anything";

export function toFilename(str: string): string {
    str = str.replace(/^DT/,"dt_").replace(/^UA/,"ua_").replace(/^Enum/,"enum_");
    return snakeCase(str);
}
