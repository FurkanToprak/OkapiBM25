# Changelog

## 2.1.0 - 2026-11-27

Nothing changes for existing code: `BM25` and the helpers behave exactly as in 2.0.0.

### Added
- **`createIndex(documents, options?)`**, for searching the same documents many times. It reads the documents once and builds an index of their words. After that, `index.search(keywords, { limit })` returns the matching documents, best first, each with its position, and `index.scores(keywords)` returns one score per document like `BM25`.
- Speed, measured on an Apple M3 with 10,000 documents of 200 words and five keywords: building the index takes about 210 ms, and a search for the best 10 results about 0.5 ms. One `BM25` call on the same documents takes about 60 ms.
- The index matches whole words, where `BM25` matches text anywhere: `cat` finds the word `cat` and not `concatenate`. It ignores case unless `caseSensitive: true` is passed, and it splits keywords into words the same way as documents, so the keyword `dog?` finds `dog`. A word is a run of letters, digits and underscores in any script, so `café` and `москва` are words.
- The formula and the defaults of `k1` and `b` are those of `BM25`. With `caseSensitive: true`, on English text, `index.scores` returns exactly the numbers `BM25` returns for keywords that are single words and occur only as whole words.
- An index rejects options that cannot give a meaningful result, where `BM25` uses them as given: `k1` must be a finite number of 0 or more, `b` a number from 0 to 1, and `limit` a number of 0 or more.
- A `tokenizer` option for `createIndex`, to decide what a word is. Use it for languages written without spaces, or to remove common words.
- The types `BMIndex`, `BMIndexOptions`, `BMSearchOptions` and `BMHit`.
- `npm run bench` also reports the time to build an index and to search it.

### Changed
- The README is rewritten: a quick start with real output, a recipe for searching what a user typed, the API, and what to expect for speed. Notes for contributors moved to `CONTRIBUTING.md`.
- The published package grows from about 30 kB to about 70 kB unpacked, and the build from 2 kB to 5 kB gzipped.

## 2.0.0 - 2026-11-26

Scores are unchanged for ordinary input: string documents, plain-text keywords, numeric `k1` and `b` above zero, and at least one document containing a word. The regression tests run the new code and the published 1.4.1 build on random input of that kind and require identical output, bit for bit. The cases below are the only ones where results differ.

This is a major version because keywords are now matched as plain text. That changes the scores of keywords that contain punctuation.

### Upgrading from 1.x
Most callers need no change. Check these cases:
- **Keywords with punctuation attached.** Punctuation is now part of what is matched. The keyword `dog?` matched `dog` in 1.4.1, because `?` was regular expression syntax. It now matches only the text `dog?`. If you get keywords by splitting a user's question on spaces, remove the punctuation from each word first.
- **Keywords you escape yourself.** If your code escapes regular expression characters before calling `BM25`, for example `c\+\+` or `node\.js`, remove the escaping. The backslash is now matched as a character, so an escaped keyword scores zero.
- **Keywords that were regular expressions on purpose**, such as `colou?r`. They no longer work as patterns. Pass each spelling as its own keyword.
- **`k1` or `b` passed as strings.** Convert them with `Number()`.
- **TypeScript casts.** A cast of the result to the type the call does not return is now a compile error. Remove the cast.
- **ES5 environments.** The build is now ES2015.

### Fixed
- **Keywords are matched as plain text, not as regular expressions.** In 1.4.1 a keyword such as `c++` or `(` threw a `SyntaxError`, `.` matched any character, and a crafted keyword such as `(a+)+$` could freeze the process (ReDoS). Keywords containing regular expression syntax now match their literal text. If you relied on passing a regular expression as a keyword, this release changes your results. The exported `getTermFrequency` changes in the same way.
- **`k1: 0` and `b: 0` are honoured.** 1.4.1 silently replaced `0` with the defaults `1.2` and `0.75`.
- **No more `NaN` scores for valid parameters** (`k1` of 0 or more, `b` from 0 to 1). 1.4.1 returned `NaN` for every document when no document contained a word made of `a-z`, `A-Z`, `0-9` or `_` (for example a collection written only in Japanese or Russian), and for an empty document when `b` was `1`. A negative or infinite `k1` can still produce `NaN`, as before.
- **An empty keyword scores zero.** 1.4.1 counted it once per character.
- **Documents that are not strings score zero.** 1.4.1 threw on `null`.
- **`k1` and `b` are used only when they are numbers.** Anything else falls back to the default. 1.4.1 did arithmetic on whatever it was given: `b: "0.1"` happened to work, and `k1: "2"` gave wrong scores. If you pass these as strings, convert them with `Number()`.
- **Keywords that are neither strings nor numbers score zero.** 1.4.1 turned `null` into the pattern `null` and `undefined` into a pattern that matches everything. A number passed as a keyword is still searched as text.
- `import { BM25 } from "okapibm25"`, the form the README has always shown, now works. `BM25` is a named export as well as the default export.
- `npm install` in a clone of the repository no longer runs the test suite and the build.

### Changed
- About twice as fast as 1.4.1 on the included benchmark (`npm run bench`).
- The return type follows the call: `number[]` without a sorter, `BMDocument[]` with one. A cast that matches what the call returns still compiles. A cast to the other type, which was always wrong at run time, is now a compile error.
- `documents` and `keywords` accept read-only arrays.
- Passing something other than an array for `documents` or `keywords` throws a `TypeError` that names the argument.
- The published package contains only the build, the README and the license: 6 files and about 30 kB, down from 24 files and 70 kB. Test files, coverage reports and build configuration are no longer published.
- The build targets ES2015 instead of ES5. It loads and runs on Node 12 and later. The test tools need Node 22.18 or later, so the full test suite runs on Node 22 and 24, and the build is loaded on Node 12 to 20.

### Added
- Regression tests against the published 1.4.1 build, property-based tests, security tests, compile-time type tests and a check of the packed tarball.
- A benchmark, `npm run bench`.
- Continuous integration: the full test suite on Node 22 and 24, the build on Node 12, 14, 16, 18 and 20.
