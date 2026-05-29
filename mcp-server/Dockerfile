# Multi-stage build keeps the runtime image lean — no dev deps, no src.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --include=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
# Alpine ships without tzdata; install it so the TZ env var actually
# resolves to America/Los_Angeles (and DST transitions are honored).
# Without tzdata, Intl.DateTimeFormat falls back to UTC silently.
RUN apk add --no-cache tzdata
ENV NODE_ENV=production
ENV TZ=America/Los_Angeles
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
