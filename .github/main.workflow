workflow "Lint and Test" {
  on = "push"
  resolves = [ "Coveralls" ]
}

action "Install" {
  uses = "actions/npm@master"
  args = "install --ignore-scripts --only=dev"
}

action "Test" {
  needs = "Install"
  uses = "actions/npm@master"
  args = "test"
}

action "Coveralls" {
  needs = "Test"
  uses = "actions/npm@master"
  args = "run coveralls"
}
