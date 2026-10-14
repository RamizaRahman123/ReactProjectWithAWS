FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 5000

# Run as the non-root "node" user that ships with the image
USER node

CMD ["node", "server.js"]
