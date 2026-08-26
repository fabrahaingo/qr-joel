FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/main.html ./dist/main.html
COPY --from=builder /app/frame.png ./dist/frame.png
COPY --from=builder /app/DejaVuSans-Bold.ttf ./dist/DejaVuSans-Bold.ttf
COPY --from=builder /app/logo_round.png ./dist/logo_round.png
COPY --from=builder /app/apple-touch-icon.png ./dist/apple-touch-icon.png
COPY --from=builder /app/favicon-16x16.png ./dist/favicon-16x16.png
COPY --from=builder /app/favicon-32x32.png ./dist/favicon-32x32.png
COPY --from=builder /app/src/output.css ./dist/src/output.css
COPY --from=builder /app/assets ./dist/assets

# Generated here rather than at boot so the application never writes to its own
# directory, which is what allows the container to run with a read-only root
# filesystem. server.ts skips the write when FONTCONFIG_FILE is already set.
ENV FONTCONFIG_FILE=/app/dist/fontconfig.conf
RUN printf '%s\n' \
      '<?xml version="1.0"?>' \
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' \
      '<fontconfig>' \
      '  <dir>/app/dist</dir>' \
      '</fontconfig>' \
      > "$FONTCONFIG_FILE" \
 && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form with node as PID 1 so SIGTERM reaches the process directly.
CMD ["node", "dist/server.js"]
