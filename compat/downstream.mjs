// Checks that real packages which depend on okapibm25 behave the same with the
// new build as with the version users have today.
//
// For each package in downstream.json:
//   1. install it from npm, with okapibm25 forced to the version that is
//      `latest` on npm (the baseline),
//   2. run the package's script from downstream/ and keep what it prints,
//   3. replace the installed okapibm25 with the packed tarball from this
//      checkout (the candidate), leaving every other package untouched,
//   4. run the same script again. The two outputs must be identical.
//
// - Different output, or a candidate that fails where the baseline works, is a
//   failure: upgrading okapibm25 would change that package's behaviour.
// - A package that cannot be installed, or whose script already fails with the
//   baseline, is reported and skipped. That is a problem with the registry or
//   with that package, not with this build.
// - If nothing at all could be compared, the run fails, so that a release is
//   never waved through by a check that did not happen.
//
// Run with `npm run test:downstream` from the repository root, which builds
// first. Options: `--tarball <file>` checks an existing tarball,
// `--baseline <version>` compares against a chosen published version.
//
// Install scripts of the downloaded packages are never run.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const onWindows = process.platform === "win32";
const npm = onWindows ? "npm.cmd" : "npm";
const MINUTE = 60 * 1000;

const run = (command, args, cwd, timeout = 2 * MINUTE) =>
  execFileSync(command, args, { cwd, encoding: "utf8", shell: onWindows, stdio: ["ignore", "pipe", "pipe"], timeout });

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const describe = (error) =>
  String(error.stderr || error.stdout || error.message || error)
    .trim()
    .split("\n")
    .slice(-15)
    .map((line) => `      ${line}`)
    .join("\n");

const versionIn = (directory) => JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version;

const { name } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const entries = JSON.parse(readFileSync(join(here, "downstream.json"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "okapibm25-downstream-"));

let failed = 0;
let skipped = 0;
const skip = (label, reason, error) => {
  skipped++;
  console.log(`SKIP  ${label}: ${reason}`);
  console.log(describe(error));
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::Downstream check skipped for ${label}: ${reason}`);
};

try {
  let tarball = option("--tarball");
  if (tarball) {
    tarball = resolve(tarball);
    assert.ok(existsSync(tarball), `--tarball: no such file: ${tarball}`);
  } else {
    const [packed] = JSON.parse(run(npm, ["pack", "--json", "--pack-destination", work], root));
    tarball = join(work, packed.filename);
  }
  const candidateVersion = JSON.parse(run("tar", ["-xzOf", tarball, "package/package.json"], work)).version;
  const baselineVersion = option("--baseline") || run(npm, ["view", name, "version"], root).trim();
  console.log(`Baseline ${name}@${baselineVersion} from npm, candidate ${name}@${candidateVersion} from ${tarball}\n`);

  for (const entry of entries) {
    const label = `${entry.package}@${entry.version}`;
    const project = join(work, entry.package.replace(/\W+/g, "-"));
    mkdirSync(project);
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({
        name: "downstream-check",
        private: true,
        dependencies: { [entry.package]: entry.version },
        // Forces the baseline everywhere in the tree, whatever range the
        // dependent asks for.
        overrides: { [name]: baselineVersion },
      }),
    );

    try {
      run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock"], project, 10 * MINUTE);
    } catch (error) {
      skip(label, `it could not be installed with ${name}@${baselineVersion}.`, error);
      continue;
    }

    try {
      // From here on a problem is either this script's or the candidate's, so
      // it fails the run instead of being skipped.
      const copies = run(npm, ["ls", name, "--all", "--parseable"], project).trim().split("\n").filter(Boolean);
      assert.equal(copies.length, 1, `Expected one copy of ${name} in the install, found ${copies.length}: ${copies.join(", ")}`);
      const [installed] = copies;
      assert.equal(versionIn(installed), baselineVersion, `The baseline install has ${name}@${versionIn(installed)}.`);
      copyFileSync(join(here, entry.script), join(project, "check.cjs"));

      let baseline;
      try {
        baseline = run(process.execPath, ["check.cjs"], project);
      } catch (error) {
        skip(label, `its script already fails with ${name}@${baselineVersion}.`, error);
        continue;
      }

      // Swap in the candidate. Only this one directory changes between the two
      // runs, so a difference in output can only come from okapibm25.
      rmSync(installed, { recursive: true, force: true });
      mkdirSync(installed, { recursive: true });
      run("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"], project);
      assert.equal(versionIn(installed), candidateVersion, "The candidate was not unpacked into the install.");

      let candidate;
      try {
        candidate = run(process.execPath, ["check.cjs"], project);
      } catch (error) {
        failed++;
        console.log(`FAIL  ${label}: works with ${name}@${baselineVersion}, fails with the candidate.`);
        console.log(describe(error));
        continue;
      }

      if (candidate === baseline) {
        console.log(`ok    ${label}: identical output with ${baselineVersion} and the candidate (${baseline.length} characters compared)`);
      } else {
        failed++;
        let at = 0;
        while (at < baseline.length && baseline[at] === candidate[at]) at++;
        const from = Math.max(0, at - 80);
        console.log(`FAIL  ${label}: output differs between ${baselineVersion} and the candidate, first at character ${at}.`);
        console.log(`      baseline:  ...${baseline.slice(from, at + 160).replace(/\n/g, "\\n")}`);
        console.log(`      candidate: ...${candidate.slice(from, at + 160).replace(/\n/g, "\\n")}`);
      }
    } catch (error) {
      failed++;
      console.log(`FAIL  ${label}: the check itself could not be completed.`);
      console.log(describe(error));
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const checked = entries.length - skipped;
console.log(
  `\n${checked} of ${entries.length} dependent package(s) checked, ${failed} failed` +
    (skipped ? `, ${skipped} skipped.` : "."),
);
if (checked === 0) console.log("Nothing could be compared, so this run proves nothing and fails.");
process.exit(failed === 0 && checked > 0 ? 0 : 1);
