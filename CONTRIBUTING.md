# Contributing

Submit a pull request if you have a useful feature that you'd like to add. If this isn't your area of expertise, open an issue and I'll get to it.

## Setup

Working on the package needs Node 22.18 or later. The published package itself runs on Node 12 and later.

```sh
npm install
npm run check   # typecheck, tests, build, package check, API snapshot
npm test        # tests only; coverage must stay at 100%
npm run bench   # speed compared with version 1.4.1

npm run test:compat      # the packed package on TypeScript 4.0 to current, esbuild, webpack and vite
npm run test:downstream  # the largest dependent package gives the same results as with the published version
```

## Changing scores or the API

The tests in `tests/regression` compare the code against the published 1.4.1 build, so a change in scores shows up as a failure. If you change scores on purpose, add the case to `tests/behavior_changes.test.ts` and note it in `CHANGELOG.md`.

A change to the exported types or names fails the check until you update the snapshot with `npm run test:api -- --update`.

## Releasing

Bump `version` in `package.json`, move the notes in `CHANGELOG.md` under a heading for that version, and merge the pull request. The `Publish` workflow then publishes the new version to npm and creates the GitHub release. `node scripts/publish-plan.mjs` shows what it would do.

## Security

To report a security problem, see `SECURITY.md`.
