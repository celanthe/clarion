# Clarion server — Node.js (for docker-compose deployment)
# Note: For Cloudflare Worker deployment, use `wrangler deploy` instead.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 8080

# Run with Node.js directly using the Hono Node adapter
CMD ["node", "src/node-server.js"]
