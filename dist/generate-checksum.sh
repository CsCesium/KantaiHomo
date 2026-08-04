#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if (( $# > 1 )); then
  echo "Usage: $0 [hap-file]" >&2
  exit 2
fi

if (( $# == 1 )); then
  hap_file="$1"
else
  mapfile -d '' hap_files < <(find . -maxdepth 1 -type f -name '*.hap' -print0)

  if (( ${#hap_files[@]} == 0 )); then
    echo "No .hap file found in $script_dir" >&2
    exit 1
  fi

  if (( ${#hap_files[@]} > 1 )); then
    echo "Multiple .hap files found; specify one explicitly:" >&2
    printf '  %s\n' "${hap_files[@]#./}" >&2
    exit 1
  fi

  hap_file="${hap_files[0]}"
fi

if [[ ! -f "$hap_file" ]]; then
  echo "HAP file not found: $hap_file" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  hash="$(sha256sum -- "$hap_file" | awk '{ print $1 }')"
elif command -v shasum >/dev/null 2>&1; then
  hash="$(shasum -a 256 -- "$hap_file" | awk '{ print $1 }')"
else
  echo "Neither sha256sum nor shasum is available." >&2
  exit 1
fi

hap_name="$(basename -- "$hap_file")"
printf '%s  %s\n' "$hash" "$hap_name" > SHA256SUMS.txt
echo "Generated SHA256SUMS.txt for $hap_name"
