# Add or update an example

1. Add one self-contained folder under `examples/<stable-topic-slug>/`. Include README.md, example.json, package.json, package-lock.json, LICENSE, .gitignore, runnable source and meaningful offline tests. Add safe data, templates or failure fixtures when useful.
2. Document the outcome, article URL, supported Node.js version, setup, expected output, limitations, troubleshooting and costs. Explain whether environment variables are loaded from a file or the process.
3. Pin runtime dependencies and commit the lockfile. Never include real keys, .env, customer inputs, response logs, node_modules or generated outputs. Keep sample media on https://cdn.zvid.io and link it.
4. Run npm ci, npm run check and npm test in the example. Tests must not use live credentials, call production APIs or spend render credits. Keep any paid operation an explicit documented command.
5. Update the root catalog, then run npm ci, npm run check and npm test at the root. CI repeats these checks on Node.js 22 and 24.
6. Commit the reviewed source. Run `npm run package -- <slug>` to produce a ZIP plus a manifest from that commit. The packager refuses uncommitted changes to the example. Extract the ZIP into a fresh folder and repeat its installation, checks and tests.
7. Publish reviewed packages through the existing Zvid B2/CDN publishing process. Verify stored and CDN bytes against the manifest before changing article links. Add the public source commit, CDN URL and checksums to a dated release record. Never put storage credentials in this repository.

Use a commit-pinned GitHub folder link beside each article's ZIP link so they refer to the same source. Old immutable ZIP URLs remain valid. Update development blog content through new versions before separately authorized production publication.

New examples must run without importing files from sibling examples. Shared repository scripts are for maintenance only. A small helper can stay inside the example it explains.

Full Node.js automation workflow examples belong in Zvid-io/workflow-examples and follow its contribution requirements. Do not duplicate their implementation here.

Support: https://zvid.io/contact
