#!/bin/sh

set -e

sh -c "npm i && npm test && npm run coveralls"
