// Decides whether the version in package.json should be published to npm.
//
// A version is published when the npm registry does not have it yet, so a
// release is a pull request that bumps "version". A prerelease such as
// 2.0.0-beta.1 goes to the "next" dist-tag, so that "npm install okapibm25"
// keeps giving the last stable version.
//
// Prints the decision. On GitHub Actions it also writes the job outputs
// `name`, `version`, `publish` and `tag`, and a line in the run summary.
import { appendFileSync, readFileSync } from "node:fs";

const fail = (message) => {
  console.error(`publish-plan: ${message}`);
  process.exit(1);
};

const manifestUrl = new URL("../package.json", import.meta.url);
const { name, version } = JSON.parse(readFileSync(manifestUrl, "utf8"));

// The version becomes a git tag and a release title, so only plain versions pass.
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`"${version}" in package.json is not a version like 1.2.3 or 1.2.3-beta.1.`);
}

const response = await fetch(
  `https://registry.npmjs.org/${name.replace("/", "%2F")}`,
  { headers: { accept: "application/vnd.npm.install-v1+json" } },
);

let publishedVersions = [];
let latest = "none";
if (response.ok) {
  const packument = await response.json();
  publishedVersions = Object.keys(packument.versions || {});
  latest = (packument["dist-tags"] || {}).latest || "none";
} else if (response.status !== 404) {
  // Anything but "no such package" is a registry problem. Guessing here could
  // skip a release, so stop instead.
  fail(`the npm registry answered ${response.status} for ${name}.`);
}

const publish = !publishedVersions.includes(version);
const tag = version.includes("-") ? "next" : "latest";

const summary = publish
  ? `${name}@${version} is not on npm (latest there: ${latest}). ` +
    `On master it is published with the dist-tag "${tag}".`
  : `${name}@${version} is already on npm. Nothing to publish.`;
console.log(summary);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `name=${name}\nversion=${version}\npublish=${publish}\ntag=${tag}\n`,
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
