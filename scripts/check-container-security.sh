#!/usr/bin/env bash
set -Eeuo pipefail
scanner='aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb'
for image in "$@"; do
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v inventory-trivy-cache:/root/.cache/ \
    "$scanner" image --scanners vuln --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 "$image"
done
