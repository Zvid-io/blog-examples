# Blog example repository instructions

- Keep one independently runnable teaching example per examples/<slug>/ directory. Follow CONTRIBUTING.md.
- Use the exact canonical Zvid URLs in the root README. Keep the brand Zvid. Do not name stock providers in public prose.
- Preserve article command compatibility; use a small root entry point if moving implementation into src/.
- Pin dependencies, keep an example-local lockfile and add meaningful offline behavior tests. CI must never render or require real credentials.
- Never commit .env, customer inputs, API response logs, generated output, private URLs or node_modules. .env.example must have blank or illustrative values.
- Use CDN URLs for media. Build each source ZIP from a recorded commit and verify it independently before publication.
- Keep README descriptions honest about validation, paid rendering, retries and limitations. Include support at https://zvid.io/contact.
- Preserve existing published URLs and saved article versions.
- Use commit prefixes: 📦 NEW:, 👌 IMPROVE:, 🐛 FIX:, ♻️ REFACTOR:, 📖 DOC:, 🤖 TEST:, ‼️ BREAKING:.
- Complete automation workflows belong in Zvid-io/workflow-examples.
