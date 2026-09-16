FROM node:22-alpine

# Prisma's query engine needs OpenSSL, which isn't in the base Alpine image
# (same gotcha already hit in bank-system/payment-system's Dockerfiles).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
