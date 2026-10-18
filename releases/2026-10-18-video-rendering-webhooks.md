# Video rendering webhooks

- Source commit: `cf523468231c5f0c09b06a00ccd8126303658503`
- [Source folder](https://github.com/Zvid-io/blog-examples/tree/cf523468231c5f0c09b06a00ccd8126303658503/examples/video-rendering-webhooks)
- [Independent ZIP](https://cdn.zvid.io/blog/video-rendering-webhooks/d10ec6aef17f/video-rendering-webhooks-example.zip)
- SHA-256: `d10ec6aef17ff4072f008ac1cfffaea5cdf2f4267fe37db33c485847d11823e3`
- Size: 15,499 bytes
- Archive root: `video-rendering-webhooks/`
- [CI](https://github.com/Zvid-io/blog-examples/actions/runs/39136507734): passed, including Node.js 22 and 24 example and standalone-archive checks.

Source and a clean extracted ZIP passed installation, syntax checks, 13 offline tests and the local HTTP demonstration: three 204 responses, two inbox receipts and one outbox action. Stored B2 bytes and ordinary CDN downloads match the source archive hash. MIME type, immutable caching and download filename were verified. Anonymous access to the commit-pinned folder returned HTTP 200.

The example uses synthetic signed events and does not render or download videos. A deployed public receiver, real Zvid delivery and authenticated job reconciliation were not exercised in this release. The outbox records intent; downstream dispatch, scheduling and deployment operations remain application responsibilities. The blog article remains a local editorial draft.
