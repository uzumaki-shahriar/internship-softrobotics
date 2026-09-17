FROM node:20-alpine

WORKDIR /app

# Alpine's musl libc ships without OpenSSL, which Prisma's engines need to start.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node src/app.js"]
