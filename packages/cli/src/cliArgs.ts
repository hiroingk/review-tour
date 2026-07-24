export type ParsedArgs = {
  command?: string;
  positionals: string[];
  options: Map<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    if (equalsIndex > -1) {
      options.set(arg.slice(2, equalsIndex), arg.slice(equalsIndex + 1));
      continue;
    }

    const name = arg.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      options.set(name, next);
      index += 1;
    } else {
      options.set(name, true);
    }
  }

  return { command, positionals, options };
}

export function getStringOption(args: ParsedArgs, name: string): string | undefined {
  const value = args.options.get(name);
  return typeof value === 'string' ? value : undefined;
}

export function getNumberOption(args: ParsedArgs, name: string): number | undefined {
  const value = getStringOption(args, name);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number`);
  }
  return parsed;
}

export function hasFlag(args: ParsedArgs, name: string) {
  return args.options.get(name) === true;
}

export function assertAllowedOptions(
  args: ParsedArgs,
  command: string,
  allowedOptions: readonly string[],
) {
  const allowed = new Set(allowedOptions);
  for (const name of args.options.keys()) {
    if (!allowed.has(name)) {
      throw new Error(`Unknown option for review-tour ${command}: --${name}`);
    }
  }
}

export function assertBooleanOptions(args: ParsedArgs, names: readonly string[]) {
  for (const name of names) {
    const value = args.options.get(name);
    if (value !== undefined && value !== true) {
      throw new Error(`--${name} does not accept a value`);
    }
  }
}

export function assertStringOptions(args: ParsedArgs, names: readonly string[]) {
  for (const name of names) {
    const value = args.options.get(name);
    if (value !== undefined && (typeof value !== 'string' || value.length === 0)) {
      throw new Error(`--${name} requires a value`);
    }
  }
}

export function assertNoPositionals(args: ParsedArgs, command: string) {
  if (args.positionals.length > 0) {
    throw new Error(`review-tour ${command} does not accept positional arguments.`);
  }
}
