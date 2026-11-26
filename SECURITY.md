# Security

## Reporting a problem

Please report security problems privately, not in a public issue. On the repository page, open the **Security** tab and choose **Report a vulnerability**.

Include the version you use, the input that triggers the problem and what happens.

## What to expect from this package

- Keywords and documents are treated as plain text. A keyword is never run as a regular expression, so text typed by a user can be passed in directly.
- The package has no runtime dependencies.
- Running time grows with the total length of the documents multiplied by the number of keywords, and long keywords can add to it. If your documents or keywords come from users, limit their size and number before calling `BM25`.

Only the latest release receives fixes.
