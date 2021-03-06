#!/bin/bash
FILES=$(git diff --cached --name-only *.c *.h)
if [ -n "$FILES" ]; then
    # Change files, stage changes
    clang-format-6.0 -verbose -i $FILES
    git add $FILES
fi
