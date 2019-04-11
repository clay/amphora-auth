#!/bin/sh

set -e

# Only install the dev dependencies
npm install --only=dev

# Run the tests
npm test
