FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 5000/udp
EXPOSE 5001

CMD ["node", "dist/index.js"]
