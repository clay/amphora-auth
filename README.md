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
- LDAP (needs `npm install passport-ldapauth@^2.1.1`: it is an optional peer dependency, so it is not installed with this module)

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

### Which requests need a sign in

Edit mode (`?edit=true`) and every method other than `GET`, `HEAD` and `OPTIONS` need a sign in (or an API key), except routes whose path contains `/_auth`: the sign in routes, and routes you name that way so they stay open (for example a webhook at `/hooks/_auth/notify`). Only the path that express routes the request on counts, not the query string. A route that stays open this way runs for anyone, so it has to check `req.user` (or use `withAuthLevel`) itself before it changes anything.

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

The `clay-session` cookie is `Secure`, `HttpOnly` and `SameSite=Lax`, and lasts a week from the last request.

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

### Skipping the login page

When a site has one provider that people sign in with, they can go straight to it instead of clicking through the login page:

```bash
export CLAY_AUTH_AUTO_LOGIN=google   # a provider of the site: google, or ldap
```

Someone who opens a page that needs a sign in (edit mode) is sent to that provider and comes back to the page. If they are signed in at the provider already (with Google, in the same browser) that takes no clicks, on every site of the instance. Each site's callback url still has to be registered with the provider.

Only a browser opening a page counts: a navigation to a document, as browsers say in `Sec-Fetch-Mode` and `Sec-Fetch-Dest`, or, from a client that doesn't send those, a request that asks for HTML before JSON. Scripts (fetch, XMLHttpRequest, JSON clients), frames, writes and everything else still go to the login page, and so does someone who comes back from a failed sign in, so there is no loop. Signing out ends the session on the site, not at the provider, so the next page that needs a sign in signs them in again.

Don't combine it with `CLAY_SESSION_REGENERATE` when the provider's callback is served by another host (an auth proxy): the sign in lands on another session, and the page sends the browser back to the provider again and again.

## Requirements

Node 26.12.1 or later. The Google, LDAP, local and API key strategies are loaded when a site uses them, so only the ones in use are loaded. LDAP also needs the optional `passport-ldapauth` package (see above).

## License

MIT
