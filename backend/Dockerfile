FROM node:20-alpine AS builder
WORKDIR /app
# Prisma a besoin d'OpenSSL pour détecter la bonne version du moteur.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
# `prisma generate` valide le schéma et exige DATABASE_URL : on fournit une
# valeur factice (aucune connexion n'est ouverte à cette étape).
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
