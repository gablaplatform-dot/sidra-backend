FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY public_app/package*.json ./
RUN npm ci
COPY public_app ./
ENV VITE_API_URL=/api/v1
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY --from=frontend-build /app/frontend/dist ./public_dist

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
