FROM postgres:19-alpine@sha256:8b0ff4cdf221f0c53d7fcda681d3b461be725c492cd881c5ec9c0ad25023f188
# The standard entrypoint only needs user switching. Use Alpine's small C helper
# instead of retaining a gosu binary compiled with the obsolete Go standard library.
RUN apk add --no-cache su-exec && apk upgrade --no-cache \
    && rm /usr/local/bin/gosu \
    && sed -i 's/exec gosu postgres/exec su-exec postgres/' /usr/local/bin/docker-entrypoint.sh \
    && su-exec postgres sh -c 'test "$(id -u)" -ne 0'
