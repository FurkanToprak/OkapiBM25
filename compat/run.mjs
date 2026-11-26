// Checks the packed package in the setups its users have, beyond the one this
// repository builds with:
//   1. strict TypeScript consumers on old and current TypeScript versions,
//   2. bundlers (esbuild, webpack, vite), by bundling a small application and
//      comparing what it prints with the same application run unbundled,
//   3. the syntax level of the build, which must parse as ES2015.
//
// Run with `npm run test:compat` from the repository root, which builds first.
// `--tarball <file>` checks an existing tarball; without it one is packed.
//
// The tools live in this folder with their own lockfile, so the package's own
// development dependencies stay small.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(here, ".out");
const fixtures = join(here, "fixtures");
const onWindows = process.platform === "win32";
const npm = onWindows ? "npm.cmd" : "npm";

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8", shell: onWindows, stdio: ["ignore", "pipe", "pipe"] });

const failures = [];
const check = async (label, body) => {
  try {
    const detail = await body();
    console.log(`ok    ${label}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failures.push(label);
    console.log(`FAIL  ${label}`);
    const text = [error.stdout, error.stderr, error.stdout || error.stderr ? "" : error.stack]
      .filter(Boolean)
      .join("\n");
    console.log(text.trim().split("\n").map((line) => `      ${line}`).join("\n"));
  }
};

// --- Setup ------------------------------------------------------------------

// Install the tools on the first run, and again whenever the lockfile has
// changed since, so a stale installation is never what gets tested with.
const lockfile = join(here, "package-lock.json");
const installedLock = join(here, "node_modules", ".package-lock.json");
if (!existsSync(installedLock) || statSync(lockfile).mtimeMs > statSync(installedLock).mtimeMs) {
  console.log("Installing the tools in compat/.");
  run(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], here);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const tarballFlag = process.argv.indexOf("--tarball");
let tarball;
if (tarballFlag !== -1) {
  tarball = resolve(process.argv[tarballFlag + 1] || "");
  assert.ok(existsSync(tarball), `--tarball: no such file: ${tarball}`);
} else {
  const [packed] = JSON.parse(run(npm, ["pack", "--json", "--pack-destination", out], root));
  tarball = join(out, packed.filename);
}

// Put the packed package where the fixtures find it by name. It has no
// dependencies, so unpacking it is the whole installation.
const installed = join(here, "node_modules", "okapibm25");
rmSync(installed, { recursive: true, force: true });
mkdirSync(installed, { recursive: true });
run("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"], here);
const manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
console.log(`Checking ${manifest.name}@${manifest.version} from ${tarball}\n`);

// --- 1. TypeScript versions -------------------------------------------------

const compatManifest = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
const typeScripts = Object.keys(compatManifest.devDependencies)
  .filter((name) => name.startsWith("typescript-"))
  .map((name) => join(here, "node_modules", name));
// The version this repository builds with, which Dependabot keeps current.
typeScripts.push(join(root, "node_modules", "typescript"));

const atLeast = (version, major, minor) => {
  const [a, b] = version.split(".").map(Number);
  return a > major || (a === major && b >= minor);
};

// Each consumer is a way users set up TypeScript, with the first version that
// supports it.
const consumers = [
  { name: "commonjs", since: [4, 0], file: "typed-cjs.ts", options: { module: "commonjs", esModuleInterop: true } },
  { name: "nodenext", since: [4, 7], file: "typed-esm.mts", options: { module: "nodenext" } },
  { name: "bundler", since: [5, 0], file: "typed-bundler.ts", options: { module: "esnext", moduleResolution: "bundler" } },
];

for (const directory of typeScripts) {
  const { version, bin } = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const tsc = join(directory, bin.tsc);
  await check(`TypeScript ${version}`, () => {
    const checked = [];
    for (const consumer of consumers) {
      if (!atLeast(version, ...consumer.since)) continue;
      const project = join(out, `tsconfig.${version}.${consumer.name}.json`);
      writeFileSync(
        project,
        JSON.stringify({
          // skipLibCheck is off so the published .d.ts itself is checked.
          compilerOptions: { strict: true, noEmit: true, types: [], skipLibCheck: false, ...consumer.options },
          files: [join(fixtures, consumer.file)],
        }),
      );
      run(process.execPath, [tsc, "-p", project], here);
      checked.push(consumer.name);
    }
    assert.ok(checked.length > 0, `No consumer in this script supports TypeScript ${version}.`);
    return checked.join(", ");
  });
}

// --- 2. Bundlers ------------------------------------------------------------

const execute = (file) => JSON.parse(run(process.execPath, [file], here));
const moduleEntry = join(fixtures, "entry.mjs");
const reference = execute(moduleEntry);

// Bundlers treat the importing file in two ways. From a .mjs file they follow
// Node: a default import of this package is the exports object. From a plain
// .js or .ts file, which is what most applications have, the default import
// is the function, so `import BM25 from "okapibm25"; BM25(...)` works. That
// second form must keep working, so it is pinned here.
const scriptEntry = join(out, "entry.js");
copyFileSync(moduleEntry, scriptEntry);
const importers = [
  { kind: "from .js", entry: scriptEntry, defaultImport: "function" },
  { kind: "from .mjs", entry: moduleEntry, defaultImport: "object with .default" },
];
// The forms 1.4.1 users write: `BM25(...)` after a default import where that
// is the function, `BM25.default(...)` where it is the exports object.
const reachesFunction = (interop) =>
  Object.values(interop).some((form) => form === "function" || form === "object with .default");
assert.ok(reachesFunction(reference.interop), `Node: no import form gives the function: ${JSON.stringify(reference.interop)}`);

const bundlers = [
  {
    name: "esbuild for Node",
    file: "esbuild-node.cjs",
    bundle: async (entry, file) => {
      const { build } = await import("esbuild");
      await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", outfile: file, logLevel: "silent" });
    },
  },
  {
    // Fails if the package needs anything that only exists in Node.
    name: "esbuild for browsers",
    file: "esbuild-browser.cjs",
    bundle: async (entry, file) => {
      const { build } = await import("esbuild");
      await build({ entryPoints: [entry], bundle: true, platform: "browser", format: "iife", outfile: file, logLevel: "silent" });
    },
  },
  {
    name: "webpack",
    file: "webpack.cjs",
    bundle: async (entry, file) => {
      const { default: webpack } = await import("webpack");
      const compiler = webpack({
        mode: "production",
        target: "node",
        context: here,
        entry,
        output: { path: dirname(file), filename: basename(file) },
      });
      await new Promise((done, fail) =>
        compiler.run((error, stats) => {
          if (error) return fail(error);
          if (stats.hasErrors()) return fail(new Error(stats.toString("errors-only")));
          compiler.close(() => done());
        }),
      );
    },
  },
  {
    name: "vite",
    file: "vite.mjs",
    bundle: async (entry, file) => {
      const { build } = await import("vite");
      await build({
        root: here,
        configFile: false,
        logLevel: "silent",
        build: {
          lib: { entry, formats: ["es"], fileName: () => basename(file) },
          outDir: dirname(file),
          emptyOutDir: false,
          minify: false,
        },
      });
    },
  },
];

for (const { name, file, bundle } of bundlers) {
  await check(name, async () => {
    for (const importer of importers) {
      const output = join(out, importer.kind.replace(/\W+/g, "-"), file);
      await bundle(importer.entry, output);
      // The package must be inside the bundle. If a bundler left it as an
      // import, running the bundle would load the installed copy and prove
      // nothing about bundling.
      assert.doesNotMatch(
        readFileSync(output, "utf8"),
        /["']okapibm25["']/,
        `${importer.kind}: the bundle still imports okapibm25 instead of containing it.`,
      );
      const bundled = execute(output);
      assert.deepEqual(bundled.result, reference.result, `${importer.kind}: the bundle computes different results than Node does.`);
      assert.equal(bundled.interop.defaultImport, importer.defaultImport, `${importer.kind}: the default import changed shape.`);
    }
    return importers.map((importer) => `${importer.kind} the default import is the ${importer.defaultImport}`).join(", ");
  });
}

// --- 3. Syntax level --------------------------------------------------------

await check(`${manifest.main} parses as ES2015`, async () => {
  const { parse } = await import("acorn");
  // Syntax only. Runtime features are covered by the Node 12 job in CI.
  parse(readFileSync(join(installed, manifest.main), "utf8"), { ecmaVersion: 2015, sourceType: "script" });
});

console.log(
  failures.length === 0
    ? "\nCompatibility checks passed."
    : `\n${failures.length} compatibility check(s) failed: ${failures.join("; ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
