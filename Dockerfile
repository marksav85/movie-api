FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
# Toolchain supports native compilation if bcrypt prebuilt binaries are unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.21.0-bookworm-slim AS production
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json app.js index.js config.js models.js passport.js ./
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node routes ./routes
USER node
# Verify the native addon loads and performs a hash in the actual runtime image.
RUN node -e 'const b = require("bcrypt"); if (!b.compareSync("build-check", b.hashSync("build-check", 4))) process.exit(1)'
EXPOSE 8080
CMD ["node", "index.js"]
