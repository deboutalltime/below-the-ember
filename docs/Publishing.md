# GitHub publication

Public repository: [deboutalltime/below-the-ember](https://github.com/deboutalltime/below-the-ember).

The source, tests, instructions, reports, presentation and demo were published to the public repository on 25 October 2026. Anonymous GitHub API requests confirmed public visibility and the main branch. An independent clone with the credential helper disabled successfully downloaded all 103 files in the initial publication commit. See results/github-publication.json for the recorded source commit.

The instructor can read and download this public repository without signing in or receiving an invitation. This verifies technical read access; it does not claim that the instructor has opened or accepted the submission.

For later updates from the prepared project folder in PowerShell, run Publish-GitHub.ps1 with https://github.com/deboutalltime/below-the-ember.git as RepositoryUrl. The script accepts only a github.com repository URL, requires reviewed committed files, and pushes main without force. It does not replace an existing different origin and does not create or sign in to a GitHub account.

For a source ZIP without Git history, extract it, run git init with main as the initial branch, add the files, and make an initial commit using your configured Git identity before using the publisher. Do not commit node_modules, local build helpers, credentials, private history or environment secrets.

To reproduce the game, clone the repository into a new folder and follow the README. The included clean-install check verifies the dependency lockfile and build from a fresh source copy; the publication check separately verifies anonymous cloning from GitHub.
