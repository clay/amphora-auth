# AWS Cognito OAuth

A wrapper around the [Passport Azure Active Directory](http://www.passportjs.org/packages/passport-azure-ad/) package.

### Configuration

- `AD_OIDC_IDENTITY_METADATA` _(required)_: the metadata endpoint provided by the Microsoft Identity Portal.
- `AD_OIDC_CLIENT_ID` _(required)_: the client ID of your application in AAD (Azure Active Directory).
- `AD_OIDC_RESPONSE_MODE` _(required)_: must be 'query' or 'form_post.
- `AD_OIDC_RESPONSE_TYPE` _(required)_: must be 'code', 'code id_token', 'id_token code' or 'id_token'.
- `AD_OIDC_REDIRECT_URL` _(required)_: Must be a https url string, unless you set AD_OIDC_ALLOW_HTTP to true. This is the reply URL registered in AAD for your app.
- `AD_OIDC_CLIENT_SECRET` _(conditional)_: When responseType is not id_token, we have to provide client credential to redeem the authorization code. 
- `AD_OIDC_ALLOW_HTTP` _(conditional)_: required to set to true if you want to use http url.
- `AD_OIDC_VALIDATE_ISSUER` _(conditional)_: required to set to false if you don't want to validate issuer, default value is true.
- `AD_OIDC_ISB2C` _(conditional)_: required to set to true if you are using B2C tenant.
- `AD_OIDC_ISSUER` _(conditional)_: this can be a string or an array of string.
- `AD_OIDC_SCOPE` _(conditional)_: list of scope values (comma delimited) besides openid indicating the required scope of the access token for accessing the requested resource.
- `AD_OIDC_LOGGING_LEVEL` _(conditional)_: logging level.
- `AD_OIDC_LOGGING_NO_PII` _(conditional)_: if this is set to true, no personal information such as tokens and claims will be logged.
- `AD_OIDC_NONCE_LIFETIME` _(conditional)_: the lifetime of nonce in session in seconds.
- `AD_OIDC_NONCE_MAX_AMOUNT` _(conditional)_: the max amount of nonce you want to keep in session or cookies.
- `AD_OIDC_USE_COOKIE` _(conditional)_: passport-azure-ad saves state and nonce in session by default for validation purpose.
- `AD_OIDC_COOKIE_ENCRYPTION` _(conditional)_: if useCookieInsteadOfSession is set to true, you must provide cookieEncryptionKeys.
- `AD_OIDC_CLOCKSKEW` _(conditional)_: this value is the clock skew (in seconds) allowed in token validation.
