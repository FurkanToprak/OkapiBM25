// Checks a release after it is published, against what npm really serves.
//
//   1. npm has the version from package.json (waits for the registry).
//   2. The file npm serves is byte for byte the tarball that was tested:
//      the registry's sha512 equals the sha512 of `--tarball <file>`.
//   3. The dist-tag given with `--tag <name>` points at the version, and a
//      prerelease has not become `latest`.
//   4. Installed from npm into an empty project, the package passes the same
//      checks as before publishing (scripts/check-package.mjs).
//
// Usage: node scripts/verify-published.mjs --tarball <file> --tag <dist-tag>
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { name, version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const registry = `https://registry.npmjs.org/${name.replace("/", "%2F")}`;

const option = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};
const tarball = option("--tarball");
const tag = option("--tag") || "latest";
// How long to wait for the registry to show a new version, in seconds.
const patience = Number(process.env.VERIFY_WAIT_SECONDS || 300);

// Checked before anything else: a wrong argument is a mistake in the caller,
// not a problem with the release.
if (!tarball || !existsSync(tarball)) {
  console.error(`verify-published: --tarball must name the tarball that was tested. Got: ${tarball}`);
  process.exit(2);
}

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

// Asks the registry until `read` returns something or the time is up. A
// version can take a little while to show up after `npm publish` returns.
const waitFor = async (what, read) => {
  const deadline = Date.now() + patience * 1000;
  let last = "no answer";
  for (;;) {
    try {
      const response = await fetch(registry, { headers: { "cache-control": "no-cache" } });
      if (response.ok) {
        const value = read(await response.json());
        if (value.done) return value.done;
        last = value.waiting;
      } else {
        last = `the registry answered ${response.status}`;
      }
    } catch (error) {
      last = error.message;
    }
    if (Date.now() >= deadline) throw new Error(`${what}: ${last} after ${patience} seconds.`);
    await sleep(10 * 1000);
  }
};

let onNpm = false;
const fail = (message) => {
  const advice = onNpm
    ? [
        "",
        "The version is published and cannot be replaced. To protect users while it is fixed:",
        `  npm dist-tag add ${name}@<last good version> ${tag}    # new installs get the old version again`,
        `  npm deprecate ${name}@${version} "<what is wrong>"     # warns anyone who installs this one`,
        "Then publish a fixed version.",
      ]
    : [];
  const report = [`Verification of ${name}@${version} on npm failed.`, "", message, ...advice].join("\n");
  console.error(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`\n${report}\n\`\`\`\n`);
  process.exit(1);
};

try {
  // 1. The version exists.
  const published = await waitFor(`${name}@${version} is not on npm`, (packument) =>
    packument.versions && packument.versions[version]
      ? { done: packument.versions[version] }
      : { waiting: `latest there is ${(packument["dist-tags"] || {}).latest}` },
  );
  onNpm = true;
  console.log(`ok    ${name}@${version} is on npm`);

  // 2. It is the tarball that was tested.
  const tested = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
  if (published.dist.integrity !== tested) {
    fail(
      `npm serves a different file than the one that was tested.\n` +
        `  tested:  ${tested}\n  on npm:  ${published.dist.integrity}`,
    );
  }
  console.log("ok    the file on npm is the tarball that was tested (same sha512)");

  // 3. The dist-tag points at it.
  await waitFor(`the dist-tag "${tag}" does not point at ${version}`, (packument) =>
    (packument["dist-tags"] || {})[tag] === version
      ? { done: true }
      : { waiting: `it points at ${(packument["dist-tags"] || {})[tag]}` },
  );
  console.log(`ok    the dist-tag "${tag}" points at ${version}`);
  // Checked from the version itself, not from the tag this script was given.
  if (version.includes("-")) {
    const response = await fetch(registry, { headers: { "cache-control": "no-cache" } });
    const latest = ((await response.json())["dist-tags"] || {}).latest;
    if (latest === version) fail(`${version} is a prerelease, but the dist-tag "latest" points at it.`);
    console.log(`ok    "latest" still points at ${latest}, not at this prerelease`);
  }

  // 4. It installs and works for a user.
  const output = execFileSync(
    process.execPath,
    [join(root, "scripts", "check-package.mjs"), "--from-registry", `${name}@${version}`],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  console.log(`ok    ${output.trim()}`);
} catch (error) {
  fail(String(error.stderr || error.message || error).trim());
}
