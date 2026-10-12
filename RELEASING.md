# Releasing

All packages share one version and are released together. Pushing a version
tag (`0.2.0`, `0.2.0-beta.1`) runs `.github/workflows/release.yaml`, which
verifies the tree and publishes every workspace member to npm. On every other
push CI only proves that a release would succeed (`vp pm pack -r`).

## Checklist

1. Make sure `main` is green: `check`, `test`, `test-dist`, `treeshake` and
   `publish-dry-run`.
2. Bump every `package.json` at once (this also rewrites the
   `@openstatus/health` peer range in the adapters and probes):

   ```sh
   vp run update-versions 0.2.0
   vp run check:versions
   ```

3. Add a `0.2.0` section to `CHANGES.md`.
4. Run the full suite locally:

   ```sh
   vp run test-all
   ```

5. Commit, tag and push. The tag must equal the manifest version; the
   workflow refuses to publish otherwise.

   ```sh
   git commit -am "Release 0.2.0"
   git tag 0.2.0
   git push origin main 0.2.0
   ```

6. Watch the `release` workflow. It runs two jobs:

   - `verify`: `vp run check:versions <tag>`, `vp run test-all` and
     `vp pm pack -r` for every package.
   - `npm`: `vp run build`, then `vp pm publish -r --provenance`. pnpm
     publishes in dependency order (`@openstatus/health` first, since every
     other package peers on it at `^<version>`), rewrites the `workspace:*`
     dev links and skips versions that are already on npm, so a failed run
     can be re-run from the Actions tab.

7. Create a GitHub release from the tag with the `CHANGES.md` entry.

## One-time setup

npm authenticates the workflow in one of two ways:

- Trusted publishing: on npmjs.com add a trusted publisher to every package
  (repository `openstatusHQ/health`, workflow `release.yaml`, no
  environment). Nothing else to configure.
- Token: create a granular access token with publish rights on the
  `@openstatus` scope and 2FA bypass, and store it as the `NPM_TOKEN`
  repository secret. The workflow uses it when present and falls back to
  trusted publishing when it is empty.

## Publishing by hand

If the workflow cannot run, the same steps work locally:

```sh
vp run build
vp pm publish -r --access public -- --ignore-scripts
```

Always publish through `vp pm publish` (pnpm), never `npm publish`: npm does
not rewrite `workspace:*` ranges.

## Sanity checks before publishing

- `vp pm pack -r --pack-destination /tmp/tarballs` writes one tarball per
  package, each listing only `dist/`, `LICENSE`, `README.md` and
  `package.json`.
- Install the tarballs into a scratch project and import them from both ESM
  and CJS:

  ```sh
  mkdir /tmp/smoke && cd /tmp/smoke && npm init -y
  npm i --ignore-scripts /tmp/tarballs/openstatus-health-*.tgz
  node -e 'import("@openstatus/health").then((m) => console.log(Object.keys(m)))'
  node -e 'console.log(Object.keys(require("@openstatus/health")))'
  ```
