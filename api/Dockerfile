FROM node:26-alpine AS deps
RUN npm install -g yarn@1.22.22
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN yarn build

FROM node:26-alpine AS runtime
RUN npm install -g yarn@1.22.22
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build /app/dist ./dist
COPY public ./public
COPY views ./views
RUN mkdir -p tmp && chown node:node tmp
EXPOSE 3288
USER node
CMD ["node", "dist/main"]
