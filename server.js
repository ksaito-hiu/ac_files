//import ac_files from 'ac_files';
import ac_files from './src/index.js';
import fs from 'fs';
import https from 'https';

async function load_json(file_name) {
  return JSON.parse(
    await fs.promises.readFile(
      new URL(file_name, import.meta.url)
    )
  );
}

let conf_file = process.env.AC_FILE_CONFIG;
if (!conf_file) conf_file = './config.json';
const config = await load_json(conf_file);
config.identity.id2webid = function(id) {
  return 'https://id.do-johodai.ac.jp/people/'+id+'#me';
};
config.identity.webid2id = function(webid) {
  const m = webid.match(/^https:\/\/id.do-johodai.ac.jp\/people\/([^#]+)#[^#]+$/);
  if (!m) return null;
  return m[1];
};

let priv_key = config.server.priv_key;
let cert_key = config.server.cert_key;
let port = config.server.port;
if (!priv_key) priv_key = './tls/privkey.pem';
if (!cert_key) cert_key = './tls/certkey.pem';
if (!port) cert_key = 8443;

const af = await ac_files(config);

const options = {
  key: fs.readFileSync(priv_key),
  cert: fs.readFileSync(cert_key),
};
const server = https.createServer(options, af);
server.listen(port, () => {
  console.log(`ac_files was launched at port ${port}.`);
});
