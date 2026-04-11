FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/src/infrastructure/database/prisma ./prisma/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
