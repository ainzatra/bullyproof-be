# Builder stage: install deps, generate prisma client, and build the app
FROM node:22-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies (using package-lock for reproducible installs)
COPY package.json package-lock.json schema.zmodel ./
RUN npm ci

# Copy source and generate Prisma client (if present), then build
COPY . .
RUN if [ -f ./node_modules/.prisma/client/index.js ] || command -v npx >/dev/null 2>&1; then npx prisma generate || true; else echo "no prisma"; fi
RUN npm run build
RUN npm run zenstack:generate

# Production stage: smaller runtime image
FROM node:22-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copy package files and install production deps (this keeps layers cache-friendly)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts and generated/prisma runtime files from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma

# Use non-root user for security
USER node

# Expose default port and start the app
EXPOSE 3000
CMD ["node", "dist/main"]