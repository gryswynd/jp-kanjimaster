# Cloud Run container for the custom-story generator.
# Run `npm run predeploy` first to stage ./vendor (pipeline libs) + ./content
# (curriculum the gates read) into this directory — COPY . . then ships them.
# No ffmpeg yet (audio deferred); add it here when 2c lands.
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV PORT=8080
ENV CONTENT_ROOT=/app/content
EXPOSE 8080
CMD ["node", "index.js"]
