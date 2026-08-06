# SCROLLECT backend container (Node 22 + Prisma + Fastify).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
# Migrations apply at boot; then start the API (worker runs in-process at MVP scale).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
