# ac_files


Memo
-----

nginx

```
server {
  listen *:443 ssl;
  listen [::]:443 ssl;
  server_name XXXXXXX;

  ssl_certificate /etc/letsencrypt/live/XXXXXXX/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/XXXXXXX/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

  access_log  /var/log/nginx/XXX_ssl_access.log;
  error_log   /var/log/nginx/XXX_ssl_error.log;

  ## [Optional] Enable HTTP Strict Transport Security
  ## HSTS is a feature improving protection against MITM attacks
  ## For more information see: https://www.nginx.com/blog/http-strict-transport-security-hsts-and-nginx/
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

  location / {
    root /var/www/html;
    # First attempt to serve request as file, then
    # as directory, then fall back to displaying a 404.
    try_files $uri $uri/ =404;
  }

  location /files/ {
    proxy_pass https://localhost:8443/;
    proxy_redirect off;
  }
}
```
