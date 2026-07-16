# Agent guidelines

- Avoid force-pushing or rewriting published git history on shared branches.
- Keep the default branch in a working state before pushing commits.
- For this repo, every commit and push must attribute **henrysammarfo** (GitHub CLI active account + commit author/committer). Do not use RicheySon or other identities — Vercel blocks deploys when the Git author does not match. Prefer per-commit overrides without changing global git config:
  `git -c user.name="Henry Sam Marfo" -c user.email="90197918+henrysammarfo@users.noreply.github.com" commit ...`
  Optionally add `Co-authored-by: Henry Sam Marfo <90197918+henrysammarfo@users.noreply.github.com>` only when a second author actually contributed; do not fake co-authors.
