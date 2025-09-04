# Use Node.js 20 slim image for smaller size
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including TypeScript support
RUN npm ci

# Copy source code and config files
COPY src ./src
COPY smithery.yaml ./
COPY tsconfig.json ./

# Build the TypeScript code
RUN npm run build

# Create non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# The Smithery platform will handle the server startup
# No CMD needed as Smithery manages the execution