import type { WriteStream } from "node:tty";
import type { ConsolaOptions, FormatOptions, LogObject, LogType } from "consola";
import { type ColorName, colors, stripAnsi } from "consola/utils";
import wrap from "word-wrap";
import { createBox, formatArgs, formatType } from "#/formatters";
import { createBadgeStyle, createTextStyle, getColor, getColorFunction } from "#/utils/colors";
import { MESSAGE_COLOR_MAP, TEXT_TYPES, TYPE_PREFIX } from "#/utils/type-maps";
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

        // Process text patterns with padding for wrapped lines
        message = this.processTextPatterns(message, opts.columns || 80);
        additional = additional.map((line: string): string => this.processTextPatterns(line, opts.columns || 80));

        const messageColor: (text: string) => string = this.getMessageColor(payload);

        // Apply message color
        message = messageColor(message);
        additional = additional.map((line: string): string => messageColor(line));

        const isLogType: boolean = payload.type === "log";
        const isBadge: boolean = (payload.badge as boolean) ?? payload.level < 2;

        const typeFormat: string = formatType(payload, isBadge, this.createTypeFormatter, this.applyTypePadding);

        const type: string = isLogType ? "" : typeFormat;

        // Determine padding for wrapped lines based on type formatting
        const wrapPadding = isLogType ? 3 : stripAnsi(typeFormat).length + 1;

        // Apply padding for wrapped lines
        return this.assembleLineWithWrappedPadding(additional, [type, message], wrapPadding, opts.columns || 80);
    }

    private getMessageColor(payload: LogObject): (text: string) => string {
        return this.options.dimTypes?.includes(payload.type)
            ? colors.dim
            : this.options.colorizeMessage
              ? getColor(MESSAGE_COLOR_MAP[payload.type])
              : (text: string): string => text;
    }

    private assembleLineWithWrappedPadding(
        additional: string[],
        parts: string[],
        paddingLength: number,
        columns: number
    ): string {
        // Filter out empty strings and join parts
        const line = parts.filter(Boolean).join(" ");

        // Handle wrapping for the main line
        const wrappedMainLine = this.applyWrappingWithPadding(line, paddingLength, columns);

        // Handle additional lines
        if (additional.length === 0) {
            return wrappedMainLine;
        }

        return [
            wrappedMainLine,
            ...additional.map((line) => this.applyWrappingWithPadding(line, paddingLength, columns)),
        ].join("\n");
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

        const activeStyles = styleStack.join("");
        return `${text.substring(0, truncateIndex)}...${activeStyles ? resetCode : ""}`;
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
    private applyWrappingWithPadding(text: string, paddingLength: number, columns: number): string {
        if (stripAnsi(text).length <= columns) {
            return text;
        }

        const plainText: string = stripAnsi(text);
        const hasPrefix: boolean = (() => {
            const match = plainText.match(/^\s{0,3}([A-Z]+)\s/);
            return match ? TEXT_TYPES.includes(match[1].toLowerCase()) : false;
        })();

        if (hasPrefix) {
            // Extract prefix from the original text (including ANSI codes)
            const prefixMatch = text.match(/^(\s*(?:\x1b\[[0-9;]*m)*[A-Z]+(?:\x1b\[[0-9;]*m)*\s+)/);
            if (!prefixMatch) {
                // If we can't identify the prefix pattern, fall back to truncation
                const maxLength = columns - 2;
                const resetCode = "\x1b[0m";
                return this.truncateWithEllipsis(text, maxLength, resetCode);
            }

            const prefix: string = prefixMatch[1];
            const prefixVisibleLength = stripAnsi(prefix).length;
            const content = text.substring(prefix.length);
            const contentPlain = stripAnsi(content);

            // Use consistent padding with 3 spaces (standard padding) + prefix length
            const standardPadding = 3; // Match the padding used for non-prefixed text
            const padding: string = " ".repeat(prefixVisibleLength);

            // Extract the active color at the end of the prefix to maintain color continuity
            let activeColor = "";
            const ansiRegex = /\x1b\[[0-9;]*m/g;
            let match: RegExpExecArray | null;
            let lastColorCode = "";

            // Find the last color code in the prefix
            while ((match = ansiRegex.exec(prefix)) !== null) {
                if (match[0] === "\x1b[0m") {
                    lastColorCode = "";
                } else {
                    lastColorCode = match[0];
                }
            }

            // Use the last color code as the active color if it exists
            if (lastColorCode) {
                activeColor = lastColorCode;
            }

            // Find all active colors in the content for maintaining colors in wrapped lines
            const contentColorCodes: string[] = [];
            ansiRegex.lastIndex = 0;
            while ((match = ansiRegex.exec(content)) !== null) {
                const code = match[0];
                if (code === "\x1b[0m") {
                    contentColorCodes.length = 0; // Reset color stack
                } else if (/\x1b\[([34][0-9]|9[0-7])m/.test(code)) {
                    // Replace any existing foreground color
                    contentColorCodes.push(code);
                }
            }

            // If we found color codes in content, use the last one instead of prefix color
            if (contentColorCodes.length > 0) {
                activeColor = contentColorCodes[contentColorCodes.length - 1];
            }

            // Store all ANSI codes in the content
            const ansiCodes: { index: number; code: string }[] = [];

            // Reset match to scan content ANSI codes
            ansiRegex.lastIndex = 0;

            // Find all ANSI codes in the content
            while ((match = ansiRegex.exec(content)) !== null) {
                ansiCodes.push({
                    index: match.index,
                    code: match[0],
                });
            }

            const wrappedContentPlain = wrap(contentPlain, {
                width: columns - prefixVisibleLength,
                indent: "",
                trim: true,
            });

            const wrappedLines = wrappedContentPlain.split("\n");
            const resultLines: string[] = [];

            if (wrappedLines.length > 0) {
                // Process first line - keep the prefix but remove padding from wrapped content
                resultLines.push(prefix + (activeColor || "") + stripAnsi(wrappedLines[0].substring(padding.length)));
                const messageColorFn = getColorFunction(stripAnsi(prefix));

                // Process subsequent lines with consistent padding and color
                for (let i = 1; i < wrappedLines.length; i++) {
                    const wrappedLine = wrappedLines[i];
                    // Apply color using the color function instead of raw ANSI codes
                    resultLines.push(" ".repeat(standardPadding) + messageColorFn(wrappedLine));
                }
            }

            let plainTextIndex = 0;
            let resultLineIndex = 0;
            let posInResultLine = resultLines[0].indexOf(stripAnsi(wrappedLines[0].substring(padding.length)));

            ansiCodes.sort((a, b) => a.index - b.index);

            let currentStyles = activeColor || "";
            for (const { index, code } of ansiCodes) {
                if (code === "\x1b[0m") {
                    currentStyles = "";
                } else {
                    currentStyles = this.updateActiveStyles(currentStyles, code);
                }

                const visibleCharsToAdvance = this.countVisibleChars(content.substring(0, index));

                for (let i = 0; i < visibleCharsToAdvance; i++) {
                    plainTextIndex++;
                    posInResultLine++;

                    if (
                        posInResultLine >= stripAnsi(resultLines[resultLineIndex]).length &&
                        resultLineIndex < resultLines.length - 1
                    ) {
                        resultLineIndex++;
                        posInResultLine = standardPadding; // Start after padding

                        // Apply current styles to the beginning of the next line
                        if (currentStyles && !resultLines[resultLineIndex].startsWith(currentStyles)) {
                            resultLines[resultLineIndex] =
                                resultLines[resultLineIndex].substring(0, standardPadding) +
                                currentStyles +
                                resultLines[resultLineIndex].substring(standardPadding);
                        }
                    }
                }

                // Insert the ANSI code at the current position
                if (resultLineIndex < resultLines.length) {
                    const line = resultLines[resultLineIndex];
                    resultLines[resultLineIndex] =
                        line.substring(0, posInResultLine) + code + line.substring(posInResultLine);
                }
            }

            // Ensure each line ends with a reset code
            const resetCode = "\x1b[0m";
            for (let i = 0; i < resultLines.length; i++) {
                if (!resultLines[i].endsWith(resetCode)) {
                    resultLines[i] += resetCode;
                }
            }

            return resultLines.join("\n");
        }

        // Existing code for non-prefixed text continues...
        const padding: string = " ".repeat(paddingLength);

        const ansiCodes: { index: number; code: string; isReset: boolean; isStyle: boolean }[] = [];
        const ansiRegex = /\x1b\[[0-9;]*m/g;
        let match: RegExpExecArray | null;

        while ((match = ansiRegex.exec(text)) !== null) {
            const code = match[0];
            const isReset = code === "\x1b[0m";
            const isStyle = /\x1b\[(1|2|3|4|7|8|9|22|23|24|27|28|29)m/.test(code);

            ansiCodes.push({
                index: match.index,
                code,
                isReset,
                isStyle,
            });
        }

        // Rest of the existing implementation for non-prefixed text...
        let prefix = "";
        let contentToWrap: string = plainText;
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

        const lines: string[] = wrappedPlainText.split("\n");

        const charMap = new Map<number, { line: number; pos: number }>();
        let lineIndex = 0;
        let charPosInLine = prefix.length;
        let plainIndex = 0;

        for (const _char of [...contentToWrap]) {
            if (lines[lineIndex] && charPosInLine < lines[lineIndex].length) {
                charMap.set(plainIndex, { line: lineIndex, pos: charPosInLine });
                charPosInLine++;
            } else {
                lineIndex++;
                charPosInLine = padding.length;

                if (lineIndex < lines.length) {
                    charMap.set(plainIndex, { line: lineIndex, pos: charPosInLine });
                    charPosInLine++;
                }
            }

            plainIndex++;
        }

        const resultLines: string[] = [...lines];

        let activeStyles = "";
        let currentForeground = "";
        let currentBackground = "";
        const currentTextStyles = new Set<string>();

        for (const { index, code, isReset } of ansiCodes) {
            if (isReset) {
                currentForeground = "";
                currentBackground = "";
                currentTextStyles.clear();
                activeStyles = "";
            } else {
                if (/\x1b\[([34][0-9]|9[0-7])m/.test(code)) {
                    currentForeground = code;
                } else if (/\x1b\[([45][0-9]|10[0-7])m/.test(code)) {
                    currentBackground = code;
                } else if (/\x1b\[(1|2|3|4|7|8|9)m/.test(code)) {
                    currentTextStyles.add(code);
                } else if (/\x1b\[(22|23|24|27|28|29)m/.test(code)) {
                    for (const style of [...currentTextStyles]) {
                        if (this.isResetForStyle(code, style)) {
                            currentTextStyles.delete(style);
                        }
                    }
                }

                activeStyles = currentForeground + currentBackground + [...currentTextStyles].join("");
            }

            const plainIndex = this.getPlainTextIndex(text, index);
            const mappedPos = charMap.get(plainIndex);

            if (!mappedPos) continue;

            const { line, pos } = mappedPos;

            if (line < resultLines.length) {
                const lineText = resultLines[line];
                resultLines[line] = lineText.slice(0, pos) + code + lineText.slice(pos);

                if (activeStyles && line < resultLines.length - 1) {
                    for (let i = line + 1; i < resultLines.length; i++) {
                        if (!resultLines[i].startsWith(activeStyles)) {
                            resultLines[i] = activeStyles + resultLines[i];
                        }
                    }
                }
            }
        }

        const resetCode = "\x1b[0m";
        for (let i = 0; i < resultLines.length; i++) {
            if (!resultLines[i].endsWith(resetCode)) {
                resultLines[i] += resetCode;
            }
        }

        return resultLines.join("\n");
    }

    private updateActiveStyles(currentStyles: string, newCode: string): string {
        let _currentStyles = currentStyles;

        // Handle foreground color codes
        if (/\x1b\[([34][0-9]|9[0-7])m/.test(newCode)) {
            // Remove any existing foreground color
            _currentStyles = _currentStyles.replace(/\x1b\[([34][0-9]|9[0-7])m/g, "");
            _currentStyles += newCode;
        }
        // Handle background color codes
        else if (/\x1b\[([45][0-9]|10[0-7])m/.test(newCode)) {
            // Remove any existing background color
            _currentStyles = _currentStyles.replace(/\x1b\[([45][0-9]|10[0-7])m/g, "");
            _currentStyles += newCode;
        }
        // Handle text style codes
        else if (/\x1b\[(1|2|3|4|7|8|9)m/.test(newCode)) {
            if (!_currentStyles.includes(newCode)) {
                _currentStyles += newCode;
            }
        }
        // Handle style reset codes
        else if (/\x1b\[(22|23|24|27|28|29)m/.test(newCode)) {
            // Remove corresponding style codes
            if (newCode === "\x1b[22m") {
                _currentStyles = _currentStyles.replace(/\x1b\[(1|2)m/g, "");
            } else if (newCode === "\x1b[23m") {
                _currentStyles = _currentStyles.replace(/\x1b\[3m/g, "");
            } else if (newCode === "\x1b[24m") {
                _currentStyles = _currentStyles.replace(/\x1b\[4m/g, "");
            } else if (newCode === "\x1b[27m") {
                _currentStyles = _currentStyles.replace(/\x1b\[7m/g, "");
            } else if (newCode === "\x1b[28m") {
                _currentStyles = _currentStyles.replace(/\x1b\[8m/g, "");
            } else if (newCode === "\x1b[29m") {
                _currentStyles = _currentStyles.replace(/\x1b\[9m/g, "");
            }
        }

        return _currentStyles;
    }

    private countVisibleChars(text: string): number {
        return stripAnsi(text).length;
    }

    private isResetForStyle(resetCode: string, styleCode: string): boolean {
        const resetMap: { [key: string]: string[] } = {
            "\x1b[22m": ["\x1b[1m", "\x1b[2m"], // Reset for bold and dim
            "\x1b[23m": ["\x1b[3m"], // Reset for italic
            "\x1b[24m": ["\x1b[4m"], // Reset for underline
            "\x1b[27m": ["\x1b[7m"], // Reset for inverse
            "\x1b[28m": ["\x1b[8m"], // Reset for hidden
            "\x1b[29m": ["\x1b[9m"], // Reset for strikethrough
        };

        return resetMap[resetCode]?.includes(styleCode) || false;
    }

    private getPlainTextIndex(ansiText: string, ansiIndex: number): number {
        const textBeforeIndex = ansiText.substring(0, ansiIndex);
        return stripAnsi(textBeforeIndex).length;
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

    private _truncateWithEllipsis(text: string, maxLength: number, resetCode: string): string {
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

        // let activeStyles = "";
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

        // activeStyles = styleStack.join("");
        return `${text.substring(0, truncateIndex)}...${resetCode}`;
    }
}
