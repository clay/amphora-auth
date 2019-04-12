FROM node:10.15-alpine

LABEL "com.github.actions.name"="Lint and Test"
LABEL "com.github.actions.description"="Lints and runs tests then sends the coverage to coveralls"
LABEL "com.github.actions.icon"="activity"
LABEL "com.github.actions.color"="blue"

ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN apk add --no-cache --virtual .gyp python make g++

ENTRYPOINT [ "/entrypoint.sh" ]
