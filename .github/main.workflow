workflow "Main" {
  on = "push"
  resolves = [ "Tests" ]
}

action "Tests" {
  uses = "./.github/test"
}
