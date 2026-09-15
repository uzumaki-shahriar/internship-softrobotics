FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 8001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
