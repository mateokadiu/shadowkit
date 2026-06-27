# @shadowkit/devtools

> Runtime contract for the shadowkit Chrome DevTools panel.

The buildable extension scaffold lives at `templates/devtools-extension/`.
This package ships the small library both sides agree on:

- The postMessage envelope shape that components emit when devtools is
  attached.
- A `tap()` helper your component code calls in development to publish
  bridge messages, store snapshots, and lifecycle events.

See the v1.0 release notes in the root README for the panel's behavior.
