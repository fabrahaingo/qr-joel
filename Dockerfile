FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-slim

# sharp needs these native libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/main.html ./dist/main.html
COPY --from=builder /app/frame.png ./dist/frame.png
COPY --from=builder /app/DejaVuSans-Bold.ttf ./dist/DejaVuSans-Bold.ttf
COPY --from=builder /app/logo_round.png ./dist/logo_round.png
COPY --from=builder /app/apple-touch-icon.png ./dist/apple-touch-icon.png
COPY --from=builder /app/favicon-16x16.png ./dist/favicon-16x16.png
COPY --from=builder /app/favicon-32x32.png ./dist/favicon-32x32.png
COPY --from=builder /app/src/output.css ./dist/src/output.css

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start:prod"]