FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build

COPY front-end/package*.json ./front-end/
RUN cd front-end && npm ci
COPY front-end/ ./front-end/
RUN cd front-end && npm run build

COPY back-end/auth-server/package*.json ./auth-server/
RUN cd auth-server && npm ci --omit=dev
COPY back-end/auth-server/ ./auth-server/

COPY back-end/invitation-service/package*.json ./invitation-service/
RUN cd invitation-service && npm ci --omit=dev
COPY back-end/invitation-service/ ./invitation-service/

COPY back-end/messaging-service/package*.json ./messaging-service/
RUN cd messaging-service && npm ci --omit=dev
COPY back-end/messaging-service/ ./messaging-service/

COPY back-end/user-server/package*.json ./user-server/
RUN cd user-server && npm ci --omit=dev
COPY back-end/user-server/ ./user-server/

FROM maven:3.9.9-eclipse-temurin-21 AS java-build
WORKDIR /src
COPY back-end/email-service/ ./
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy

ARG NODE_VERSION=20.20.0

RUN apt-get update \
	&& apt-get install -y --no-install-recommends nginx supervisor curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Copy the Node runtime so all services use Node 20 in the Java-based image.
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-build /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
	&& ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /app
COPY --from=frontend-build /build/front-end/dist/ /usr/share/nginx/html/
COPY --from=frontend-build /build/front-end/ /app/frontend/
COPY --from=frontend-build /build/auth-server/ /app/backend/auth-server/
COPY --from=frontend-build /build/invitation-service/ /app/backend/invitation-service/
COPY --from=frontend-build /build/messaging-service/ /app/backend/messaging-service/
COPY --from=frontend-build /build/user-server/ /app/backend/user-server/
COPY --from=java-build /src/target/email-service-0.0.1-SNAPSHOT.war /app/backend/email-service.war
COPY back-end/get-contact/ /app/backend/get-contact/
COPY back-end/get-messages/ /app/backend/get-messages/
COPY nginx.conf /etc/nginx/nginx.conf

RUN printf '%s\n' \
	'[supervisord]' \
	'nodaemon=true' \
	'user=root' \
	'' \
	'[include]' \
	'files = /etc/supervisor/conf.d/*.conf' \
	> /etc/supervisord.conf

RUN printf '%s\n' \
	'[program:nginx]' \
	'command=nginx -g "daemon off;"' \
	'autorestart=true' \
	'priority=10' \
	'' \
	'[program:frontend]' \
	'directory=/app/frontend' \
	'command=npm run dev -- --host 0.0.0.0' \
	'autorestart=true' \
	'' \
	'[program:auth]' \
	'directory=/app/backend/auth-server' \
	'command=node auth-server.js' \
	'autorestart=true' \
	'' \
	'[program:invitation]' \
	'directory=/app/backend/invitation-service' \
	'command=node server.js' \
	'autorestart=true' \
	'' \
	'[program:messaging]' \
	'directory=/app/backend/messaging-service' \
	'command=node server.js' \
	'autorestart=true' \
	'' \
	'[program:user]' \
	'directory=/app/backend/user-server' \
	'command=node contact.js' \
	'autorestart=true' \
	'' \
	'[program:get-contact]' \
	'directory=/app/backend/get-contact' \
	'command=/app/backend/get-contact/get-contact' \
	'autorestart=true' \
	'' \
	'[program:get-messages]' \
	'directory=/app/backend/get-messages' \
	'command=/app/backend/get-messages/get-messages' \
	'autorestart=true' \
	'' \
	'[program:email]' \
	'command=java -jar /app/backend/email-service.war' \
	'autorestart=true' \
	> /etc/supervisor/conf.d/app.conf

RUN chmod +x /app/backend/get-contact/get-contact /app/backend/get-messages/get-messages

EXPOSE 8080

CMD ["supervisord", "-n", "-c", "/etc/supervisord.conf"]

