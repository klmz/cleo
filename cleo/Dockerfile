ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
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
RUN npm prune --production

FROM $BUILD_FROM

RUN apk add --no-cache \
    nodejs \
    npm

WORKDIR /app

COPY --from=builder /build/package*.json ./
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY public ./public

COPY run.sh /
RUN chmod +x /run.sh

EXPOSE 8099

CMD ["/run.sh"]
