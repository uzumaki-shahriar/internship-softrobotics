FROM node:22-alpine

# Prisma's query engine needs OpenSSL, which isn't in the base Alpine image -
# without this it fails at runtime with "Could not parse schema engine
# response" (a very common Prisma+Alpine gotcha).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 8001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
