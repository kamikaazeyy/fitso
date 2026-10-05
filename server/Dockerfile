FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Copy application code (including keys/ and prisma/)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose backend port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
