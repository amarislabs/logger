export function assembleLine(additional: string[], lines: string[]): string {
    const parts: string[] = [];

    for (const line of lines) {
        parts.push(line);
    }

    if (additional.length > 0) {
        parts.push(`\n${additional.join("\n")}`);
    }

    return parts.filter(Boolean).join(" ");
}
