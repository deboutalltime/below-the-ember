# GitHub publication

The local repository contains the source, tests, instructions, reports, presentation and demo. A local Git commit is not proof of remote publication. Record the actual repository URL after a successful push and verify that the instructor can access it.

Bekzat Zhailkhan requested a public repository in the GitHub account deboutalltime. Authentication and a verified remote push are still required. The application and the English submission materials are prepared locally.

Create an empty public repository on GitHub, with no generated README or license. The instructor will be able to read a public repository without an invitation. Verify the published page and source files without signing in before recording publication as complete.

From the prepared project folder in PowerShell, run Publish-GitHub.ps1 with the actual HTTPS RepositoryUrl. The script accepts only a github.com repository URL, requires reviewed committed files, and pushes main without force. It does not replace an existing different origin and does not create or sign in to a GitHub account.

For a source ZIP without Git history, extract it, run git init with main as the initial branch, add the files, and make an initial commit using your configured Git identity before using the publisher. Do not commit node_modules, local build helpers, credentials, private history or environment secrets.

After publication, clone the repository into a new folder and follow the README. The included clean-install check already verifies the dependency lockfile and build from a fresh local source copy. Verify remote cloning too after the actual repository exists.
