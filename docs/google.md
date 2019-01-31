# Google OAuth

A wrapper around the [Passport Google OAuth](https://www.npmjs.com/package/passport-google-oauth) package.

### Configuration

- `GOOGLE_CONSUMER_KEY` _(required)_: the key provided by google
- `GOOGLE_CONSUMER_SECRET` _(required)_: the secret provided by google
- `GOOGLE_PROFILE_URL` _(optional)_: the url from which the module will grab the profile information from Google. The Passport module currently defaults to `https://www.googleapis.com/plus/v1/people/me`.

### Deprecation of Google+ API

Google is shutting down the Google+ API for authentication: https://developers.google.com/+/api-shutdown

In order to migrate, set the `GOOGLE_PROFILE_URL` to `https://www.googleapis.com/oauth2/v3/userinfo`. You shouldn't need to generate new API keys, but be sure to check the Google API console to ensure no calls are going to the Google+ API service from Clay.
