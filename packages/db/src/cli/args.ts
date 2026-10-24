import { parseArgs } from "node:util";
import { z } from "zod";

/** Parses `--name value` options and validates them; prints usage and exits on error. */
export function parseOptions<T extends z.ZodRawShape>(
  usage: string,
  shape: T,
  argv = process.argv.slice(2),
): z.infer<z.ZodObject<T>> {
  const options = Object.fromEntries(
    Object.keys(shape).map((key) => [key, { type: "string" as const }]),
  );
  try {
    const { values } = parseArgs({ args: argv, options, strict: true, allowPositionals: false });
    return z.object(shape).parse(values);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => `--${issue.path.join(".")}: ${issue.message}`).join("\n")
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`${message}\n\nUsage: ${usage}`);
    process.exit(2);
  }
}

/** Runs an async CLI entry point and exits non-zero with a readable message on failure. */
export function run(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exit(1);
  });
}
