FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config ./config
RUN npm install --include=dev && npm run build && npm prune --omit=dev

# run as non-root
RUN adduser -D -u 10001 appuser
USER 10001

ENV NODE_ENV=production
EXPOSE 8443

CMD ["node", "dist/src/server.js"]
