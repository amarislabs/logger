import type { WriteStream } from "node:tty";
import type { ConsolaOptions, FormatOptions, LogObject, LogType } from "consola";
import { type ColorName, colors, stripAnsi } from "consola/utils";
import { createBox, formatArgs, formatTimestamp, formatType } from "#/formatters";
import { assembleLine } from "#/formatters/assembly";
import { createBadgeStyle, createTextStyle } from "#/utils/colors";
import { TYPE_PREFIX } from "#/utils/type-maps";
import { writeStream } from "#/utils/write-stream";

export interface DefaultReporterOptions {
    padding?: number;
    dateFirstPosition?: boolean;
    dimTypes?: LogType[];
    addTypeColon?: boolean;
}

export class DefaultReporter {
    private options: DefaultReporterOptions;

    public constructor(options: DefaultReporterOptions = {}) {
        this.options = {
            padding: 6,
            dimTypes: ["trace", "verbose"],
            dateFirstPosition: true,
            addTypeColon: false,
            ...options,
        };
    }
    public log(payload: LogObject, ctx: { options: ConsolaOptions }): boolean {
        const line: string = this.formatPayload(payload, {
            columns: ctx.options.stdout?.columns || 0,
            ...ctx.options.formatOptions,
        });

        const targetStream: WriteStream =
            payload.level < 2 ? ctx.options.stderr || process.stderr : ctx.options.stdout || process.stdout;

        return writeStream(`${line}\n`, targetStream);
    }

    private formatPayload(payload: LogObject, opts: FormatOptions): string {
        let [message, ...additional] = formatArgs(payload.args, opts).split("\n");

        if (payload.type === "box") {
            return createBox(message, additional, payload as { title?: string; style?: string });
        }

        if (this.options.dimTypes?.includes(payload.type)) {
            message = colors.dim(message);
            additional = additional.map((line: string): string => colors.dim(line));
        }

        const typeFormat: string = formatType(
            payload,
            (payload.badge as boolean) ?? payload.level < 2,
            (payload: LogObject, typeColor: ColorName, useBadge: boolean): string =>
                this.createTypeFormatter(payload, opts, typeColor, useBadge),
            this.applyTypePadding.bind(this)
        );

        const type: string = payload.type === "log" ? "" : typeFormat;
        const date: string = opts.date ? formatTimestamp(payload.date) : "";
        const lineElements: string[] = [];

        if (date) {
            if (this.options.dateFirstPosition) {
                lineElements.push(date);
                if (type) lineElements.push(type);
            } else {
                if (type) lineElements.push(type);
                lineElements.push(date);
            }
        } else if (type) {
            lineElements.push(type);
        }

        lineElements.push(message);

        return assembleLine(additional, lineElements);
    }

    private createTypeFormatter(
        payload: LogObject,
        opts: FormatOptions,
        typeColor: ColorName,
        useBadge: boolean
    ): string {
        let prefix: string;
        let formatter: string;

        if (payload.tag) {
            prefix = payload.tag.toUpperCase();
            formatter = createTextStyle(prefix, typeColor);
        } else {
            prefix = TYPE_PREFIX[payload.type] || payload.type.toUpperCase();

            // Case 1: formatOptions date true but dateFirstPosition true -> add colon
            // Case 2: formatOptions date false but dateFirstPosition true -> add colon
            // Case 3: formatOptions date false but dateFirstPosition false -> add colon
            // Case 4: formatOptions date true but dateFirstPosition false -> don't add colon
            if (!useBadge && this.options.addTypeColon && !(opts.date && !this.options.dateFirstPosition)) {
                prefix = `${prefix}:`;
            }
            formatter = useBadge ? createBadgeStyle(payload, typeColor) : createTextStyle(prefix, typeColor);
        }

        return formatter;
    }

    private applyTypePadding(formatter: string): string {
        const visibleLength: number = stripAnsi(formatter).length;
        const padding: number = Math.max(0, this.options.padding! - visibleLength);

        return formatter + " ".repeat(padding);
    }
}
