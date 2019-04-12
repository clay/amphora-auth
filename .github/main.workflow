workflow "Lint and Test" {
  on = "push"
  resolves = [ "Test" ]
}

action "Test" {
  uses = "actions/npm@master"
  args = "test"
  secrets = [ "COVERALLS_REPO_TOKEN" ]
  env = { COVERALLS_SERVICE_NAME = "GitHub Actions" }
}
