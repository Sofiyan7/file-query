# Production build for server (Optimized for Hugging Face Spaces / single container)
FROM node:20-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install redis server
RUN apk add --no-cache redis

# Copy dependency configs
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy application source code
COPY . .

# Ensure uploads directory exists and set permissions
RUN mkdir -p uploads && chmod -R 777 uploads

# Make startup script executable and fix potential Windows line ending issues
RUN chmod +x start.sh && sed -i 's/\r$//' start.sh

# Expose standard HF Spaces port
EXPOSE 7860
ENV PORT=7860

# Run both the worker and Express server in parallel
CMD ["sh", "start.sh"]
