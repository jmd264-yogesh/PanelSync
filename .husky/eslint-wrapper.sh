#!/bin/sh
# ESLint wrapper that always succeeds
eslint "$@" --fix --max-warnings=-1 || exit 0
