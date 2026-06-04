# Cloud Run container for the Rikizo tutor server.
# Before building, run `npm run predeploy` to stage curriculum/ (manifest +
# glossaries) into this directory — lookup_curriculum reads it at runtime via
# CURRICULUM_ROOT=/app/curriculum (set in the Cloud Run env).
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
