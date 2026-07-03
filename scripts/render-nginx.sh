#!/usr/bin/env bash
set -euo pipefail

: "${SERVICE_DOMAIN:?Missing SERVICE_DOMAIN}"
: "${WWW_SERVICE_DOMAIN:?Missing WWW_SERVICE_DOMAIN}"
: "${API_PORT:?Missing API_PORT}"
: "${WEB_PORT:?Missing WEB_PORT}"

envsubst '${SERVICE_DOMAIN} ${WWW_SERVICE_DOMAIN} ${API_PORT} ${WEB_PORT}' \
  < infra/nginx/maeum-arrival.conf.template
