workflow "Lint and Test" {
  on = "push"
  resolves = [ "Tests" ]
}

action "Tests" {
  uses = "./.github/npm"
  secrets = [ "COVERALLS_REPO_TOKEN" ]
  env = { COVERALLS_SERVICE_NAME = "GitHub Actions" }
}
