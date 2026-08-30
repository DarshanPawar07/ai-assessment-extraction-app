FROM node:20-bookworm

# Install GraphicsMagick and Ghostscript
RUN apt-get update && \
    apt-get install -y graphicsmagick ghostscript && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]