# Publish a reviewed preview

The desktop build workflow tests and packages four native targets. Publishing is a separate manual operation so a source push does not publish installers.

1. Review a successful **Build desktop apps** run from this repository's `main` or `master` branch. Record its numeric run ID and full commit SHA.
2. Create a draft release named `vVERSION`, matching that commit's `package.json`. Set the draft target to the full reviewed commit SHA and write the release notes. The draft must contain only the expected Grove installer files, skill ZIP, or checksums.
3. Run **Actions > Publish reviewed draft > Run workflow**, providing that native build run ID.

The publishing job checks the build's repository, workflow, branch, event, commit, overall result, and each target's validation, desktop test, skill test, packaging, and artifact upload steps. It checks out the reviewed commit, downloads the four artifact groups, verifies the complete installer set and ZIP integrity, and packages that commit's Grove skill.

It uploads files to the matching unpublished draft and verifies GitHub's asset sizes and SHA-256 digests before publishing it as a prerelease. It can replace expected files in that draft, which makes a failed upload recoverable. It refuses to modify an already published release, publish incomplete artifacts, or reuse a tag pointing at another commit. Unrelated draft assets cause a failure instead of deletion.

This workflow transfers installers within GitHub's infrastructure, avoiding dependence on a developer device uploading large binaries. It uses a temporary Actions token with repository content write and Actions read access. It does not execute the downloaded installers or request any personal credentials.
