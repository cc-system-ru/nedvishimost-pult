FROM node:20-bookworm-slim
WORKDIR /srv
COPY app/package.json app/package-lock.json app/
RUN cd app && npm ci --omit=dev
COPY . .
ENV DATA_DIR=/data PORT=3000
VOLUME /data
EXPOSE 3000
CMD ["node", "app/server.js"]
