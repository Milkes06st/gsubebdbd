#!/usr/bin/env bash
# Astrotest CLI alias
curl -sSL "${ASTROTEST_SERVER_URL:-https://astrotest-delta.vercel.app}/cli" | bash -s -- "$@"
