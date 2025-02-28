import type { WriteStream } from "node:tty";
import type { ConsolaOptions, FormatOptions, LogObject, LogType } from "consola";
import { type ColorName, colors, stripAnsi } from "consola/utils";
import { createBox, formatArgs, formatType } from "#/formatters";
import { assembleLine } from "#/formatters/assembly";
import { createBadgeStyle, createTextStyle, getColor } from "#/utils/colors";
import { MESSAGE_COLOR_MAP, TYPE_PREFIX } from "#/utils/type-maps";
import { writeStream } from "#/utils/write-stream";

export interface ContainerReporterOptions {
    colorizeMessage?: boolean;
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
            colorizeMessage: true,
            dimTypes: ["trace", "verbose"],
            lineBreakBehavior: "auto",
            lineBreakTimeThreshold: 1000,
            sessionDuration: 5000,
            ...options,
        };

        process.on("beforeExit", () => {
            if (this.targetStream) {
                writeStream("\n", this.targetStream);
            }
        });
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: WIP
    public log(payload: LogObject, ctx: { options: ConsolaOptions }): boolean {
        const line: string = this.formatPayload(payload, {
            columns: ctx.options.stdout?.columns || 0,
            ...ctx.options.formatOptions,
        });
        this.targetStream =
            payload.level < 2 ? ctx.options.stderr || process.stderr : ctx.options.stdout || process.stdout;

        const now = Date.now();
        const newSession = now - this.lastLogTime > (this.options.sessionDuration || 5000);

        let output = this.firstLog || newSession ? `\n${line}` : line;

        this.firstLog = false;

        if (this.options.lineBreakBehavior === "none") {
            this.lastLogType = payload.type;
            this.lastLogTime = now;
            return writeStream(`${output}\n`, this.targetStream);
        }

        if (this.options.lineBreakBehavior === "always" && this.lastLogType !== null) {
            output = `\n${line}`;
            this.lastLogType = payload.type;
            this.lastLogTime = now;
            return writeStream(`${output}\n`, this.targetStream);
        }

        if (this.lastLogType !== null) {
            const differentTypes = payload.type !== this.lastLogType;
            const significantTimeGap = now - this.lastLogTime > (this.options.lineBreakTimeThreshold || 1000);
            const currentIsImportant = ["error", "fatal", "warn", "success", "info"].includes(payload.type);
            const previousWasImportant = ["error", "fatal", "warn", "success", "info"].includes(this.lastLogType);

            if (significantTimeGap || (differentTypes && (currentIsImportant || previousWasImportant))) {
                output = `\n${line}`;
            }
        }

        this.lastLogType = payload.type;
        this.lastLogTime = now;

        return writeStream(`${output}\n`, this.targetStream);
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
        }

        message = this.processTextPatterns(message, opts.columns || 80);
        additional = additional.map((line: string): string => this.processTextPatterns(line, opts.columns || 80));

        if (this.options.dimTypes?.includes(payload.type)) {
            message = colors.dim(message);
            additional = additional.map((line: string): string => colors.dim(line));
        } else if (this.options.colorizeMessage) {
            message = getColor(MESSAGE_COLOR_MAP[payload.type])(message);
            if (additional.length > 0) {
                additional[0] = getColor(MESSAGE_COLOR_MAP[payload.type])(additional[0]);
            }
        }

        const isLogType: boolean = payload.type === "log";
        const isBadge: boolean = (payload.badge as boolean) ?? payload.level < 2;

        const typeFormat: string = formatType(payload, isBadge, this.createTypeFormatter, this.applyTypePadding);

        const type: string = isLogType ? "" : typeFormat;

        return assembleLine(additional, [type, message]);
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
