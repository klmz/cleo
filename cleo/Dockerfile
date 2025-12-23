ARG BUILD_FROM=ghcr.io/hassio-addons/base:16.3.2
FROM $BUILD_FROM AS builder

RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++

WORKDIR /build

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM $BUILD_FROM

RUN apk add --no-cache \
    nodejs \
    npm

WORKDIR /app

COPY --from=builder /build/package*.json ./
COPY --from=builder /build/dist ./dist

RUN npm ci --omit=dev

COPY run.sh /
RUN chmod +x /run.sh

CMD ["/run.sh"]
