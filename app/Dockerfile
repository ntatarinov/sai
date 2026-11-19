FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
COPY db ./db
USER node
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=4s --start-period=10s --retries=6 CMD ["node", "-e", "require('node:http').get('http://127.0.0.1:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
CMD ["sh", "-c", "node server/db/migrate.js && exec node server/node-main.js"]
