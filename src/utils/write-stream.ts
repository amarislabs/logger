export function writeStream(data: string, stream: NodeJS.WriteStream): boolean {
    return stream.write.call(stream, data);
}
