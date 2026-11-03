FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Next.js fixes rewrite destinations at build time, so the API address is a build argument.
ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_STANDALONE=true
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
