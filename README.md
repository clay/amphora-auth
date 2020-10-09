# Amphora Auth [![Coverage Status](https://coveralls.io/repos/github/clay/amphora-auth/badge.svg?branch=master)](https://coveralls.io/github/clay/amphora-auth?branch=master)

A module for Amphora to offer authentication in [Clay](https://clay.nymag.com/).

## Installation & Usage

First, install the module:

```bash
npm install -s amphora-auth
```

Then, call the module when setting up the routes for Amphora by passing the required parameters:

```js
// Initialize auth module
amphoraAuth({
  router // Site router
  providers, // Authentication providers
  store, // Redis Session Store
  site, // Site metadata
  storage, // DB instance
  bus // Redis bus instance
});
```

## Authentication

This module provides local authentication in Clay with a username and password and allows for easy configuration of Oauth for authentication with third-party providers. Here's a list of the supported providers:

- Google
- Twitter
- Slack
- Cognito
- LDAP

To get started editing in Clay, create a user account. The easiest way to do this is to create a `user.yml` file that looks like this:

```yml
_users:
  - # Google User
    username: <your full email address>
    provider: google
    auth: admin
  - # Local User
    username: myuser
    password: mypassword
    provider: local
    auth: admin
```

And import the configuration using [claycli](https://github.com/clay/claycli):

```bash
cat user.yml | clay import -k <local_api_key> -y localhost
```

## Environmental Variables

The following env variables are required in order to be able to authenticate a user through the providers:

```bash
export CLAY_PROVIDER=google

export TWITTER_CONSUMER_KEY=<TWITTER_CONSUMER_KEY>
export TWITTER_CONSUMER_SECRET=<TWITTER_CONSUMER_SECRET>

export GOOGLE_CONSUMER_KEY=<GOOGLE_CONSUMER_KEY>
export GOOGLE_CONSUMER_SECRET=<GOOGLE_CONSUMER_SECRET>

export SLACK_CONSUMER_KEY=<SLACK_CONSUMER_KEY>
export SLACK_CONSUMER_SECRET=<SLACK_CONSUMER_SECRET>

export COGNITO_CONSUMER_KEY=<COGNITO_CLIENT_ID>
export COGNITO_CONSUMER_SECRET=<COGNITO_SECRET>
export COGNITO_CONSUMER_DOMAIN=<COGNITO_AUTHENICATION_DOMAIN>
export COGNITO_CONSUMER_REGION=<COGNITO_INSTANCE_REGION>

export LDAP_URL=<LDAP_URL>
export LDAP_BIND_DN=<LDAP_BIND_DN>
export LDAP_BIND_CREDENTIALS=<LDAP_BIND_CREDENTIALS>
export LDAP_SEARCH_BASE=<LDAP_SEARCH_BASE>
export LDAP_SEARCH_FILTER=<LDAP_SEARCH_FILTER>
```

Additionally, the following environment variable can toggle the global access key.

If **not set** or **set to an empty string** only user-level access keys will be accepted.

If **set to a string** the value will act as a global plain-text key.

:warning: This setting is insecure and should only be used when bootstrapping a new environment.

```
CLAY_ACCESS_KEY=
```

## License

MIT
