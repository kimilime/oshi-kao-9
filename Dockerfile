FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node server ./server
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node LICENSE ./LICENSE
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
ENV HOST=0.0.0.0 PORT=8788 DATA_DIR=/app/storage
EXPOSE 8788
CMD ["node", "server/index.js"]
