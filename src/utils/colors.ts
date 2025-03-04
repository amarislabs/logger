import type { LogObject, LogType } from "consola";
import { type ColorFunction, type ColorName, colors, stripAnsi } from "consola/utils";
import { MESSAGE_COLOR_MAP, TEXT_TYPES } from "#/utils/type-maps";

export function getColor(color: ColorName = "white"): ColorFunction {
    return colors[color] || colors.white;
}

export function getBgColor(color: ColorName = "white"): ColorFunction {
    const firstLetter: string = color[0].toUpperCase();
    const rest: string = color.slice(1);

    const colorName: ColorName = `bg${firstLetter}${rest}` as ColorName;
    return colors[colorName] || colors.bgWhite;
}

export function createTextStyle(typePrefix: string, typeColor: ColorName): string {
    return colors.bold(getColor(typeColor)(typePrefix));
}

export function createBadgeStyle(payloadPrefix: LogObject | string, typeColor: ColorName): string {
    const prefix: string = typeof payloadPrefix === "string" ? payloadPrefix : payloadPrefix.type;
    const paddedPrefix: string = ` ${prefix} `;

    return colors.bold(getBgColor(typeColor)(colors.black(paddedPrefix)));
}

export function shouldUseBadge(payload: LogObject, isBadge: boolean): boolean {
    return ["fatal", "fail"].includes(payload.type) || (!TEXT_TYPES.includes(payload.type) && isBadge);
}

export function getColorFunction(logType: string): ColorFunction {
    const cleanedType: LogType = stripAnsi(logType.trim().toLocaleLowerCase()) as LogType;
    const type = MESSAGE_COLOR_MAP[cleanedType];

    return getColor(type ? type : "gray");
}
