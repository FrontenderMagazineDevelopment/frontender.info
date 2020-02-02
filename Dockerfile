# docker run -it node:lts-alpine /bin/bash
# ---- Base Node ----
FROM node:12.9.1-alpine AS base
# Preparing
RUN mkdir -p /var/app && chown -R node /var/app
# Set working directory
WORKDIR /var/app
# Copy project file
COPY gulpfile.js .
COPY postcss.config.js .
COPY package.json .
COPY package-lock.json .

#
# ---- Dependencies ----
FROM base AS dependencies
RUN apk add --update python build-base git
# install node packages
ENV NODE_ENV=production
RUN npm ci
# copy production node_modules aside
RUN cp -R node_modules prod_node_modules
# install only 'devDependencies'
ENV NODE_ENV=development
RUN npm ci
# Run in production mode

#
# ---- Test & Build ----
# run linters, setup and tests
FROM dependencies AS build
COPY . .
# Setup environment variables
RUN npm run build

#
# ---- Release ----
FROM base AS release
RUN apk add --update bash git && rm -rf /var/cache/apk/*
COPY --from=dependencies /var/app/prod_node_modules ./node_modules
COPY --from=build /var/app/source ./source
COPY --from=build /var/app/public ./public
COPY --from=build /var/app/server.js ./server.js

# Setup environment variables
ENV NODE_ENV=production
# expose port and define CMD
EXPOSE 3000
CMD cp -R ./public/* ./static && node ./server.js
