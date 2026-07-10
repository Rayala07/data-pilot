FROM node:22-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# Prisma's database engine is a binary that needs openssl while the app runs.
RUN apk add --no-cache openssl


# ---- builder: compiles the app. Nothing from here ships. ----
FROM base AS builder

# Copy manifests alone first, so npm re-runs only when dependencies change.
COPY package.json package-lock.json ./

# Install what the app needs to RUN, and set it aside.
# The next install overwrites node_modules, so it has to be saved now.
# --ignore-scripts is safe: no dependency needs a build step.
RUN npm ci --omit=dev --ignore-scripts && mv node_modules /prod_modules

# Install everything, including TypeScript and the Prisma CLI.
# --include=dev is required because npm skips devDependencies when
# NODE_ENV=production, which the final stage sets.
RUN npm ci --include=dev

# Generate the Prisma client. It lands in node_modules/.prisma, built for this
# image's platform — which is why both stages share the same base.
COPY prisma ./prisma
RUN npx prisma generate

# Compile TypeScript into dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# npm cannot install a generated client, so copy it into the runtime tree.
RUN cp -R node_modules/.prisma /prod_modules/.prisma


# ---- runner: only the compiled app and the deps it uses ----
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /prod_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Don't run as root.
USER node

# Apply migrations before deploying, not here — a container that migrates on
# start would race with every other container:  npx prisma migrate deploy
CMD ["node", "dist/index.js"]
