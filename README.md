# Amphora Auth [![CI](https://github.com/clay/amphora-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/clay/amphora-auth/actions/workflows/ci.yml)

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
- LDAP

Twitter, Slack and Cognito sign-in were removed in version 3. A site that still lists one of them gets an error at startup that says so.

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

export GOOGLE_CONSUMER_KEY=<GOOGLE_CONSUMER_KEY>
export GOOGLE_CONSUMER_SECRET=<GOOGLE_CONSUMER_SECRET>

export LDAP_URL=<LDAP_URL>
export LDAP_BIND_DN=<LDAP_BIND_DN>
export LDAP_BIND_CREDENTIALS=<LDAP_BIND_CREDENTIALS>
export LDAP_SEARCH_BASE=<LDAP_SEARCH_BASE>
export LDAP_SEARCH_FILTER=<LDAP_SEARCH_FILTER>
```

The sessions are kept in the store that is passed in as `store`. When there is none, this module makes a Redis store from these (it connects when the first site is set up):

```bash
export REDIS_SESSION_HOST=redis://<host>:<port>/<db>   # redis:// or rediss://, defaults to a Redis on localhost
export REDIS_DB=<name>                                 # the keys start with <name>-clay-session: (clay-session: without it)
export CLAY_SESSION_SECRET=<secret>                    # signs the clay-session cookie. Set it: the default is not a secret
```

The following env variables are optional:

This flag, when true, will prevent users from either going into edit mode or making any edits to a page they had already opened in edit mode in their browsers. This environment variable is optional and you can set it up from your Clay instance and it'll be picked up here since it'll share the same env file!
It will redirect users to the login page where they'll see a message saying that Clay is under maintenance.
```bash
export MAINTENANCE_MODE_ENABLED=true
```

A session keeps its id when someone signs in or out. To start a new session at sign in and at sign out instead (which stops a session id that was planted before sign in from being the signed in one), set:

```bash
export CLAY_SESSION_REGENERATE=true
```

Anything that depends on the id staying the same, like an auth proxy that signs in a session on behalf of another host, doesn't work with it on.

## Requirements

Node 26.12.1 or later. `clayhandlebars` 5 or 6 is a peer dependency. The Google, LDAP, local and API key strategies are loaded when a site uses them, so only the ones in use are loaded.

## License

MIT
