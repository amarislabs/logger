import { sep } from "node:path";
import { formatWithOptions } from "node:util";
import type { FormatOptions, LogObject } from "consola";
import { type BoxOpts, type ColorName, box, colors } from "consola/utils";
import { shouldUseBadge } from "#/utils/colors";
import { TYPE_COLOR_MAP } from "#/utils/type-maps";

export const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});

export function formatTimestamp(date: Date): string {
    const _date: string = dateTimeFormatter.format(date).replace(/\./g, "/").replace(",", "");

    return colors.gray(`[${_date}]`);
}

export function characterFormat(content: string): string {
    const BACKTICK_PATTERN = /`([^`]+)`/g;
    const UNDERSCORE_PATTERN = /\s+_([^_]+)_\s+/g;

    return content
        .replace(BACKTICK_PATTERN, (_: string, m: string | number): string => colors.cyan(m))
        .replace(UNDERSCORE_PATTERN, (_: string, m: string | number): string => ` ${colors.underline(m)} `);
}

export function parseStack(stack: string): string[] {
    const cwd: string = process.cwd() + sep;

    const lines: string[] = stack
        .split("\n")
        .splice(1)
        .map((line: string): string => line.trim().replace("file://", "").replace(cwd, ""));

    return lines.filter((line: string): boolean => line.length > 0);
}

export function formatStack(stack: string, options: FormatOptions): string {
    const indent: string = "  ".repeat((options?.errorLevel || 0) + 1);
    const _stack: string[] = parseStack(stack).map(formatStackLine);

    return `\n${indent}${_stack.join(`\n${indent}`)}`;
}

export function formatError(error: unknown, options: FormatOptions): string {
    if (!(error instanceof Error)) {
        return formatWithOptions(options, error);
    }

    const message: string = error.message ?? formatWithOptions(options, error);
    const stack: string = error.stack ? formatStack(error.stack, options) : "";

    const level: number = options.errorLevel || 0;

    const causePrefix: string = level > 0 ? `${"  ".repeat(level)}[cause]: ` : "";
    const causeError: string = error.cause
        ? `\n\n${formatError(error.cause, { ...options, errorLevel: level + 1 })}`
        : "";

    return `${causePrefix + message}\n${stack}${causeError}`;
}

export function formatArgs(args: unknown[], opts: FormatOptions): string {
    const _args: unknown[] = args.map((arg: unknown): unknown => {
        if (arg instanceof Error && typeof arg.stack === "string") {
            return formatError(arg, opts);
        }
        return arg;
    });

    return formatWithOptions(opts, ..._args);
}

export function formatStackLine(line: string): string {
    const AT_TRACE_PATTERN = /^at +/;
    const PARENTHESES_CONTENT_PATTERN = /\((.+)\)/;

    return `  ${line.replace(AT_TRACE_PATTERN, (m: string): string => colors.gray(m)).replace(PARENTHESES_CONTENT_PATTERN, (_: string, m: string | number): string => `(${colors.cyan(m)})`)}`;
}

export function createBox(message: string, additional: string[], payload: { title?: string; style?: string }): string {
    return box(characterFormat(message + (additional.length > 0 ? `\n${additional.join("\n")}` : "")), {
        title: payload.title ? characterFormat(payload.title as string) : undefined,
        style: payload.style as BoxOpts["style"],
    });
}

export function formatType(
    payload: LogObject,
    isBadge: boolean,
    createTypeFormatter: (payload: LogObject, typeColor: ColorName, useBadge: boolean) => string,
    applyTypePadding: (formatter: string) => string
): string {
    const typeColor: ColorName = TYPE_COLOR_MAP[payload.type] as ColorName;
    const useBadge: boolean = shouldUseBadge(payload, isBadge);

    const formatter: string = createTypeFormatter(payload, typeColor, useBadge);
    return applyTypePadding(formatter);
}
