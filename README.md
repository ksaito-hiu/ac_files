# ac_files

An access controled file server.
This software aims only our private use.

The '.uids' files contains JSON data. And it is
used for access control. The sample of these files
are below.

```
{
  "read": [
    "any authorized users"
  ],
  "write": [
    "f200088071",
    "f123456789"
  ]
}
```

If you need a public directory, include the string
"any authorized users" instead of user ID.

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

-----

systemd

ubuntu: /lib/systemd/system/ac_files.service

```
[Unit]
Description=An access controled file server
Documentation=https://github.com/ksaito-hiu/ac_files
After=network.target

[Service]
Type=simple
User=some_user     # <-- change!
WorkingDirectory=/some/working/directory/path # <-- change!
ExecStart=/some/working/directory/path/start.sh # <-- change!
Restart=on-failure
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ac_files

[Install]
WantedBy=multi-user.target

```

-----

syslog

Ubuntu: /etc/rsyslog.d/ac_files.conf

```
:programname, startswith, "ac_files" /var/log/ac_files.log
```

