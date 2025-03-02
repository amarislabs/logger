import type { WriteStream } from "node:tty";
import type { ConsolaOptions, FormatOptions, LogObject, LogType } from "consola";
import { type ColorFunction, type ColorName, colors, stripAnsi } from "consola/utils";
import wrap from "word-wrap";
import { createBox, formatArgs, formatType } from "#/formatters";
import { createBadgeStyle, createTextStyle, getColor, getColorFunction } from "#/utils/colors";
import { MESSAGE_COLOR_MAP, TEXT_TYPES, TYPE_PREFIX } from "#/utils/type-maps";
import { writeStream } from "#/utils/write-stream";

export interface ContainerReporterOptions {
    dimTypes?: LogType[];
    lineBreakBehavior?: "auto" | "none" | "always";
    lineBreakTimeThreshold?: number;
    sessionDuration?: number;
}

export class ContainerReporter {
    private options: ContainerReporterOptions;
    private lastLogType: LogType | null = null;
    private lastLogTime = 0;
    private firstLog = true;
    private targetStream: WriteStream | null = null;

    public constructor(options: ContainerReporterOptions = {}) {
        this.options = {
            dimTypes: ["trace", "verbose"],
            lineBreakBehavior: "auto",
            lineBreakTimeThreshold: 1000,
            sessionDuration: 5000,
            ...options,
        };

        process.on("beforeExit", (): void => {
            if (this.targetStream) {
                writeStream("\n", this.targetStream);
            }
        });
    }
    public log(payload: LogObject, ctx: { options: ConsolaOptions }): boolean {
        const line: string = this.formatPayload(payload, {
            columns: ctx.options.stdout?.columns || 0,
            ...ctx.options.formatOptions,
        });
        this.targetStream =
            payload.level < 2 ? ctx.options.stderr || process.stderr : ctx.options.stdout || process.stdout;

        const now: number = Date.now();
        const isHorizontalBar: boolean = this.isHorizontalBarMessage(payload);
        const newSession: boolean = now - this.lastLogTime > (this.options.sessionDuration || 5000);

        const output: string = this.formatOutputWithLineBreaks(line, payload, now, newSession, isHorizontalBar);

        this.lastLogType = payload.type;
        this.lastLogTime = now;
        this.firstLog = false;

        return writeStream(`${output}${isHorizontalBar ? "\n" : ""}\n`, this.targetStream);
    }

    private isHorizontalBarMessage(payload: LogObject): boolean {
        return payload.args.length === 1 && typeof payload.args[0] === "string" && payload.args[0].startsWith("[[-]]");
    }

    private formatOutputWithLineBreaks(
        line: string,
        payload: LogObject,
        now: number,
        newSession: boolean,
        isHorizontalBar: boolean
    ): string {
        if (this.firstLog || newSession) {
            return `\n${line}`;
        }

        if (isHorizontalBar) {
            return `\n${line}`;
        }

        // Handle different line break behaviors
        if (this.options.lineBreakBehavior === "none") {
            return line;
        }

        if (this.options.lineBreakBehavior === "always" && this.lastLogType !== null) {
            return `\n${line}`;
        }

        // Handle auto line break behavior
        if (this.lastLogType !== null && this.shouldAddLineBreak(payload, now)) {
            return `\n${line}`;
        }

        return line;
    }

    private shouldAddLineBreak(payload: LogObject, now: number): boolean {
        const differentTypes: boolean = payload.type !== this.lastLogType;
        const significantTimeGap: boolean = now - this.lastLogTime > (this.options.lineBreakTimeThreshold || 1000);
        const currentIsImportant: boolean = this.isImportantLogType(payload.type);
        const previousWasImportant: boolean = this.isImportantLogType(this.lastLogType);

        return significantTimeGap || (differentTypes && (currentIsImportant || previousWasImportant));
    }

    private isImportantLogType(type: LogType | null): boolean {
        return type !== null && ["error", "fatal", "warn", "success", "info"].includes(type);
    }

    private formatPayload(payload: LogObject, opts: FormatOptions): string {
        let [message, ...additional] = formatArgs(payload.args, opts).split("\n");

        if (payload.type === "box") {
            return createBox(message, additional, payload as { title?: string; style?: string });
        }

        if (payload.type === "log") {
            const padding: number = 3;

            if (message.startsWith("[[-]]")) {
                message = " ".repeat(1) + message;
            } else {
                message = " ".repeat(padding) + message;
            }

            additional = additional.map((line: string): string =>
                line.startsWith("[[-]]") ? " ".repeat(1) + line : " ".repeat(padding) + line
            );
        }

        const isLogType: boolean = payload.type === "log";
        const isBadge: boolean = (payload.badge as boolean) ?? payload.level < 2;

        const typeFormat: string = formatType(payload, isBadge, this.createTypeFormatter, this.applyTypePadding);
        const type: string = isLogType ? "" : typeFormat;
        const wrapPadding: number = isLogType ? 3 : stripAnsi(typeFormat).length + 1;

        const wrappedLine: string = this.assembleLineWithWrappedPadding(
            additional,
            [type, message],
            wrapPadding,
            opts.columns || 80
        );

        const processedLine: string = wrappedLine
            .split("\n")
            .map((line: string): string => this.processTextPatterns(line, opts.columns || 80))
            .join("\n");

        const messageColor: ColorFunction = getColor(MESSAGE_COLOR_MAP[payload.type]);
        return messageColor(processedLine);
    }

    private assembleLineWithWrappedPadding(
        additional: string[],
        parts: string[],
        paddingLength: number,
        columns: number
    ): string {
        const line: string = parts.filter(Boolean).join(" ");
        const wrappedMainLine: string = this.applyWrappingWithPadding(line, paddingLength, columns);

        if (additional.length === 0) {
            return wrappedMainLine;
        }

        return [
            wrappedMainLine,
            ...additional.map((line: string): string => this.applyWrappingWithPadding(line, paddingLength, columns)),
        ].join("\n");
    }

    private applyWrappingWithPadding(text: string, paddingLength: number, columns: number): string {
        if (stripAnsi(text).length <= columns) {
            return text;
        }

        const plainText: string = stripAnsi(text);
        const hasPrefix: boolean = TEXT_TYPES.includes(plainText.match(/^\s{0,3}([A-Z]+)\s/)?.[1]?.toLowerCase() ?? "");

        if (hasPrefix) {
            const prefixMatch: RegExpMatchArray | null = text.match(
                /^(\s*(?:\x1b\[[0-9;]*m)*[A-Z]+(?:\x1b\[[0-9;]*m)*\s+)/
            );
            if (!prefixMatch) {
                const maxLength: number = columns - 2;
                return this.truncateWithEllipsis(text, maxLength, "\x1b[0m");
            }

            const prefix: string = prefixMatch[1];
            const prefixVisibleLength = stripAnsi(prefix).length;
            const content: string = text.substring(prefix.length);
            const contentPlain: string = stripAnsi(content);

            const standardPadding = 3;

            const wrappedContentPlain: string = wrap(contentPlain, {
                width: columns - prefixVisibleLength,
                indent: "",
                trim: true,
            });

            const wrappedLines: string[] = wrappedContentPlain.split("\n");
            const resultLines: string[] = [];

            if (wrappedLines.length > 0) {
                const messageColorFn: ColorFunction = getColorFunction(stripAnsi(prefix));

                resultLines.push(prefix + messageColorFn(stripAnsi(wrappedLines[0])));

                for (let i = 1; i < wrappedLines.length; i++) {
                    const wrappedLine: string = wrappedLines[i];
                    resultLines.push(" ".repeat(standardPadding) + messageColorFn(wrappedLine));
                }
            }

            return resultLines.join("\n");
        }

        let prefix = "";
        let contentToWrap: string = plainText;
        const padding: string = " ".repeat(paddingLength);

        const initialPaddingMatch: RegExpMatchArray | null = plainText.match(/^(\s+)/);
        if (initialPaddingMatch) {
            prefix = initialPaddingMatch[1];
            contentToWrap = plainText.slice(prefix.length);
        }

        const wrappedPlainText: string = wrap(contentToWrap, {
            width: columns - prefix.length,
            indent: padding,
            trim: true,
        });

        const messageColorFn: ColorFunction = getColorFunction(text);
        const lines: string[] = wrappedPlainText.split("\n").map((line: string): string => messageColorFn(line));

        return lines.join("\n");
    }

    private truncateWithEllipsis(text: string, maxLength: number, resetCode: string): string {
        let visibleCharCount = 0;
        let truncateIndex = 0;

        for (let i = 0; i < text.length && visibleCharCount < maxLength - 3; i++) {
            if (text[i] === "\x1b") {
                while (i < text.length && text[i] !== "m") i++;
                continue;
            }

            visibleCharCount++;
            truncateIndex = i + 1;
        }

        const ansiRegex = /\x1b\[[0-9;]*m/g;
        let match: RegExpExecArray | null;
        let styleStack: string[] = [];

        while ((match = ansiRegex.exec(text.substring(0, truncateIndex))) !== null) {
            const code = match[0];
            if (code === "\x1b[0m") {
                styleStack = [];
            } else {
                styleStack.push(code);
            }
        }

        const activeStyles: string = styleStack.join("");
        return `${text.substring(0, truncateIndex)}...${activeStyles ? resetCode : ""}`;
    }

    private processTextPatterns(text: string, terminalWidth: number): string {
        let _text: string = text;

        _text = _text.replace(/{{(.*?)}}/g, (_fullMatch: string, content: string): string => {
            return colors.whiteBright(stripAnsi(content));
        });

        _text = this.buildDynamicLengthText(_text, terminalWidth);

        return _text;
    }

    private buildDynamicLengthText(text: string, terminalWidth: number): string {
        let _text: string = text;

        _text = _text.replace(
            /\[\[(.*?)(?:\|(.*?))?\]\]/g,
            (_fullMatch: string, lengthStr: string, charStr: string): string => {
                const horizontalPadding = 2;
                const availableWidth: number = terminalWidth - horizontalPadding;

                if (!charStr && lengthStr.length === 1) {
                    return lengthStr.repeat(availableWidth);
                }

                let length: number = Number.parseInt(lengthStr, 10);
                const char: string = charStr || "—";

                if (lengthStr.endsWith("%")) {
                    const percentage = Number.parseInt(lengthStr.slice(0, -1), 10) / 100;
                    length = Math.floor(availableWidth * percentage);
                } else if (lengthStr === "full") {
                    length = availableWidth;
                }

                length = Math.max(1, Math.min(length, availableWidth));

                return char.repeat(length);
            }
        );

        return _text;
    }

    private createTypeFormatter(payload: LogObject, typeColor: ColorName, useBadge: boolean): string {
        let prefix: string;
        let formatter: string;

        if (payload.tag) {
            prefix = payload.tag.toUpperCase();
            formatter = `${colors.whiteBright(">")} ${createBadgeStyle(prefix, typeColor)}`;
        } else {
            prefix = TYPE_PREFIX[payload.type] || payload.type.toUpperCase();
            formatter = useBadge ? createBadgeStyle(payload, typeColor) : createTextStyle(prefix, typeColor);
        }

        return formatter;
    }

    private applyTypePadding(formatter: string): string {
        const visibleLength: number = stripAnsi(formatter).length;
        const padding: number = Math.max(0, 4 - visibleLength);

        if (formatter.startsWith(colors.whiteBright(">"))) {
            return " ".repeat(1) + formatter;
        }

        return " ".repeat(3) + formatter + " ".repeat(padding);
    }
}
