FROM postgres:17-alpine@sha256:f9cf3e1f0066f0eb0c48707d864f0ac5941e9ff454a072077d97a4d278d07d73
# The standard entrypoint only needs user switching. Use Alpine's small C helper
# instead of retaining a gosu binary compiled with the obsolete Go standard library.
RUN apk add --no-cache su-exec && apk upgrade --no-cache \
    && rm /usr/local/bin/gosu \
    && sed -i 's/exec gosu postgres/exec su-exec postgres/' /usr/local/bin/docker-entrypoint.sh \
    && su-exec postgres sh -c 'test "$(id -u)" -ne 0'
