# Amphora Auth

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
  site, // Site metadata
  storage, // DB instance
  bus // Redis bus instance
});
```

## Authentication

This module provides authenticating users in Clay locally with an username and password or using third-party providers. Here's a list of the supported providers:

- Google
- Twitter
- Slack
- LDAP

We'll also have to create a user account to edit pages in Clay. The easiest way to do this is to create a `user.yml` file that looks like this:

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

And import them using [claycli](https://github.com/clay/claycli):

```bash
cat user.yml | clay import -k <local_api_key> -y localhost
```

## Environmental Variables

The following are the required env variables needed to use the providers for authentication:

```bash
export CLAY_PROVIDER=google

export TWITTER_CONSUMER_KEY=<TWITTER_CONSUMER_KEY>
export TWITTER_CONSUMER_SECRET=<TWITTER_CONSUMER_SECRET>

export GOOGLE_CONSUMER_KEY=<GOOGLE_CONSUMER_KEY>
export GOOGLE_CONSUMER_SECRET=<GOOGLE_CONSUMER_SECRET>

export SLACK_CONSUMER_KEY=<SLACK_CONSUMER_KEY>
export SLACK_CONSUMER_SECRET=<SLACK_CONSUMER_SECRET>

export LDAP_URL=<LDAP_URL>
export LDAP_BIND_DN=<LDAP_BIND_DN>
export LDAP_BIND_CREDENTIALS=<LDAP_BIND_CREDENTIALS>
export LDAP_SEARCH_BASE=<LDAP_SEARCH_BASE>
export LDAP_SEARCH_FILTER=<LDAP_SEARCH_FILTER>
```

## License

MIT
